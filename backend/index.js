// Import all your libraries
const express = require('express');
const { OpenAI } = require('openai');
const sgMail = require('@sendgrid/mail');
const axios = require('axios');
const ics = require('ics');
const cors = require('cors');
require('dotenv').config();

// --- CONFIGURE YOUR CLIENTS ---
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman) or from allowed origins or chrome extensions
    if (!origin || origin.startsWith('http://localhost') || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Groq Client (using the OpenAI library)
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY, // Use the Groq key
  baseURL: 'https://api.groq.com/openai/v1', // Point to Groq's servers
});

// SendGrid Client
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Track active onboarding sessions (in-memory, keyed by intern email)
const activeSessions = new Map();

// Track extension usage and link clicks
const usageTracking = new Map(); // keyed by intern email or tracking ID

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
WORKFLOW DAG GENERATION ENDPOINT (LLM-powered visualization)
================================================================================
*/
app.post('/generate-workflow-dag', async (req, res) => {
  console.log('Received workflow DAG generation request...');
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).send({ error: 'Missing prompt.' });
  }

  try {
    console.log(`Generating workflow DAG for: ${prompt}`);
    const workflow = await generateWorkflowDAG(prompt);
    console.log('Workflow DAG generated:', workflow);

    res.status(200).send({
      workflow: workflow,
      message: 'Workflow DAG generated successfully!'
    });

  } catch (error) {
    console.error('Full error stack:', error);
    res.status(500).send({ error: 'Workflow DAG generation failed.', details: error.message });
  }
});

/*
================================================================================
THE MAIN ONBOARDING ENDPOINT (with real-time progress streaming)
================================================================================
*/
app.post('/onboard', async (req, res) => {
  console.log('Received onboarding request...');
  const { prompt, intern } = req.body;

  if (!prompt || !intern || !intern.email || !intern.name) {
    return res.status(400).send({ error: 'Missing prompt, intern name, or intern email.' });
  }

  // Set up Server-Sent Events for real-time progress
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const sendProgress = (step, status, data = {}) => {
    res.write(`data: ${JSON.stringify({ step, status, ...data })}\n\n`);
  };

  // Store session for extension notification
  const sessionData = {
    sendProgress,
    intern,
    res
  };
  activeSessions.set(intern.email, sessionData);

  try {
    // STEP 1: AI Analyzing
    sendProgress('analyzing', 'running', { message: 'AI analyzing company needs and use cases...' });
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate thinking time
    sendProgress('analyzing', 'completed', { message: 'Analysis complete!' });

    // STEP 2: Generating Jira Tasks
    sendProgress('generating', 'running', { message: 'AI generating personalized onboarding tasks...' });

    console.log(`Fetching Jira account ID for demo assignee: ${process.env.JIRA_USER_EMAIL}`);
    const assigneeAccountId = await getJiraAccountId(process.env.JIRA_USER_EMAIL);
    if (!assigneeAccountId) {
      console.warn("Could not find demo user's account ID. Tasks will be unassigned.");
    }

    console.log(`Generating workflow DAG for: ${prompt}`);
    const workflow = await generateWorkflowDAG(prompt);
    console.log('Workflow DAG generated:', workflow);

    const tasks = workflow.nodes.map(node => {
      return `[${node.type.toUpperCase()}] ${node.name} - ${node.description} (Est: ${node.estimatedDuration})`;
    });
    console.log('Tasks extracted from workflow:', tasks);

    console.log('Provisioning Jira...');
    const jiraEpicUrl = await createJiraWorkflow(tasks, intern, assigneeAccountId, workflow);
    console.log(`Jira Epic URL: ${jiraEpicUrl}`);
    
    // Store tracking data with website configuration for extension
    usageTracking.set(intern.email, {
      internEmail: intern.email,
      internName: intern.name,
      websiteConfig: generateWebsiteConfig(workflow),
      extensionActivated: false,
      createdAt: new Date()
    });
    
    console.log(`Extension config stored for ${intern.email}`);

    sendProgress('generating', 'completed', {
      message: `Created ${tasks.length} Jira tasks!`,
      jiraEpicUrl: jiraEpicUrl,
      taskCount: tasks.length
    });

    // STEP 3: Sending to Intern
    sendProgress('sending', 'running', { message: `Sending welcome email to ${intern.email}...` });

    console.log('Generating .ics calendar invites...');
    const welcomeEvent = createCalendarEvents(intern.name, intern.email);
    console.log('Calendar invites created.');

    // Create extension activation link with intern's email
    const extensionActivationLink = `chrome-extension://YOUR_EXTENSION_ID/activate.html?email=${encodeURIComponent(intern.email)}`;

    const emailPayload = {
      internName: intern.name,
      jiraEpicUrl: jiraEpicUrl,
      extensionLink: extensionActivationLink,
      calendarInvite: welcomeEvent,
      workflow: workflow,
    };

    await sendWelcomeEmail(intern.email, emailPayload);
    console.log('Email sent!');

    sendProgress('sending', 'completed', {
      message: `Email sent to ${intern.email}!`,
      emailSent: true
    });

    // STEP 4: Intern Opening Training
    // Wait for extension to notify us - don't close the stream yet
    sendProgress('opened', 'running', { message: 'Waiting for intern to open training extension...' });

    // NOTE: The stream stays open. When the extension notifies via /extension-opened,
    // it will send the 'opened' completed event and continue the flow.
    // For now, we don't proceed automatically - extension must signal.

  } catch (error) {
    console.error('Error in onboarding flow:', error);
    sendProgress('error', 'failed', {
      message: error.message,
      error: error.message
    });
    activeSessions.delete(intern.email);
    res.write(`data: ${JSON.stringify({
      step: 'error',
      status: 'failed',
      error: error.message
    })}\n\n`);

    res.end();
  }
});

/*
================================================================================
EXTENSION NOTIFICATION ENDPOINT
================================================================================
*/
app.post('/extension-opened', (req, res) => {
  const { internEmail } = req.body;

  if (!internEmail) {
    return res.status(400).json({ error: 'Missing internEmail' });
  }

  const session = activeSessions.get(internEmail);

  if (!session) {
    return res.status(404).json({ error: 'No active onboarding session found for this intern' });
  }

  const { sendProgress, intern, res: sseRes } = session;

  // Send the "opened" completed event
  sendProgress('opened', 'completed', {
    message: `${intern.name} has opened the training extension!`
  });

  // STEP 5: Onboarded
  setTimeout(async () => {
    try {
      sendProgress('onboarded', 'completed', {
        message: `${intern.name} is now onboarded!`
      });

      // Final message and close stream
      sseRes.write(`data: ${JSON.stringify({
        step: 'done',
        status: 'completed'
      })}\n\n`);

      sseRes.end();
      activeSessions.delete(internEmail);
    } catch (error) {
      console.error('Error completing onboarding:', error);
    }
  }, 1000);

  res.json({ success: true, message: 'Extension opened notification received' });
});

/*
================================================================================
HELPER FUNCTIONS
================================================================================
*/

/**
 * Generates a workflow DAG (Directed Acyclic Graph) from a text prompt
 * Returns structured data with nodes and edges for visualization
 */
async function generateWorkflowDAG(prompt) {
  console.log('Calling Groq API for DAG generation...');

  const systemPrompt = `You are an onboarding workflow architect. Generate a DAG (Directed Acyclic Graph) representing an onboarding workflow.

Create 6-10 sequential and parallel tasks with clear dependencies. Return ONLY valid JSON with this exact structure:

{
  "nodes": [
    {
      "id": "step_1",
      "name": "Short descriptive name",
      "type": "access|learning|hands-on|review",
      "description": "Detailed task description",
      "estimatedDuration": "30min",
      "status": "pending"
    }
  ],
  "edges": [
    {
      "from": "step_1",
      "to": "step_2",
      "status": "pending"
    }
  ],
  "metadata": {
    "totalSteps": 8,
    "estimatedTotalTime": "4hrs"
  }
}

Node types:
- "access": Setup, permissions, account creation
- "learning": Reading docs, watching tutorials, understanding concepts
- "hands-on": Practical exercises, building something, deploying
- "review": Checkpoints, quizzes, manager reviews

Rules:
1. IDs must be unique (step_1, step_2, etc.)
2. Create logical dependencies (edges) - no circular dependencies
3. Tasks should progress: access → learning → hands-on → review
4. Some tasks can run in parallel if they don't depend on each other
5. Use realistic time estimates (15min, 30min, 1hr, 2hrs)
6. ALWAYS include at least one very short (10-15min) task related to Google Cloud Console exploration or setup
7. Return ONLY the JSON object, no markdown, no extra text`;

  try {
    const completion = await openai.chat.completions.create({
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Generate an onboarding workflow for: ${prompt}` }
      ],
    });

    const result = completion.choices[0].message.content;
    console.log('Groq DAG response:', result);

    const workflow = JSON.parse(result);

    // Validate structure
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      throw new Error('Invalid workflow structure: missing nodes array');
    }
    if (!workflow.edges || !Array.isArray(workflow.edges)) {
      throw new Error('Invalid workflow structure: missing edges array');
    }

    // Ensure there's always a Google Cloud Console task
    const hasGCPConsoleTask = workflow.nodes.some(node =>
      node.name.toLowerCase().includes('google cloud console') ||
      node.name.toLowerCase().includes('gcp console') ||
      node.description.toLowerCase().includes('google cloud console')
    );

    if (!hasGCPConsoleTask) {
      console.log('No GCP Console task found, adding one...');

      // Add a GCP Console exploration task
      const gcpConsoleTask = {
        id: `gcp_console_${Date.now()}`,
        name: 'Explore Google Cloud Console',
        type: 'learning',
        description: 'Quick tour of the Google Cloud Console interface and key navigation areas',
        estimatedDuration: '10min',
        status: 'pending'
      };

      // Add it as the second task (after initial setup/access)
      workflow.nodes.splice(1, 0, gcpConsoleTask);

      // Update edges to include the new task in the flow
      if (workflow.nodes.length >= 3) {
        // Connect first node to GCP Console task
        workflow.edges.push({
          from: workflow.nodes[0].id,
          to: gcpConsoleTask.id,
          status: 'pending'
        });

        // Connect GCP Console task to next node
        workflow.edges.push({
          from: gcpConsoleTask.id,
          to: workflow.nodes[2].id,
          status: 'pending'
        });

        // Remove old direct edge if it exists
        workflow.edges = workflow.edges.filter(edge =>
          !(edge.from === workflow.nodes[0].id && edge.to === workflow.nodes[2].id)
        );
      }

      // Update metadata
      if (workflow.metadata) {
        workflow.metadata.totalSteps = workflow.nodes.length;
      }
    }

    return workflow;

  } catch (error) {
    console.error('Error calling Groq for DAG generation:', error);
    throw new Error('Failed to generate workflow DAG from Groq');
  }
}

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
 * Helper: Get starting URL based on task name/type
 */
function getStartingUrl(taskDescription) {
  const lowerTask = taskDescription.toLowerCase();

  // Check for specific keywords and return relevant URLs
  if (lowerTask.includes('google cloud console') || lowerTask.includes('gcp console')) {
    return 'https://console.cloud.google.com/';
  }
  if (lowerTask.includes('kubernetes') || lowerTask.includes('gke')) {
    return 'https://console.cloud.google.com/kubernetes/';
  }
  if (lowerTask.includes('cloud storage') || lowerTask.includes('gcs')) {
    return 'https://console.cloud.google.com/storage/';
  }
  if (lowerTask.includes('bigquery')) {
    return 'https://console.cloud.google.com/bigquery/';
  }
  if (lowerTask.includes('cloud functions')) {
    return 'https://console.cloud.google.com/functions/';
  }
  if (lowerTask.includes('cloud run')) {
    return 'https://console.cloud.google.com/run/';
  }
  if (lowerTask.includes('firestore')) {
    return 'https://console.cloud.google.com/firestore/';
  }
  if (lowerTask.includes('billing')) {
    return 'https://console.cloud.google.com/billing/';
  }
  if (lowerTask.includes('iam') || lowerTask.includes('permissions')) {
    return 'https://console.cloud.google.com/iam-admin/';
  }

  // Default to GCP Console home
  return 'https://console.cloud.google.com/';
}

/**
 * Step 2: Creates a new Epic and sub-tasks in Jira.
 */
async function createJiraWorkflow(tasks, intern, assigneeAccountId, workflow = null) { // <-- Added workflow parameter
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

    // Build epic description with workflow metadata
    const epicDescription = {
      type: "doc",
      version: 1,
      content: [
        {
          type: "paragraph",
          content: [{
            type: "text",
            text: `Automated onboarding plan for ${intern.name} (${intern.email}).`
          }]
        }
      ]
    };

    // Add workflow metadata if available
    if (workflow && workflow.metadata) {
      epicDescription.content.push({
        type: "paragraph",
        content: [{ type: "text", text: "" }]
      });
      epicDescription.content.push({
        type: "paragraph",
        content: [{
          type: "text",
          text: `Total Steps: ${workflow.metadata.totalSteps} | Estimated Time: ${workflow.metadata.estimatedTotalTime}`,
          marks: [{ type: "strong" }]
        }]
      });
    }

    const epicPayload = {
      fields: {
        project: { key: JIRA_PROJECT_KEY },
        summary: `Onboarding: ${intern.name} - Workflow`,
        description: epicDescription,
        issuetype: { id: epicIssueType.id },
        assignee: assigneeAccountId ? { accountId: assigneeAccountId } : null
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

      // Get relevant starting URL
      const startingUrl = getStartingUrl(taskDescription);

      const taskPayload = {
        fields: {
          project: { key: JIRA_PROJECT_KEY },
          summary: taskDescription,
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{
                  type: "text",
                  text: "Start here: ",
                  marks: [{ type: "strong" }]
                }]
              },
              {
                type: "paragraph",
                content: [{
                  type: "text",
                  text: startingUrl,
                  marks: [{
                    type: "link",
                    attrs: { href: startingUrl }
                  }]
                }]
              }
            ]
          },
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
  const { internName, jiraEpicUrl, extensionLink, calendarInvite, workflow } = payload;

  const icsAttachment = Buffer.from(calendarInvite).toString('base64');

  // Build workflow summary for email
  let workflowSummary = '';
  if (workflow && workflow.nodes) {
    const stepsList = workflow.nodes.map((node, index) => {
      return `<li><strong>${node.name}</strong> (${node.estimatedDuration})<br/><span style="color: #666;">${node.description}</span></li>`;
    }).join('');

    workflowSummary = `
      <h3>Your Onboarding Journey:</h3>
      <p>We've created a personalized ${workflow.metadata?.totalSteps || workflow.nodes.length}-step onboarding plan for you.
      Estimated completion time: <strong>${workflow.metadata?.estimatedTotalTime || 'varies'}</strong></p>
      <ol style="line-height: 1.8;">
        ${stepsList}
      </ol>
    `;
  }

  const msg = {
    to: internEmail,
    from: process.env.SENDER_EMAIL,
    subject: `Welcome to the Team, ${internName}! Your Onboarding Plan is Ready 🚀`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #0052cc;">Welcome, ${internName}! 👋</h1>
        <p style="font-size: 16px; line-height: 1.6;">
          We're excited to have you on the team! We've created a personalized onboarding plan just for you.
        </p>

        ${workflowSummary}

        <h3 style="color: #0052cc; margin-top: 30px;">📋 Your Jira Board:</h3>
        <p>All your tasks are ready and waiting in Jira. Click below to get started:</p>
        <a href="${jiraEpicUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0052cc; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0;">
          View Your Onboarding Board
        </a>

        <h3 style="color: #0052cc; margin-top: 30px;">📅 Your First Meeting:</h3>
        <p>I've attached a calendar invite for our welcome sync. Please add it to your calendar and we'll see you there!</p>

        <h3 style="color: #0052cc; margin-top: 30px;">🤖 Your AI Assistant:</h3>
        <p>To get the most out of your training, download our AI Chrome Extension. It will guide you through your tasks step-by-step!</p>
        <a href="${extensionLink}" style="color: #0052cc; text-decoration: none; font-weight: bold;">Download the Extension Here →</a>

        <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />

        <p style="color: #666; font-size: 14px;">
          Questions? Just reply to this email. We're here to help!<br/>
          Looking forward to working with you! 🎉
        </p>
      </div>
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
/*
================================================================================
EXTENSION TRACKING & CONFIGURATION ENDPOINTS
================================================================================
*/

// Extension usage tracking - detects when AI coach is being used
app.post('/track/extension-usage', async (req, res) => {
  const { internEmail, event, website, step, timestamp } = req.body;
  
  console.log(`🤖 Extension event: ${event} for ${internEmail} on ${website}`);
  
  // Get tracking data
  const tracking = usageTracking.get(internEmail);
  
  if (!tracking) {
    return res.status(404).json({ 
      error: 'Intern not found. Please complete onboarding setup first.' 
    });
  }
  
  // Log the event
  tracking.extensionEvents = tracking.extensionEvents || [];
  tracking.extensionEvents.push({
    event,
    website,
    step,
    timestamp: timestamp || new Date()
  });
  
  // If this is the FIRST extension usage, mark as activated
  if (!tracking.extensionActivated && event === 'extension_activated') {
    tracking.extensionActivated = true;
    tracking.firstActivationAt = new Date();
    
    const session = activeSessions.get(internEmail);
    if (session && session.sendProgress) {
      session.sendProgress('opened', 'completed', {
        message: `${tracking.internName} is using the AI Coach!`,
        extensionActivated: true
      });
    }
  }
  
  // Track when training is completed
  if (event === 'training_completed') {
    const session = activeSessions.get(internEmail);
    if (session && session.sendProgress) {
      session.sendProgress('onboarded', 'completed', {
        message: `${tracking.internName} completed onboarding!`
      });
    }
  }
  
  res.json({ success: true, tracked: true });
});

// Get extension configuration for an intern
app.get('/extension/config/:internEmail', async (req, res) => {
  const { internEmail } = req.params;
  
  const tracking = usageTracking.get(internEmail);
  
  if (!tracking || !tracking.websiteConfig) {
    return res.status(404).json({ 
      error: 'No configuration found for this intern' 
    });
  }
  
  res.json({
    success: true,
    internName: tracking.internName,
    config: tracking.websiteConfig
  });
});

/**
 * Generate website configuration from workflow
 * Returns a dictionary: { website_url: [subtasks] }
 */
function generateWebsiteConfig(workflow) {
  const config = {};
  
  if (!workflow || !workflow.nodes) {
    return config;
  }
  
  // Group tasks by website/URL
  workflow.nodes.forEach(node => {
    // Extract website from metadata or default
    const website = node.metadata?.url || node.metadata?.website || 'https://console.cloud.google.com/*';
    
    if (!config[website]) {
      config[website] = [];
    }
    
    config[website].push({
      id: node.id,
      name: node.name,
      description: node.description,
      type: node.type,
      estimatedDuration: node.estimatedDuration,
      keywords: node.metadata?.keywords || []
    });
  });
  
  return config;
}

app.listen(port, () => {
  console.log(`Onboarding server running at http://localhost:${port}`);
});