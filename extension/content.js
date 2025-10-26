/**
 * AI Onboarding Coach - Content Script
 * Injected into GCP Console pages to provide real-time coaching
 */

const API_URL = 'http://localhost:5001';
const ONBOARDING_API_URL = 'http://localhost:3000';
const CAPTURE_INTERVAL = 5000; // 5 seconds
const TASK_TYPE = 'gcp_storage';

let currentStep = 1;
let isMonitoring = false;
let captureIntervalId = null;
let coachPanel = null;
let lastScreenshotHash = null; // Track if screen has changed
let mousePosition = { x: 0, y: 0 }; // Track mouse position
let internEmail = null; // Intern's email for tracking
let websiteConfig = null; // Dynamic configuration from backend
let currentWebsiteTasks = []; // Tasks for current website

// Wait for page to be ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

async function initialize() {
  console.log('🚀 AI Coach initializing...');
  
  // Get intern email from URL parameter or storage
  const urlParams = new URLSearchParams(window.location.search);
  internEmail = urlParams.get('onboardly_email') || urlParams.get('email') || localStorage.getItem('onboardly_intern_email');
  
  console.log('🔍 Checking for intern email...', { 
    fromURL_onboardly: urlParams.get('onboardly_email'),
    fromURL_email: urlParams.get('email'), 
    fromStorage: localStorage.getItem('onboardly_intern_email') 
  });
  
  if (!internEmail) {
    // Try to get from Chrome storage
    try {
      const result = await chrome.storage.local.get(['internEmail']);
      internEmail = result.internEmail;
      console.log('📦 Got email from Chrome storage:', internEmail);
    } catch (e) {
      console.warn('⚠️ No intern email found');
    }
  }
  
  if (internEmail) {
    console.log(`✅ Intern email set: ${internEmail}`);
    
    localStorage.setItem('onboardly_intern_email', internEmail);
    try {
      await chrome.storage.local.set({ internEmail });
    } catch (e) {
      // Ignore storage errors
    }
    
    // Load configuration from backend
    await loadExtensionConfig();
    
    // Send tracking event: extension activated
    console.log('📡 Sending extension_activated event...');
    await sendTrackingEvent('extension_activated', window.location.href, currentStep);
  } else {
    console.warn('⚠️ No intern email available - tracking disabled');
  }

  createCoachPanel();
  startMonitoring();
  trackMousePosition();
  
  console.log('✅ AI Coach initialized');
}

/**
 * Track mouse position for contextual analysis
 */
function trackMousePosition() {
  document.addEventListener('mousemove', (event) => {
    mousePosition.x = event.clientX;
    mousePosition.y = event.clientY;
  });
}

/**
 * Create the AI Coach overlay panel
 */
function createCoachPanel() {
  if (coachPanel) return;

  coachPanel = document.createElement('div');
  coachPanel.id = 'ai-coach-panel';
  coachPanel.className = 'ai-coach-panel';

  coachPanel.innerHTML = `
    <div class="coach-header">
      <div class="coach-title">
        <span class="coach-icon">🤖</span>
        AI Onboarding Coach
      </div>
      <div class="coach-controls">
        <span class="coach-step">Step <span id="current-step">1</span>/7</span>
        <button class="coach-minimize" id="minimize-btn">−</button>
      </div>
    </div>
    <div class="coach-body" id="coach-body">
      <div class="coach-status">
        <div class="status-indicator" id="status-indicator">
          <span class="status-dot"></span>
          <span id="status-text">Analyzing...</span>
        </div>
      </div>
      <div class="coach-content" id="coach-content">
        <p>Starting AI coaching session...</p>
      </div>
    </div>
  `;

  document.body.appendChild(coachPanel);

  // Minimize button
  document.getElementById('minimize-btn').addEventListener('click', () => {
    const body = document.getElementById('coach-body');
    const btn = document.getElementById('minimize-btn');
    if (body.style.display === 'none') {
      body.style.display = 'block';
      btn.textContent = '−';
    } else {
      body.style.display = 'none';
      btn.textContent = '+';
    }
  });
}

/**
 * Start monitoring and analyzing
 */
function startMonitoring() {
  if (isMonitoring) return;

  isMonitoring = true;
  updateStatus('active', 'Monitoring');

  // Capture immediately
  captureAndAnalyze();

  // Set up interval
  captureIntervalId = setInterval(captureAndAnalyze, CAPTURE_INTERVAL);
}

/**
 * Stop monitoring
 */
function stopMonitoring() {
  if (captureIntervalId) {
    clearInterval(captureIntervalId);
    captureIntervalId = null;
  }
  isMonitoring = false;
  updateStatus('inactive', 'Stopped');
}

/**
 * Simple hash function for screenshot comparison
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
}

/**
 * Capture screenshot and analyze
 */
async function captureAndAnalyze() {
  try {
    // Request screenshot from background script
    chrome.runtime.sendMessage({ action: 'captureTab' }, async (response) => {
      // Check for errors
      if (chrome.runtime.lastError) {
        updateContent('Screenshot capture error: ' + chrome.runtime.lastError.message);
        updateStatus('error', 'Error');
        return;
      }

      if (!response) {
        updateContent('Extension communication error. Try reloading the extension.');
        updateStatus('error', 'Error');
        return;
      }

      if (!response.success || !response.screenshot) {
        updateContent(`Screenshot capture failed: ${response.error || 'Unknown error'}`);
        updateStatus('error', 'Error');
        return;
      }
      
      // Check if screen has changed (compare hash to save API calls)
      const screenshotHash = simpleHash(response.screenshot);
      if (lastScreenshotHash === screenshotHash) {
        return; // Skip analysis if screen unchanged
      }
      
      lastScreenshotHash = screenshotHash;
      updateStatus('active', 'Analyzing...');

      // Send to backend for analysis
      const analysis = await analyzeScreenshot(response.screenshot);

      if (!analysis || !analysis.success) {
        updateContent(`Backend error: ${analysis?.error || 'Unknown error'}`);
        updateStatus('error', 'Error');
        return;
      }

      // Get coaching guidance
      const guidance = await getGuidance(analysis.analysis);

      if (guidance && guidance.success) {
        displayGuidance(guidance.guidance, analysis.analysis);
      } else {
        updateContent(`Coaching error: ${guidance?.error || 'Unknown error'}`);
        updateStatus('error', 'Error');
      }
    });
  } catch (error) {
    updateContent('Error: ' + error.message);
    updateStatus('error', 'Error');
  }
}

/**
 * Send screenshot to backend for analysis
 */
async function analyzeScreenshot(screenshotDataUrl) {
  try {
    const response = await fetch(`${API_URL}/api/screenshot/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshot: screenshotDataUrl,
        task_type: TASK_TYPE,
        current_step: currentStep,
        mouse_position: mousePosition  // Send mouse position for context
      })
    });

    return await response.json();
  } catch (error) {
    console.error('Error analyzing screenshot:', error);
    return null;
  }
}

/**
 * Get coaching guidance from backend
 */
async function getGuidance(analysis) {
  try {
    const response = await fetch(`${API_URL}/api/coaching/guidance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        analysis,
        task_type: TASK_TYPE,
        current_step: currentStep
      })
    });

    return await response.json();
  } catch (error) {
    console.error('Error getting guidance:', error);
    return null;
  }
}

/**
 * Get overall task goal
 */
function getOverallGoal() {
  return "Create a Google Cloud Storage Bucket";
}

/**
 * Get current step description
 */
function getCurrentStepDescription() {
  // If we have website-specific tasks, use those
  if (currentWebsiteTasks && currentWebsiteTasks.length > 0) {
    const task = currentWebsiteTasks[currentStep - 1];
    return task ? task.description : "Unknown step";
  }
  
  // Fallback to default steps
  const steps = [
    "Navigate to Cloud Storage in GCP Console",
    "Click 'Create Bucket' button",
    "Enter a unique bucket name",
    "Choose location type and region",
    "Select storage class",
    "Configure access control",
    "Review and create bucket"
  ];
  return steps[currentStep - 1] || "Unknown step";
}

/**
 * Display coaching guidance in the panel
 */
function displayGuidance(guidance, analysis) {
  const statusColors = {
    'correct': '#4CAF50',
    'wrong_step': '#FF9800',
    'has_errors': '#F44336',
    'incomplete': '#2196F3'
  };

  const statusLabels = {
    'correct': '✅ Step Complete!',
    'wrong_step': '⚠️ Wrong Step',
    'has_errors': '❌ Errors Detected',
    'incomplete': '⏳ Ready to Click'
  };

  const status = guidance.step_status || 'unknown';
  const color = statusColors[status] || '#9E9E9E';
  const label = statusLabels[status] || 'Analyzing...';

  updateStatus(status, label, color);

  const totalSteps = currentWebsiteTasks.length || 7;

  let content = `
    <div class="guidance-overall-goal">
      <h3>🏆 Overall Goal:</h3>
      <p><strong>${getOverallGoal()}</strong></p>
    </div>
    <div class="guidance-current-goal">
      <h3>🎯 Current Step (${currentStep}/${totalSteps}):</h3>
      <p><strong>${getCurrentStepDescription()}</strong></p>
    </div>
    <div class="guidance-message">
      <h3>💬 Guidance:</h3>
      <p>${guidance.message || 'No message'}</p>
    </div>
  `;

  updateContent(content);

  // Auto-advance step ONLY if the action was actually completed
  if (status === 'correct' && currentStep < totalSteps) {
    setTimeout(() => {
      currentStep++;
      document.getElementById('current-step').textContent = currentStep;
      lastScreenshotHash = null; // Reset hash to force analysis on new step
      updateStatus('active', 'Monitoring');
      
      // Send tracking event
      sendTrackingEvent('step_completed', window.location.href, currentStep - 1);
    }, 3000);
  } else if (status === 'correct' && currentStep === totalSteps) {
    // Training completed! STATE FLIP 1→0
    setTimeout(() => {
      // Send completion event (flips state from 1→0)
      sendTrackingEvent('training_completed', window.location.href, currentStep);
      
      // Stop monitoring
      stopMonitoring();
      
      // Update UI to show completion
      updateStatus('success', '🎉 Training Complete!');
      updateContent('<div class="guidance-message"><h3>🎉 Congratulations!</h3><p>You\'ve completed all onboarding tasks!</p><p style="margin-top: 16px;">The AI Coach has stopped monitoring. You can close this panel.</p></div>');
    }, 3000);
  }
}

/**
 * Update status indicator
 */
function updateStatus(status, text, color) {
  const indicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');

  if (color) {
    indicator.style.color = color;
  }

  statusText.textContent = text;

  const dot = indicator.querySelector('.status-dot');
  dot.className = `status-dot ${status}`;
}

/**
 * Update content area
 */
function updateContent(html) {
  const content = document.getElementById('coach-content');
  content.innerHTML = html;
}

/**
 * Load extension configuration from backend
 */
async function loadExtensionConfig() {
  if (!internEmail) return;
  
  try {
    const response = await fetch(`${ONBOARDING_API_URL}/extension/config/${encodeURIComponent(internEmail)}`);
    const data = await response.json();
    
    if (data.success && data.config) {
      websiteConfig = data.config;
      
      // Find tasks for current website
      const currentUrl = window.location.href;
      for (const [pattern, tasks] of Object.entries(websiteConfig)) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        if (regex.test(currentUrl)) {
          currentWebsiteTasks = tasks;
          break;
        }
      }
    }
  } catch (error) {
    console.error('Failed to load extension config:', error);
  }
}

/**
 * Send tracking event to backend
 */
async function sendTrackingEvent(event, website, step) {
  if (!internEmail) {
    console.warn('⚠️ Cannot send tracking event: no internEmail set');
    return;
  }
  
  console.log(`📤 Sending tracking event: ${event}`, { internEmail, website, step });
  
  try {
    const response = await fetch(`${ONBOARDING_API_URL}/track/extension-usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        internEmail,
        event,
        website,
        step,
        timestamp: new Date().toISOString()
      })
    });
    
    const data = await response.json();
    console.log(`✅ Tracking event sent successfully:`, data);
  } catch (error) {
    console.error('❌ Failed to send tracking event:', error);
  }
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start') {
    startMonitoring();
    sendResponse({ success: true });
  } else if (request.action === 'stop') {
    stopMonitoring();
    sendResponse({ success: true });
  }
  return true;
});
