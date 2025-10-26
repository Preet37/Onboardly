// Force inject the panel with maximum visibility
// Remove any existing panel
const existing = document.getElementById('ai-coach-panel');
if (existing) existing.remove();

// Create panel
const panel = document.createElement('div');
panel.id = 'ai-coach-panel';
panel.style.cssText = `
  position: fixed !important;
  top: 80px !important;
  right: 20px !important;
  width: 380px !important;
  max-height: 500px !important;
  background: white !important;
  border: none !important;
  border-radius: 8px !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3) !important;
  z-index: 2147483647 !important;
  display: flex !important;
  flex-direction: column !important;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
  overflow: hidden !important;
`;

panel.innerHTML = `
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 14px; display: flex; justify-content: space-between; align-items: center; border-radius: 8px 8px 0 0;">
    <span style="font-weight: 600; font-size: 14px;">🤖 AI Coach</span>
    <div style="display: flex; align-items: center; gap: 12px;">
      <span style="font-size: 12px; opacity: 0.95;">Step <span id="step-counter">1</span>/7</span>
      <button id="minimize-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 20px; height: 20px; border-radius: 3px; cursor: pointer; font-size: 14px; line-height: 1; padding: 0; display: flex; align-items: center; justify-content: center;">−</button>
    </div>
  </div>
  <div id="panel-body" style="padding: 16px; flex: 1; overflow-y: auto; background: #fafafa;">
    <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 14px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #2196F3;">
      <div style="font-weight: 600; color: #1565c0; margin-bottom: 6px; font-size: 13px;">🎯 Overall Goal</div>
      <div style="color: #424242; line-height: 1.5; font-size: 13px;">
        Learn Google Cloud Platform basics by exploring IAM, Service Accounts, and APIs & Services
      </div>
    </div>
    <div style="background: white; padding: 14px; border-radius: 6px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="font-weight: 600; color: #333; margin-bottom: 8px; font-size: 13px;">📝 Current Task (Step <span id="current-step-num">1</span>)</div>
      <div id="task-description" style="color: #666; line-height: 1.5; font-size: 13px; margin-bottom: 12px;">
        Click on the hamburger menu (☰) in the top-left corner
      </div>
      <div id="ai-feedback" style="color: #1b5e20; font-size: 13px; padding: 12px; background: #e8f5e9; border-radius: 4px; line-height: 1.5; margin-bottom: 8px; border-left: 3px solid #4CAF50; font-weight: 500; display: none;">
        AI feedback will appear here...
      </div>
      <div id="status-message" style="color: #666; font-size: 11px; padding: 6px 10px; background: #f5f5f5; border-radius: 4px; line-height: 1.5; opacity: 0.8;">
        💡 Ready to help
      </div>
    </div>
    <div style="background: white; padding: 14px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="font-weight: 600; color: #333; margin-bottom: 8px; font-size: 13px;">📋 All Steps</div>
      <div id="steps-list" style="font-size: 12px; line-height: 1.8;">
        <!-- Steps will be populated here -->
      </div>
    </div>
  </div>
`;

document.body.appendChild(panel);

// AI Analysis with memory
let stepCount = 1;
let lastUrl = window.location.href;
let urlChangeDetected = false;
let mouseX = 0;
let mouseY = 0;
let actionHistory = [];
let lastScreenshotHash = null;
let analysisInProgress = false;
let internEmail = null; // Will be loaded from storage

// Extract email from URL or storage and send activation event
function initializeInternEmail() {
  // First, check URL for onboardly_email parameter
  const urlParams = new URLSearchParams(window.location.search);
  const emailFromUrl = urlParams.get('onboardly_email');

  if (emailFromUrl) {
    // Store it for future use
    chrome.storage.local.set({ internEmail: emailFromUrl }, () => {
      internEmail = emailFromUrl;
      console.log('📧 Email from URL, stored:', internEmail);

      // Send extension activated event to backend
      sendTrackingEvent('extension_activated', 1);
    });
  } else {
    // Fall back to storage
    chrome.storage.local.get(['internEmail'], (result) => {
      if (result.internEmail) {
        internEmail = result.internEmail;
        console.log('📧 Email from storage:', internEmail);

        // Send extension activated event (in case of page reload)
        sendTrackingEvent('extension_activated', 1);
      } else {
        console.warn('⚠️ No intern email found in URL or storage');
        console.warn('⚠️ Extension will not send tracking events');
      }
    });
  }
}

// Initialize email on page load
initializeInternEmail();

// Track mouse position
document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

// Send tracking event to backend
async function sendTrackingEvent(event, step) {
  if (!internEmail) {
    console.warn('⚠️ Cannot send tracking - no intern email');
    return;
  }

  try {
    const response = await fetch('http://localhost:3000/track/extension-usage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        internEmail,
        event,
        website: window.location.href,
        step,
        timestamp: new Date().toISOString()
      })
    });

    if (response.ok) {
      console.log(`✅ Tracking event sent: ${event}`);
    }
  } catch (error) {
    console.warn('⚠️ Failed to send tracking event:', error.message);
  }
}

// Log user actions
function logAction(action, details) {
  const timestamp = new Date().toISOString();
  const log = {
    timestamp,
    action,
    details,
    url: window.location.href,
    cursorPosition: { x: mouseX, y: mouseY }
  };
  actionHistory.push(log);

  // Keep only last 20 actions
  if (actionHistory.length > 20) {
    actionHistory.shift();
  }

  // Send tracking for important events
  if (action === 'training_completed') {
    sendTrackingEvent('training_completed', stepCount);
  }
}

const tasks = [
  { 
    text: 'Click on the hamburger menu (☰) in the top-left corner',
    validate: (e) => {
      // Check if clicked on navigation menu button
      const target = e.target.closest('button, [role="button"], mat-icon');
      return target && (
        target.textContent.includes('menu') || 
        target.getAttribute('aria-label')?.toLowerCase().includes('menu') ||
        target.className?.toLowerCase().includes('menu')
      );
    }
  },
  { 
    text: 'Navigate to "IAM & Admin" in the menu',
    validate: (e) => {
      const text = e.target.textContent?.toLowerCase() || '';
      return text.includes('iam') || text.includes('admin');
    }
  },
  { 
    text: 'Click on "Service Accounts"',
    validate: (e) => {
      const text = e.target.textContent?.toLowerCase() || '';
      return text.includes('service') && text.includes('account');
    }
  },
  { 
    text: 'Navigate to "APIs & Services"',
    validate: (e) => {
      const text = e.target.textContent?.toLowerCase() || '';
      return text.includes('api') || text.includes('service');
    }
  },
  { 
    text: 'Click on "Library" or "Dashboard"',
    validate: (e) => {
      const text = e.target.textContent?.toLowerCase() || '';
      return text.includes('library') || text.includes('dashboard');
    }
  },
  { 
    text: 'Explore the page - click on any card or button',
    validate: (e) => {
      return e.target.closest('button, a, mat-card, [role="button"]') !== null;
    }
  },
  { 
    text: 'Return to the main console',
    validate: (e) => {
      const text = e.target.textContent?.toLowerCase() || '';
      return text.includes('home') || text.includes('console') || text.includes('dashboard');
    }
  }
];

// Populate steps list
function updateStepsList() {
  const stepsList = document.getElementById('steps-list');
  if (!stepsList) return;
  
  stepsList.innerHTML = tasks.map((task, index) => {
    const stepNum = index + 1;
    const isComplete = stepNum < stepCount;
    const isCurrent = stepNum === stepCount;
    
    let icon = '⭕';
    let color = '#999';
    let bgColor = 'transparent';
    
    if (isComplete) {
      icon = '✅';
      color = '#4CAF50';
      bgColor = '#e8f5e9';
    } else if (isCurrent) {
      icon = '▶️';
      color = '#2196F3';
      bgColor = '#e3f2fd';
    }
    
    return `
      <div style="padding: 8px; margin-bottom: 4px; border-radius: 4px; background: ${bgColor}; display: flex; align-items: start; gap: 8px;">
        <span style="flex-shrink: 0;">${icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: ${isCurrent ? '600' : '400'}; color: ${color};">
            ${stepNum}. ${task.text}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

updateStepsList();

// Minimize button
const minimizeBtn = document.getElementById('minimize-btn');
const panelBody = document.getElementById('panel-body');
if (minimizeBtn && panelBody) {
  minimizeBtn.addEventListener('click', () => {
    if (panelBody.style.display === 'none') {
      panelBody.style.display = 'flex';
      minimizeBtn.textContent = '−';
    } else {
      panelBody.style.display = 'none';
      minimizeBtn.textContent = '+';
    }
  });
}

// Detect URL changes (navigation)
setInterval(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    urlChangeDetected = true;
  }
}, 500);

document.addEventListener('click', (e) => {
  if (e.target.closest('#ai-coach-panel')) return;

  const clickedText = e.target.textContent?.substring(0, 50) || e.target.tagName;
  logAction('click', `Clicked: ${clickedText}`);

  // Show immediate status on click
  const status = document.getElementById('status-message');
  if (status) {
    status.textContent = '🎯 Analyzing your click...';
  }

  // Force immediate AI analysis on click
  lastScreenshotHash = null;
  analysisInProgress = false; // Reset the flag to allow immediate analysis

  // Delay slightly to let the UI update after the click
  setTimeout(() => {
    analyzeWithAI();
  }, 300);
}, true);

// AI Analysis every 3 seconds
async function analyzeWithAI() {
  if (analysisInProgress) return;
  if (stepCount > tasks.length) return;
  
  analysisInProgress = true;
  
  try {
    // Capture screenshot
    const screenshot = await captureScreenshot();
    if (!screenshot) {
      analysisInProgress = false;
      return;
    }
    
    const screenshotHash = simpleHash(screenshot);
    if (screenshotHash === lastScreenshotHash) {
      // Screen unchanged, skip analysis
      analysisInProgress = false;
      return;
    }
    lastScreenshotHash = screenshotHash;
    
    const currentTask = tasks[stepCount - 1];
    const status = document.getElementById('status-message');

    // Don't show "analyzing" message - keep previous feedback visible
    // Only send to backend for AI analysis
    const response = await fetch('http://localhost:3000/ai/analyze-screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshot,
        currentTask: currentTask.text,
        stepNumber: stepCount,
        totalSteps: tasks.length,
        cursorPosition: { x: mouseX, y: mouseY },
        actionHistory: actionHistory.slice(-5), // Last 5 actions
        url: window.location.href
      })
    });

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();

    // Parse the feedback - it might be JSON wrapped in markdown code blocks
    let feedback = data.feedback;
    if (feedback && feedback.includes('```json')) {
      // Extract JSON from markdown code block
      const jsonMatch = feedback.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          feedback = parsed.feedback || feedback;
        } catch (e) {
          // Keep original if parsing fails
        }
      }
    }

    console.log('🤖 AI says:', feedback);

    // Show AI feedback in dedicated area
    const aiFeedback = document.getElementById('ai-feedback');
    if (feedback && aiFeedback) {
      aiFeedback.textContent = feedback;
      aiFeedback.style.display = 'block';
    }

    // Update status message separately
    if (status) {
      status.textContent = '💡 Watching your actions...';
    }

    // Also check taskComplete from the parsed feedback
    let taskComplete = data.taskComplete;
    if (!taskComplete && feedback && data.feedback?.includes('```json')) {
      const jsonMatch = data.feedback.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          taskComplete = parsed.taskComplete;
        } catch (e) {
          // ignore
        }
      }
    }

    // If AI says task is complete, move to next step
    if (taskComplete && stepCount < tasks.length) {
      logAction('task_completed', `Completed: ${currentTask.text}`);
      setTimeout(() => {
        stepCount++;
        const counter = document.getElementById('step-counter');
        const currentStepNum = document.getElementById('current-step-num');
        const taskDesc = document.getElementById('task-description');
        if (counter) counter.textContent = stepCount;
        if (currentStepNum) currentStepNum.textContent = stepCount;
        if (taskDesc) taskDesc.textContent = tasks[stepCount - 1].text;
        if (status) {
          status.textContent = '💡 Ready for next step';
        }
        updateStepsList(); // Update the steps list
      }, 1500);
    } else if (taskComplete && stepCount === tasks.length) {
      stepCount++;
      if (status) status.textContent = '🎉 All tasks complete! You\'re onboarded!';
      const taskDesc = document.getElementById('task-description');
      if (taskDesc) taskDesc.textContent = 'Congratulations! You\'ve completed the onboarding.';
      const aiFeedback = document.getElementById('ai-feedback');
      if (aiFeedback) {
        aiFeedback.textContent = '🎉 Congratulations! You\'ve completed all onboarding tasks!';
        aiFeedback.style.background = '#e8f5e9';
        aiFeedback.style.borderLeft = '3px solid #4CAF50';
        aiFeedback.style.color = '#1b5e20';
        aiFeedback.style.display = 'block';
      }
      updateStepsList(); // Update the steps list

      // Send tracking event to backend
      logAction('training_completed', 'All tasks finished');
      console.log('🎉 Training complete! Notifying backend...');
    }

  } catch (error) {
    const aiFeedback = document.getElementById('ai-feedback');
    const status = document.getElementById('status-message');

    if (aiFeedback) {
      if (error.message.includes('Failed to fetch')) {
        aiFeedback.textContent = '⚠️ Backend offline. Start with: node backend/index.js';
        aiFeedback.style.display = 'block';
        aiFeedback.style.background = '#fff3cd';
        aiFeedback.style.borderLeft = '3px solid #ff9800';
        aiFeedback.style.color = '#856404';
      } else {
        aiFeedback.textContent = '⚠️ AI analysis temporarily unavailable';
        aiFeedback.style.display = 'block';
        aiFeedback.style.background = '#fff3cd';
        aiFeedback.style.borderLeft = '3px solid #ff9800';
        aiFeedback.style.color = '#856404';
      }
    }

    if (status) {
      status.textContent = '⚠️ Error occurred';
    }
  }
  
  analysisInProgress = false;
}

// Capture screenshot using Chrome API
async function captureScreenshot() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'captureTab' }, (response) => {
      if (chrome.runtime.lastError || !response?.screenshot) {
        resolve(null);
      } else {
        resolve(response.screenshot);
      }
    });
  });
}

// Simple hash function
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

// Start AI analysis loop
setInterval(analyzeWithAI, 3000);
