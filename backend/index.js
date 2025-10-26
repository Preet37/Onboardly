// Import all your libraries
const express = require('express');
const { OpenAI } = require('openai');
const sgMail = require('@sendgrid/mail');
const axios = require('axios');
const ics = require('ics');
require('dotenv').config();

// --- CONFIGURE YOUR CLIENTS ---
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());

// Groq Client (using the OpenAI library)
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY, // Use the Groq key
  baseURL: 'https://api.groq.com/openai/v1', // Point to Groq's servers
});

// SendGrid Client
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Jira Client Config
const JIRA_AUTH = Buffer.from(
  `${process.env.JIRA_USER_EMAIL}:${process.env.JIRA_API_TOKEN}`
).toString('base64');
const JIRA_API = axios.create({
  baseURL: process.env.JIRA_BASE_URL,
  headers: {
    'Authorization': `Basic ${JIRA_AUTH}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

/*
================================================================================
THE MAIN ONBOARDING ENDPOINT
================================================================================
*/
app.post('/onboard', async (req, res) => {
  console.log('Received onboarding request...');
  const { prompt, intern } = req.body;

  if (!prompt || !intern || !intern.email || !intern.name) {
    return res.status(400).send({ error: 'Missing prompt, intern name, or intern email.' });
  }

  try {
    // --- (NEW) GET YOUR OWN JIRA ID FOR ASSIGNMENT ---
    // We'll assign the tasks to the person running the demo (you)
    console.log(`Fetching Jira account ID for demo assignee: ${process.env.JIRA_USER_EMAIL}`);
    const assigneeAccountId = await getJiraAccountId(process.env.JIRA_USER_EMAIL);
    if (!assigneeAccountId) {
      console.warn("Could not find demo user's account ID. Tasks will be unassigned.");
    }
    // --- END NEW SECTION ---


    // --- STEP 1: GENERATE JIRA TASKS ---
    console.log(`Generating tasks for: ${prompt}`);
    const tasks = await generateTasks(prompt);
    console.log('Tasks generated:', tasks);

    // --- STEP 2: PROVISION JIRA ---
    console.log('Provisioning Jira...');
    // Pass your own account ID to be the assignee
    const jiraEpicUrl = await createJiraWorkflow(tasks, intern, assigneeAccountId);
    console.log(`Jira Epic URL: ${jiraEpicUrl}`);
    
    // --- STEP 3: CREATE CALENDAR INVITES ---
    console.log('Generating .ics calendar invites...');
    const welcomeEvent = createCalendarEvents(intern.name, intern.email);
    console.log('Calendar invites created.');

    // --- STEP 4: SEND WELCOME EMAIL ---
    console.log('Sending final welcome email...');
    const emailPayload = {
      internName: intern.name,
      jiraEpicUrl: jiraEpicUrl,
      extensionLink: "https://chrome.google.com/your-extension-link",
      calendarInvite: welcomeEvent,
    };
    
    await sendWelcomeEmail(intern.email, emailPayload);
    console.log('Email sent!');

    // --- FINAL RESPONSE ---
    console.log('Onboarding flow complete!');
    res.status(200).send({
      message: 'Onboarding triggered successfully!',
      data: {
        generatedTasks: tasks,
        jiraEpicUrl: jiraEpicUrl,
        emailPayload: emailPayload
      }
    });

  } catch (error) {
    console.error('Full error stack:', error);
    res.status(500).send({ error: 'Onboarding flow failed.', details: error.message });
  }
});

/*
================================================================================
HELPER FUNCTIONS
================================================================================
*/

/**
 * (NEW) Fetches a user's Atlassian Account ID from their email.
 */
async function getJiraAccountId(email) {
  try {
    const response = await JIRA_API.get(`/rest/api/3/user/search?query=${email}`);
    if (response.data && response.data.length > 0) {
      const user = response.data.find(u => u.emailAddress === email);
      return user.accountId;
    }
    return null;
  } catch (error) {
    console.error('Error fetching Jira account ID:', error.response ? error.response.data : error.message);
    return null;
  }
}


/**
 * Step 1: Calls Groq to generate a list of onboarding tasks.
 */
async function generateTasks(internPrompt) {
  // ... (This function is perfect, no changes) ...
  console.log('Calling Groq API...');
  
  const systemPrompt = `You are a Senior SWE creating an onboarding plan. Generate a JSON object with a single key "tasks" which is an array of 8 step-by-step Jira task summaries for a new 'SWE Intern' who needs to learn the Google Cloud Console.

The tasks must guide them through this flow:
1. Gaining access to the development project.
2. Learning about IAM roles and permissions.
3. Deploying a sample 'hello-world' service (like on Cloud Run).
4. Viewing the logs for that new service in Cloud Logging.

Return **only** the JSON object. Do not include markdown.
Each object in the array should have one key: "task".
Example: {"tasks": [{"task": "1. Log in to GCP..."}]}
`;

  try {
    const completion = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant", // Use the new fast Groq model
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here is the prompt: ${internPrompt}` }
      ],
    });

    const result = completion.choices[0].message.content;
    console.log('Groq response:', result);
    
    const tasksObject = JSON.parse(result);

    if (Array.isArray(tasksObject.tasks)) {
      return tasksObject.tasks.map(task => task.task); // Get the description
    }
    
    throw new Error('AI response "tasks" is not a valid array.');

  } catch (error) {
    console.error('Error calling Groq:', error);
    throw new Error('Failed to generate tasks from Groq');
  }
}

/**
 * Step 2: Creates a new Epic and sub-tasks in Jira.
 */
async function createJiraWorkflow(tasks, intern, assigneeAccountId) { // <-- Added assigneeAccountId
  const JIRA_PROJECT_KEY = process.env.JIRA_PROJECT_KEY;
  console.log(`Provisioning Jira tasks for project: ${JIRA_PROJECT_KEY}`);

  try {
    // === 1. GET JIRA ISSUE TYPE IDs ===
    console.log('Fetching Jira metadata for issue types...');
    const metaResponse = await JIRA_API.get(`/rest/api/3/issue/createmeta?projectKeys=${JIRA_PROJECT_KEY}&expand=projects.issuetypes`);
    
    const issueTypes = metaResponse.data.projects[0].issuetypes;
    const epicIssueType = issueTypes.find(issue => issue.name === 'Epic');
    const taskIssueType = issueTypes.find(issue => issue.name === 'Task');
    
    if (!epicIssueType) throw new Error('Could not find "Epic" issue type in your Jira project. Check project settings.');
    if (!taskIssueType) throw new Error('Could not find "Task" issue type in your Jira project. Check project settings.');
    
    console.log(`Found Epic ID: ${epicIssueType.id}, Task ID: ${taskIssueType.id}`);

    // === 2. CREATE THE PARENT EPIC ===
    console.log('Creating parent Epic...');
    const epicPayload = {
      fields: {
        project: { key: JIRA_PROJECT_KEY },
        summary: `Onboarding: ${intern.name} - GCloud Training`,
        description: {
          type: "doc",
          version: 1,
          content: [{
            type: "paragraph",
            content: [{ type: "text", text: `Automated onboarding plan for ${intern.name} (${intern.email}).` }]
          }]
        },
        issuetype: { id: epicIssueType.id },
        assignee: assigneeAccountId ? { accountId: assigneeAccountId } : null // <-- (NEW) Assign the epic
      }
    };

    const epicResponse = await JIRA_API.post('/rest/api/3/issue', epicPayload);
    const parentEpicKey = epicResponse.data.key;
    const parentEpicUrl = `${process.env.JIRA_BASE_URL}/browse/${parentEpicKey}`;
    console.log(`Parent Epic created: ${parentEpicUrl}`);

    // === 3. CREATE ALL THE SUB-TASKS ===
    console.log(`Creating ${tasks.length} sub-tasks...`);
    
    const taskCreationPromises = [];

    for (const taskDescription of tasks) {
      if (!taskDescription) {
        console.warn('Skipping an undefined task.');
        continue; 
      }

      const taskPayload = {
        fields: {
          project: { key: JIRA_PROJECT_KEY },
          summary: taskDescription,
          issuetype: { id: taskIssueType.id },
          parent: { key: parentEpicKey },
          assignee: assigneeAccountId ? { accountId: assigneeAccountId } : null // <-- (NEW) Assign the sub-task
        }
      };
      
      taskCreationPromises.push(
        JIRA_API.post('/rest/api/3/issue', taskPayload)
          .then(res => console.log(`Created task: ${res.data.key}`))
          .catch(err => console.error(`Failed to create sub-task: ${taskDescription}`, err.response ? err.response.data.errors : err.message))
      );
    }
    
    await Promise.all(taskCreationPromises);
    console.log('All sub-tasks creation complete.');

    // We removed the failing invite code.
    
    return parentEpicUrl;

  } catch (error) {
    console.error('Error creating Jira workflow:', error.response ? JSON.stringify(error.response.data, null, 2) : error.message);
    throw new Error('Failed to create Jira workflow.');
  }
}


/**
 * Step 3: Creates a .ics calendar event file as a string.
 */
function createCalendarEvents(internName, internEmail) {
  // ... (This function is perfect, no changes) ...
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const [year, month, day] = [tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate()];

  const event = {
    title: `Welcome to the Team, ${internName}!`,
    description: 'Your first-day welcome sync and GCloud overview.',
    start: [year, month, day, 10, 0], // Starts at 10:00 AM
    duration: { minutes: 30 },
    status: 'CONFIRMED',
    organizer: { name: 'Your Manager', email: process.env.SENDER_EMAIL },
    attendees: [
      { name: internName, email: internEmail, rsvp: true, partstat: 'NEEDS-ACTION' }
    ]
  };

  const { error, value } = ics.createEvent(event);
  if (error) {
    console.error('Error creating ICS file:', error);
    throw error;
  }
  return value;
}


/**
 * Step 4: Sends the welcome email with the .ics file as an attachment
 */
async function sendWelcomeEmail(internEmail, payload) {
  // ... (This function is perfect, no changes) ...
  const { internName, jiraEpicUrl, extensionLink, calendarInvite } = payload;
  
  const icsAttachment = Buffer.from(calendarInvite).toString('base64');

  const msg = {
    to: internEmail,
    from: process.env.SENDER_EMAIL,
    subject: `Welcome to the Team, ${internName}! Your Onboarding Plan is Ready.`,
    html: `
      <h1>Welcome, ${internName}!</h1>
      <p>We're excited to have you on the team. We've created a personalized onboarding plan to get you started with the Google Cloud Console.</p>
      
      <h3>Your Onboarding Plan:</h3>
      <p>Your tasks are ready in Jira. Click the link below to see your board:</p>
      <a href="${jiraEpicUrl}" style="padding: 10px 15px; background-color: #0052cc; color: white; text-decoration: none; border-radius: 3px;">
        Go to Your Jira Board
      </a>
      
      <h3>Your First Meeting:</h3>
      <p>I've attached a calendar invite for our welcome sync. Please add it to your calendar.</p>
      
      <h3>Your AI Assistant:</h3>
      <p>To get the most out of your training, please download our Assistive AI Extension. It will guide you through your tasks directly in GCP.</p>
      <a href="${extensionLink}">Download the Extension Here</a>
      
      <p>We'll see you soon!</p>
    `,
    attachments: [
      {
        content: icsAttachment,
        filename: 'welcome-sync.ics',
        type: 'text/calendar',
        disposition: 'attachment'
      }
    ]
  };

  try {
    await sgMail.send(msg);
    console.log(`Email sent to ${internEmail}`);
  } catch (error) {
    console.error('Error sending email via SendGrid:', error);
    if (error.response) {
      console.error(error.response.body);
    }
    throw error;
  }
}


// Start the server
app.listen(port, () => {
  console.log(`Onboarding server running at http://localhost:${port}`);
});