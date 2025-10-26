// Import all your libraries
const express = require('express');
const { OpenAI } = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const sgMail = require('@sendgrid/mail');
const axios = require('axios');
const ics = require('ics');
const cors = require('cors');
require('dotenv').config();

// --- CONFIGURE YOUR CLIENTS ---
const app = express();
const port = process.env.PORT || 3000;
app.use(express.json({ limit: '100mb' })); // Increase limit for screenshots
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin or from allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'https://console.cloud.google.com'
    ];
    
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, true); // Allow anyway for development
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Groq Client (using the OpenAI library) - for text generation
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY, // Use the Groq key
  baseURL: 'https://api.groq.com/openai/v1', // Point to Groq's servers
});

// Gemini Client - for vision analysis
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// SendGrid Client
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Track active onboarding sessions (in-memory, keyed by intern email)
const activeSessions = new Map();

// Track extension usage and link clicks
const usageTracking = new Map(); // keyed by intern email or tracking ID

// Track workflow states for polling (in case SSE closes)
const workflowStates = new Map(); // keyed by intern email

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
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

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
  console.log(`📝 Stored session for: ${intern.email}`);
  
  // Keep-alive to prevent timeout
  const keepAliveInterval = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 15000); // Send keep-alive every 15 seconds
  
  // Clean up on connection close
  req.on('close', () => {
    clearInterval(keepAliveInterval);
    activeSessions.delete(intern.email);
    console.log(`🔌 Client disconnected: ${intern.email}`);
  });

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
    
    // Store tracking data with task configurations for extension
    const taskConfigs = generateTaskConfigs(workflow);
    usageTracking.set(intern.email, {
      internEmail: intern.email,
      internName: intern.name,
      taskConfigs: taskConfigs, // Store task configs by platform
      websiteConfig: generateWebsiteConfig(workflow), // Keep for backwards compatibility
      extensionActivated: false, // State: 0 (not started)
      trainingInProgress: false, // State: 0 (not in progress)
      trainingCompleted: false,  // State: 0 (not completed)
      createdAt: new Date()
    });
    
    // IMPORTANT: Reset completion status for this email when generating new workflow
    if (onboardingCompletions.has(intern.email)) {
      console.log(`🔄 Resetting completion status for ${intern.email} (new workflow generated)`);
      onboardingCompletions.delete(intern.email);
    }

    console.log(`Extension config stored for ${intern.email}`);
    console.log(`Task configs:`, Object.keys(taskConfigs));

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
    // This redirects to Google Console with email in URL so extension can pick it up
    const extensionActivationLink = `http://localhost:${port}/activate?email=${encodeURIComponent(intern.email)}`;

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

    // STEP 4: Onboarding setup ready - keep as pending until intern completes tasks
    // Don't send any progress update - leave the node in pending state
    // It will only turn green when the frontend detects completion via polling

    // Close the SSE connection
    clearInterval(keepAliveInterval);
    res.write(`data: ${JSON.stringify({
      step: 'done',
      status: 'completed',
      jiraEpicUrl: jiraEpicUrl
    })}\n\n`);
    res.end();
    activeSessions.delete(intern.email);

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

Create EXACTLY 1 task (for demo purposes). The task should be VERY FOCUSED, QUICK (5 minutes max), and SIMPLE. Return ONLY valid JSON with this exact structure:

{
  "nodes": [
    {
      "id": "step_1",
      "name": "Short descriptive name",
      "type": "access|learning|hands-on|review",
      "description": "High-level task goal",
      "subInstructions": [
        "First specific action to take",
        "Second specific action to take",
        "Third specific action to take"
      ],
      "estimatedDuration": "5min",
      "status": "pending"
    }
  ],
  "edges": [],
  "metadata": {
    "totalSteps": 1,
    "estimatedTotalTime": "5min"
  }
}

Node types:
- "access": Setup, permissions, account creation
- "learning": Reading docs, watching tutorials, understanding concepts (PREFERRED - use 80% of the time)
- "hands-on": Practical exercises, building something, deploying
- "review": Checkpoints, quizzes, manager reviews

CRITICAL RULES:
1. Create EXACTLY 1 task (for demo purposes)
2. ID must be "step_1"
3. Task must be VERY SPECIFIC and FOCUSED based on the user's prompt
4. Estimated duration: 5 minutes maximum
5. STRONGLY PREFER exploration/navigation tasks over creation tasks:
   - ✅ GOOD: "Explore the IAM page", "Navigate to Cloud Run", "View the API library"
   - ❌ AVOID: "Create a project", "Deploy a service", "Build an application"
   - Only create/build tasks if the user explicitly requests them
6. The task must have EXACTLY 4-5 ORDERED sub-instructions that are:
   - SPECIFIC to the user's requested workflow/goal
   - ACTIONABLE with clear UI instructions
   - SEQUENTIAL - user follows them one by one
   - Use accurate Google Cloud Console UI paths when applicable
   - Focus on NAVIGATION and EXPLORATION, not creation
7. No edges array needed (empty array)
8. Return ONLY the JSON object, no markdown, no extra text
9. DO NOT include sign-in, login, or authentication steps - assume user is already logged in

IMPORTANT - Use ACCURATE Google Cloud Console UI instructions when creating steps:
- To create a project: "Click the project dropdown at the top (next to 'Google Cloud')" → "Click 'NEW PROJECT'" → "Enter project name and click 'CREATE'"
- To access IAM: "Click the hamburger menu (☰) in top-left" → "Click 'IAM & Admin'" → "Click 'IAM'"
- To access Cloud Run: "Click the hamburger menu (☰)" → "Find and click 'Cloud Run'"
- To view logs: "Click the hamburger menu (☰)" → "Click 'Logging'" → "Click 'Logs Explorer'"
- For APIs: "Click the hamburger menu (☰)" → "Click 'APIs & Services'" → "Click 'Library'"
- For Compute Engine: "Click the hamburger menu (☰)" → "Click 'Compute Engine'" → "Click 'VM instances'"

Generate sub-instructions that match the user's goal. Keep it simple, focused, and achievable in 5 minutes.`;

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
  
  const systemPrompt = `You are a Senior SWE creating an onboarding plan. Generate a JSON object with a single key "tasks" which is an array of EXACTLY 1 FOCUSED task for a new 'SWE Intern'.

CRITICAL REQUIREMENTS:
- Create ONLY 1 task (not 8)
- Task must be VERY SPECIFIC and FOCUSED based on the user's prompt
- Task should take 5 minutes maximum
- Task must be SIMPLE and ACHIEVABLE quickly
- Task description should be clear and actionable
- STRONGLY PREFER exploration/navigation tasks over creation tasks (80% of the time):
  * ✅ GOOD: "Explore the IAM & Admin section", "Navigate to Cloud Run and view services", "Browse the API library"
  * ❌ AVOID: "Create a new project", "Deploy an application", "Set up infrastructure"
  * Only suggest creation tasks if the user explicitly requests them
- DO NOT include sign-in, login, or authentication steps - assume user is already logged in

IMPORTANT - Use ACCURATE Google Cloud Console UI instructions when applicable:
- To create a new GCP project: Click the project dropdown at the top (next to "Google Cloud"), then click "NEW PROJECT" button
- The project creation form has: Project name, Organization (optional), Location (optional), then "CREATE" button
- There is NO "region" field in project creation - regions are selected when creating resources
- IAM is accessed via the hamburger menu → "IAM & Admin" → "IAM"
- Cloud Run is accessed via hamburger menu → "Cloud Run"
- Logs are in hamburger menu → "Logging" → "Logs Explorer"
- APIs are in hamburger menu → "APIs & Services" → "Library"
- Compute Engine is in hamburger menu → "Compute Engine" → "VM instances"

Generate a task that matches the user's requested workflow/goal.

Return **only** the JSON object. Do not include markdown.
The array should have EXACTLY 1 object with one key: "task".
Example: {"tasks": [{"task": "Set up your first Cloud Run service"}]}
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

    // Create a specific, actionable Epic title based on workflow content
    let epicTitle = `${intern.name}'s Onboarding`;
    
    if (workflow && workflow.nodes && workflow.nodes.length > 0) {
      // Extract key activities from the workflow nodes
      const activities = workflow.nodes
        .map(node => node.name || node.description)
        .filter(Boolean)
        .slice(0, 2); // Take first 2 activities for brevity
      
      if (activities.length > 0) {
        // Create actionable title like "John's Onboarding: Set up GCP Project & Deploy Cloud Run Service"
        epicTitle = `${intern.name}'s Onboarding: ${activities.join(' & ')}`;
      }
    }
    
    const epicPayload = {
      fields: {
        project: { key: JIRA_PROJECT_KEY },
        summary: epicTitle,
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
    console.log(`Creating ${workflow.nodes.length} sub-tasks...`);

    const taskCreationPromises = [];

    for (const node of workflow.nodes) {
      if (!node) {
        console.warn('Skipping an undefined node.');
        continue;
      }

      // Get task description and starting URL
      const taskSummary = `[${node.type.toUpperCase()}] ${node.name} - ${node.description} (Est: ${node.estimatedDuration})`;
      const startingUrl = getStartingUrl(node.description);

      // Create activation link that redirects to the task URL with email parameter
      const activationLink = `http://localhost:${port}/activate?email=${encodeURIComponent(intern.email)}&target=${encodeURIComponent(startingUrl)}`;

      // Build description content with sub-instructions
      const descriptionContent = [
        {
          type: "paragraph",
          content: [{
            type: "text",
            text: "🚀 Start this task with AI guidance: ",
            marks: [{ type: "strong" }]
          }]
        },
        {
          type: "paragraph",
          content: [{
            type: "text",
            text: "Click here to begin",
            marks: [{
              type: "link",
              attrs: { href: activationLink }
            }, { type: "strong" }]
          }]
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "" }]
        }
      ];

      // Add sub-instructions if available
      if (node.subInstructions && node.subInstructions.length > 0) {
        descriptionContent.push({
          type: "paragraph",
          content: [{
            type: "text",
            text: "📋 Step-by-step instructions:",
            marks: [{ type: "strong" }]
          }]
        });

        // Add ordered list of sub-instructions
        descriptionContent.push({
          type: "orderedList",
          content: node.subInstructions.map(instruction => ({
            type: "listItem",
            content: [{
              type: "paragraph",
              content: [{
                type: "text",
                text: instruction
              }]
            }]
          }))
        });

        descriptionContent.push({
          type: "paragraph",
          content: [{ type: "text", text: "" }]
        });
      }

      // Add direct navigation link
      descriptionContent.push({
        type: "paragraph",
        content: [{
          type: "text",
          text: "Or navigate directly to: ",
          marks: [{ type: "em" }]
        }]
      });
      descriptionContent.push({
        type: "paragraph",
        content: [{
          type: "text",
          text: startingUrl,
          marks: [{
            type: "link",
            attrs: { href: startingUrl }
          }]
        }]
      });

      const taskPayload = {
        fields: {
          project: { key: JIRA_PROJECT_KEY },
          summary: taskSummary,
          description: {
            type: "doc",
            version: 1,
            content: descriptionContent
          },
          issuetype: { id: taskIssueType.id },
          parent: { key: parentEpicKey },
          assignee: assigneeAccountId ? { accountId: assigneeAccountId } : null
        }
      };
      
      taskCreationPromises.push(
        JIRA_API.post('/rest/api/3/issue', taskPayload)
          .then(res => console.log(`Created task: ${res.data.key}`))
          .catch(err => console.error(`Failed to create sub-task: ${node.name}`, err.response ? err.response.data.errors : err.message))
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
AI ANALYSIS ENDPOINT
================================================================================
*/

// AI analyzes screenshot with cursor position and action history
app.post('/ai/analyze-screen', async (req, res) => {
  const { screenshot, currentTask, stepNumber, totalSteps, cursorPosition, actionHistory, url } = req.body;
  
  console.log(`🤖 AI Analysis Request - Step ${stepNumber}/${totalSteps}`);
  console.log(`📍 Cursor at (${cursorPosition.x}, ${cursorPosition.y})`);
  console.log(`📝 Recent actions:`, actionHistory.length);
  console.log(`📸 Screenshot length:`, screenshot ? screenshot.length : 'missing');
  console.log(`📸 Screenshot prefix:`, screenshot ? screenshot.substring(0, 50) : 'missing');

  try {
    // Build context from action history
    const historyContext = actionHistory.map(a =>
      `[${new Date(a.timestamp).toLocaleTimeString()}] ${a.action}: ${a.details} at cursor (${a.cursorPosition.x}, ${a.cursorPosition.y})`
    ).join('\n');

    // Check if user just clicked
    const recentClick = actionHistory.length > 0 && actionHistory[actionHistory.length - 1].action === 'click';
    const lastAction = actionHistory.length > 0 ? actionHistory[actionHistory.length - 1] : null;

    // Extract sub-instruction info
    const { currentSubInstruction, currentSubStepNumber, totalSubSteps, completedSubSteps } = req.body;
    
    // Create AI prompt with emphasis on cursor position and recent clicks
    const prompt = `You are an AI onboarding coach watching a user learn Google Cloud Platform.

OVERALL TASK (${stepNumber}/${totalSteps}):
"${currentTask}"

${currentSubInstruction ? `
🎯 CURRENT SUB-STEP (${currentSubStepNumber}/${totalSubSteps}):
"${currentSubInstruction}"

COMPLETED SUB-STEPS: ${completedSubSteps && completedSubSteps.length > 0 ? completedSubSteps.join(', ') : 'None yet'}
REMAINING SUB-STEPS: ${totalSubSteps - (completedSubSteps?.length || 0)}

CRITICAL: You are ONLY evaluating if the user completed THIS specific sub-step: "${currentSubInstruction}"
Do NOT mark any other sub-steps complete. Focus ONLY on sub-step ${currentSubStepNumber}.
` : ''}

CURRENT PAGE: ${url}

USER'S CURSOR POSITION: (${cursorPosition.x}, ${cursorPosition.y})

${recentClick ? `⚡ USER JUST CLICKED: ${lastAction.details}
IMPORTANT: Analyze if this click was correct for the current task. Did they click the right element?` : 'User is moving the cursor around.'}

RECENT USER ACTIONS (last 5):
${historyContext || 'No actions yet'}

SCREENSHOT: [Base64 image provided]

YOUR JOB:
1. **LOOK AT THE SCREENSHOT** - Identify what page/screen the user is currently on
2. **FIND THE CORRECT UI ELEMENT** - Locate where the user needs to click/interact for their current task
3. **GUIDE THEM THERE** - Tell them exactly where to look and what to click

For example:
- If they need to create a project: Look for the project dropdown at the top (usually says "Select a project" or shows current project name), tell them to click it, then look for "NEW PROJECT" button
- If they need to access IAM: Look for the hamburger menu (☰) on the left, tell them to click it and find "IAM & Admin"
- If they need Cloud Run: Look for the hamburger menu, tell them to find "Cloud Run" in the menu
- If they're on the wrong page: Tell them exactly how to navigate to the correct page

Analyze the screenshot and determine:
1. What page/screen is the user currently on?
2. Can you see the UI element they need to interact with? Where is it located?
3. Is the user's cursor near the correct element?
4. Has the user completed the current task based on what you see?
5. What SPECIFIC action should they take next? (e.g., "Click the hamburger menu in the top-left", "Click the blue 'NEW PROJECT' button")

Provide feedback that:
- Identifies what you see on screen
- Tells them WHERE to look (top-left, top-right, sidebar, etc.)
- Tells them WHAT to click (be specific about button text, icons, etc.)
- Is encouraging and helpful when they do the right thing (use words like "Good!", "Great!", "Perfect!", "Correct!")
- Is concise (max 2-3 sentences)

CRITICAL COMPLETION RULES - READ CAREFULLY:
- You can ONLY mark ONE step complete at a time - never mark multiple steps in one analysis
- ONLY mark a step complete when you see DEFINITIVE PROOF in the screenshot
- Use this EXACT format: "Great! Step [number] completed! [PROOF: describe what you see that proves completion]"
- MUST include: the word "step", an exclamation mark, AND proof of what you see

PROOF REQUIREMENTS - BE SPECIFIC:
- Look at the CURRENT sub-instruction the user is working on (the first incomplete one)
- Describe EXACTLY what you see in the screenshot that proves they completed it
- Examples of good proof:
  * "PROOF: I can see the project dropdown menu is now open with 'NEW PROJECT' button visible"
  * "PROOF: The NEW PROJECT dialog is displayed with input fields for project name"
  * "PROOF: The IAM page has loaded - I can see 'IAM' in the breadcrumb and the permissions table"
  * "PROOF: The hamburger menu is expanded showing the full service list"
  * "PROOF: The main dashboard is visible with metrics, charts, and key information displayed"

SPECIAL CASE - OBSERVATION/EXPLORATION STEPS:
- For steps like "Scan", "Take note of", "Observe", "Review", "Explore", "Examine", "Find":
  * Mark complete if the user is VIEWING or INTERACTING with the correct page/section
  * User can click around, expand items, or just view - all count as completion
  * BE LENIENT - if the step says "Explore A, B, C, and D", mark complete if they visit ANY of them
  * BE LENIENT - if the step says "e.g." or "for example", accept ANY similar resource/item
  * Examples of lenient completion:
    - Step: "Explore Compute, Storage, Networking, IAM" → Mark complete if they visit ANY of these sections
    - Step: "Find a resource (e.g., a VM instance)" → Accept ANY resource (VM, bucket, database, etc.)
    - Step: "Review the dashboard metrics" → Mark complete if they're viewing the dashboard
    - Step: "Take note of menu options" → Mark complete if menu is visible
    - Step: "Click on a service (e.g., Cloud Run)" → Accept ANY service they click
  * PROOF: Describe what page elements, data, or information you can see
  * Examples:
    - "PROOF: User is on IAM & Admin page, exploring one of the required sections"
    - "PROOF: User clicked on a Cloud Storage bucket, which is a valid resource"
    - "PROOF: User is viewing a Cloud SQL instance details, which counts as finding a resource"
    - "PROOF: User is on Compute Engine, which is part of the Compute section to explore"
  * These steps are about AWARENESS and EXPLORATION, not completing every single item - be generous!
  * When you see "e.g." or "for example", treat it as a SUGGESTION, not a requirement

DO NOT MARK COMPLETE WITHOUT PROOF:
- Just navigating to a page (must see the page fully loaded with specific UI elements)
- Hovering over buttons (must see the result of clicking - dialog, menu, etc.)
- Partial UI changes (must see complete result)
- Random clicking (must see intentional progress toward the goal)

IMPORTANT RULES:
1. Only mark ONE step complete per analysis - even if you see evidence of multiple steps
2. Always start with the first incomplete step - don't skip ahead
3. Provide proof of what you SEE in the screenshot
4. If no proof visible, guide them to the next action

Only mark taskComplete as true when ALL sub-instructions are completed with visual proof

IMPORTANT: Respond with ONLY a JSON object, no markdown formatting, no code blocks.
Format:
{
  "taskComplete": true/false,
  "feedback": "Your guidance with proof if marking step complete",
  "cursorAnalysis": "Where the cursor is and if it's near the correct element",
  "stepCompleted": 0,
  "proof": "What you see in the screenshot that proves completion (or empty string if not complete)"
}`;

    // Use Gemini for vision analysis (using Gemini 2.0 Flash for higher rate limits)
    // gemini-2.0-flash: 2K RPM vs gemini-2.5-flash: 1K RPM
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    // Convert base64 data URL to the format Gemini expects
    // Extract the base64 data (remove "data:image/jpeg;base64," prefix)
    const base64Data = screenshot.replace(/^data:image\/\w+;base64,/, '');
    
    // Validate screenshot
    if (!base64Data || base64Data.length < 100) {
      console.error('❌ Invalid screenshot data:', base64Data.substring(0, 50));
      return res.status(400).json({
        taskComplete: false,
        feedback: '⚠️ Screenshot capture failed. Please reload the page.',
        error: 'Invalid screenshot data'
      });
    }

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/png" // Changed to PNG as Chrome captures as PNG
      }
    };

    const result = await model.generateContent([prompt, imagePart]);
    const aiResponse = result.response.text();
    console.log('🤖 AI Raw Response:', aiResponse);
    
    // Parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (e) {
      // If not JSON, create structured response
      parsedResponse = {
        taskComplete: aiResponse.toLowerCase().includes('complete') || aiResponse.toLowerCase().includes('done'),
        feedback: aiResponse.substring(0, 150),
        cursorAnalysis: 'Analyzing cursor position...'
      };
    }
    
    console.log('✅ AI Analysis:', parsedResponse);
    res.json(parsedResponse);
    
  } catch (error) {
    console.error('❌ AI Analysis Error:', error.message);
    console.error('❌ Error stack:', error.stack);
    if (error.response) {
      console.error('❌ API Response Status:', error.response.status);
      console.error('❌ API Response Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    // Log more details about the request
    console.error('❌ Screenshot length:', screenshot ? screenshot.length : 'null');
    console.error('❌ Current task:', currentTask);
    
    res.status(500).json({
      taskComplete: false,
      feedback: '⚠️ Unable to analyze screenshot. Please try clicking around or reloading the page.',
      error: error.message
    });
  }
});

/*
================================================================================
EXTENSION TRACKING & CONFIGURATION ENDPOINTS
================================================================================
*/

// Extension usage tracking - detects when AI coach is being used
app.post('/track/extension-usage', async (req, res) => {
  const { internEmail, event, website, step, timestamp } = req.body;
  
  console.log(`📥 Received tracking event:`, { internEmail, event, website, step });
  console.log(`🤖 Extension event: ${event} for ${internEmail} on ${website}`);
  
  // Get tracking data - try exact match first, then case-insensitive
  let tracking = usageTracking.get(internEmail);
  
  // If not found, try case-insensitive search
  if (!tracking && internEmail) {
    const lowerEmail = internEmail.toLowerCase();
    for (const [key, value] of usageTracking.entries()) {
      if (key.toLowerCase() === lowerEmail) {
        tracking = value;
        console.log(`✅ Found tracking data with case-insensitive match: ${key}`);
        break;
      }
    }
  }
  
  if (!tracking) {
    console.error(`❌ Intern not found: ${internEmail}`);
    console.log(`📋 Available interns in tracking:`, Array.from(usageTracking.keys()));
    return res.status(404).json({ 
      error: 'Intern not found. Please complete onboarding setup first.',
      availableInterns: Array.from(usageTracking.keys())
    });
  }
  
  console.log(`✅ Found tracking data for ${internEmail}`);
  console.log(`📊 Current state:`, {
    extensionActivated: tracking.extensionActivated,
    trainingInProgress: tracking.trainingInProgress,
    trainingCompleted: tracking.trainingCompleted
  });
  
  // Log the event
  tracking.extensionEvents = tracking.extensionEvents || [];
  tracking.extensionEvents.push({
    event,
    website,
    step,
    timestamp: timestamp || new Date()
  });
  
  // STATE FLIP 0→1: Extension activated (training started)
  if (!tracking.extensionActivated && event === 'extension_activated') {
    tracking.extensionActivated = true; // Flip to 1
    tracking.firstActivationAt = new Date();
    tracking.trainingInProgress = true; // Training in progress
    
    console.log(`🔍 Looking for active session for: ${internEmail}`);
    console.log(`📊 Active sessions:`, Array.from(activeSessions.keys()));
    
    // Try to find session - exact match first, then case-insensitive
    let session = activeSessions.get(internEmail);
    
    if (!session && internEmail) {
      const lowerEmail = internEmail.toLowerCase();
      for (const [key, value] of activeSessions.entries()) {
        if (key.toLowerCase() === lowerEmail) {
          session = value;
          console.log(`✅ Found session with case-insensitive match: ${key}`);
          break;
        }
      }
    }
    
    // Store state for polling (in case SSE is closed)
    workflowStates.set(internEmail, {
      step: 'onboarding',
      status: 'running',
      message: `${tracking.internName} is completing onboarding tasks...`,
      extensionActivated: true,
      trainingInProgress: true,
      timestamp: new Date()
    });
    
    if (session && session.sendProgress) {
      console.log(`✅ Session found! Sending progress updates via SSE...`);
      
      // Mark "opened" as completed
      session.sendProgress('opened', 'completed', {
        message: `${tracking.internName} opened the AI Coach!`,
        extensionActivated: true
      });
      
      // Start "onboarding" phase (training in progress)
      session.sendProgress('onboarding', 'running', {
        message: `${tracking.internName} is completing onboarding tasks...`,
        trainingInProgress: true
      });
      
      console.log(`✅ Training STARTED for ${internEmail} (0→1)`);
      console.log(`📤 Sent SSE updates: 'opened' completed, 'onboarding' running`);
    } else {
      console.warn(`⚠️ No active SSE session found for ${internEmail}`);
      console.log(`📋 Available sessions: ${Array.from(activeSessions.keys()).join(', ')}`);
      console.log(`💾 State saved for polling - frontend can retrieve via /workflow/state/${internEmail}`);
    }
  }
  
  // STATE FLIP 1→0: Training completed (all tasks done)
  if (event === 'training_completed') {
    tracking.trainingInProgress = false; // Flip to 0
    tracking.trainingCompleted = true;   // Mark as completed
    tracking.trainingCompletedAt = new Date();
    
    const session = activeSessions.get(internEmail);
    if (session && session.sendProgress) {
      session.sendProgress('onboarding', 'completed', {
        message: `${tracking.internName} completed all onboarding tasks!`,
        trainingCompleted: true
      });
      
      // Mark as fully onboarded
      session.sendProgress('onboarded', 'completed', {
        message: `${tracking.internName} is now fully onboarded! 🎉`
      });
      
      // Close the SSE stream
      setTimeout(() => {
        if (session.res) {
          session.res.end();
        }
        activeSessions.delete(internEmail);
      }, 1000);
    }
    
    console.log(`✅ Training COMPLETED for ${internEmail} (1→0)`);
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

// Get current training state for an intern
app.get('/extension/state/:internEmail', async (req, res) => {
  const { internEmail } = req.params;
  
  const tracking = usageTracking.get(internEmail);
  
  if (!tracking) {
    return res.status(404).json({ 
      error: 'No tracking data found for this intern' 
    });
  }
  
  res.json({
    success: true,
    internEmail: tracking.internEmail,
    internName: tracking.internName,
    state: {
      extensionActivated: tracking.extensionActivated,       // 0 or 1
      trainingInProgress: tracking.trainingInProgress,       // 0 or 1
      trainingCompleted: tracking.trainingCompleted,         // 0 or 1
      firstActivationAt: tracking.firstActivationAt,
      trainingCompletedAt: tracking.trainingCompletedAt
    }
  });
});

// Get workflow state for polling (when SSE closes)
app.get('/workflow/state/:internEmail', async (req, res) => {
  const { internEmail } = req.params;
  
  const tracking = usageTracking.get(internEmail);
  const workflowState = workflowStates.get(internEmail);
  
  if (!tracking) {
    return res.status(404).json({ 
      error: 'No tracking data found for this intern' 
    });
  }
  
  // Return the latest workflow state
  res.json({
    success: true,
    internEmail: tracking.internEmail,
    internName: tracking.internName,
    workflowState: workflowState || {
      step: 'opened',
      status: 'running',
      message: 'Waiting for extension activation...',
      timestamp: new Date()
    },
    tracking: {
      extensionActivated: tracking.extensionActivated,
      trainingInProgress: tracking.trainingInProgress,
      trainingCompleted: tracking.trainingCompleted,
      firstActivationAt: tracking.firstActivationAt,
      trainingCompletedAt: tracking.trainingCompletedAt
    }
  });
});

// Activation page - redirects to target URL with email in URL
app.get('/activate', (req, res) => {
  const { email, target } = req.query;

  if (!email) {
    return res.status(400).send('Missing email parameter');
  }

  console.log(`🔗 Activating extension for: ${email}`);

  // Use target URL if provided, otherwise default to Google Console
  const baseUrl = target || 'https://console.cloud.google.com/';

  // Add email parameter to URL
  const url = new URL(baseUrl);
  url.searchParams.set('onboardly_email', email);

  console.log(`🎯 Redirecting to: ${url.toString()}`);
  res.redirect(url.toString());
});

// Get tasks for a specific platform - used by extension to load dynamic tasks
app.get('/extension/tasks/:internEmail/:platform', async (req, res) => {
  const { internEmail, platform } = req.params;

  console.log(`📋 Fetching tasks for ${internEmail} on platform: ${platform}`);

  // Get tracking data - try exact match first, then case-insensitive
  let tracking = usageTracking.get(internEmail);

  if (!tracking && internEmail) {
    const lowerEmail = internEmail.toLowerCase();
    for (const [key, value] of usageTracking.entries()) {
      if (key.toLowerCase() === lowerEmail) {
        tracking = value;
        console.log(`✅ Found tracking data with case-insensitive match: ${key}`);
        break;
      }
    }
  }

  if (!tracking) {
    console.error(`❌ Intern not found: ${internEmail}`);
    return res.status(404).json({
      error: 'Intern not found. Please complete onboarding setup first.',
      availableInterns: Array.from(usageTracking.keys())
    });
  }

  if (!tracking.taskConfigs) {
    console.error(`❌ No task configs found for: ${internEmail}`);
    return res.status(404).json({
      error: 'No task configurations found for this intern'
    });
  }

  // Find tasks for the specified platform
  const platformConfig = tracking.taskConfigs[platform];

  if (!platformConfig) {
    console.warn(`⚠️ No tasks found for platform: ${platform}`);
    console.log(`📋 Available platforms:`, Object.keys(tracking.taskConfigs));
    return res.status(404).json({
      error: `No tasks found for platform: ${platform}`,
      availablePlatforms: Object.keys(tracking.taskConfigs)
    });
  }

  console.log(`✅ Found ${platformConfig.tasks.length} tasks for ${platform}`);

  res.json({
    success: true,
    internName: tracking.internName,
    platform: platform,
    baseUrl: platformConfig.baseUrl,
    tasks: platformConfig.tasks
  });
});

/**
 * Generate task configurations from workflow nodes
 * Groups tasks by platform base URL for extension loading
 * Returns: { platform_url: { tasks: [...], baseDomain: '...' } }
 */
function generateTaskConfigs(workflow) {
  const configs = {};

  if (!workflow || !workflow.nodes) {
    return configs;
  }

  workflow.nodes.forEach((node, index) => {
    // Get the starting URL for this task
    const startingUrl = getStartingUrl(node.description);

    // Extract base domain from URL
    const baseDomain = extractBaseDomain(startingUrl);

    if (!configs[baseDomain]) {
      configs[baseDomain] = {
        baseDomain: baseDomain,
        baseUrl: startingUrl,
        tasks: []
      };
    }

    configs[baseDomain].tasks.push({
      id: node.id,
      order: index + 1,
      text: node.description,
      name: node.name,
      type: node.type,
      estimatedDuration: node.estimatedDuration,
      targetUrl: startingUrl,
      subInstructions: node.subInstructions || []
    });
  });

  return configs;
}

/**
 * Extract base domain from URL
 * e.g., "https://console.cloud.google.com/storage" -> "console.cloud.google.com"
 */
function extractBaseDomain(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname;
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Generate website configuration from workflow
 * Returns a dictionary: { website_url: [subtasks] }
 * (Kept for backwards compatibility)
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

// In-memory storage for onboarding completion status (per session)
const onboardingCompletions = new Map(); // email -> { completed: boolean, completedAt: timestamp }

// Endpoint to mark onboarding as complete
app.post('/onboarding/complete', (req, res) => {
  const { email, completedAt } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  onboardingCompletions.set(email, {
    completed: true,
    completedAt: completedAt || new Date().toISOString()
  });
  
  console.log(`✅ Onboarding marked complete for: ${email}`);
  res.json({ success: true, email, completed: true });
});

// Endpoint to check onboarding completion status
app.get('/onboarding/status/:email', (req, res) => {
  const { email } = req.params;
  const status = onboardingCompletions.get(email) || { completed: false };
  
  res.json({
    email,
    completed: status.completed || false,
    completedAt: status.completedAt || null
  });
});

// Endpoint to reset onboarding status (for testing)
app.post('/onboarding/reset', (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  onboardingCompletions.delete(email);
  console.log(`🔄 Onboarding reset for: ${email}`);
  res.json({ success: true, email, completed: false });
});

app.listen(port, () => {
  console.log(`Onboarding server running at http://localhost:${port}`);
});