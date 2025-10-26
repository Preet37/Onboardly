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
    <span style="font-weight: 600; font-size: 14px;">🤖 Onboardly AI Coach</span>
    <button id="minimize-btn" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 20px; height: 20px; border-radius: 3px; cursor: pointer; font-size: 14px; line-height: 1; padding: 0; display: flex; align-items: center; justify-content: center;">−</button>
  </div>
  <div id="panel-body" style="padding: 16px; flex: 1; overflow-y: auto; background: #fafafa;">
    <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 14px; border-radius: 6px; margin-bottom: 12px; border-left: 4px solid #2196F3;">
      <div style="font-weight: 600; color: #1565c0; margin-bottom: 6px; font-size: 13px;">🎯 Overall Goal</div>
      <div style="color: #424242; line-height: 1.5; font-size: 13px;">
        Learn Google Cloud Platform basics by exploring IAM, Service Accounts, and APIs & Services
      </div>
    </div>
    <div style="background: white; padding: 14px; border-radius: 6px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
      <div style="font-weight: 600; color: #333; margin-bottom: 8px; font-size: 13px;">📝 Current Task</div>
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
let tasks = []; // Will be loaded dynamically from backend

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

      // Load tasks from backend
      loadTasksFromBackend();
    });
  } else {
    // Fall back to storage
    chrome.storage.local.get(['internEmail'], (result) => {
      if (result.internEmail) {
        internEmail = result.internEmail;
        console.log('📧 Email from storage:', internEmail);

        // Send extension activated event (in case of page reload)
        sendTrackingEvent('extension_activated', 1);

        // Load tasks from backend
        loadTasksFromBackend();
      } else {
        console.warn('⚠️ No intern email found in URL or storage');
        console.warn('⚠️ Extension will not send tracking events');
        // Show error in UI
        showLoadingError('No intern email found. Please use the activation link from your email.');
      }
    });
  }
}

// Track if tasks have been loaded to prevent reloading mid-session
let tasksLoaded = false;

// Load tasks dynamically from backend
async function loadTasksFromBackend() {
  console.log('🔍 loadTasksFromBackend() called');
  console.trace('Call stack:'); // Show where this was called from
  
  if (!internEmail) {
    console.error('❌ Cannot load tasks: no intern email');
    return;
  }
  
  // Prevent reloading tasks if user has already started
  if (tasksLoaded && tasks.length > 0) {
    console.group('🚫 BLOCKING Task Reload');
    console.warn('Tasks already loaded - skipping reload to prevent data loss');
    console.warn('tasksLoaded:', tasksLoaded);
    console.warn('tasks.length:', tasks.length);
    console.warn('Current tasks:', tasks);
    console.groupEnd();
    return;
  }
  
  console.log('✅ Proceeding with task load (first time)');

  // Extract current platform from URL
  const platform = window.location.hostname;
  console.log(`📋 Loading tasks for platform: ${platform}`);

  try {
    const response = await fetch(`http://localhost:3000/extension/tasks/${encodeURIComponent(internEmail)}/${encodeURIComponent(platform)}`);

    if (!response.ok) {
      throw new Error(`Failed to load tasks: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ Loaded ${data.tasks.length} tasks from backend`);

    // Update tasks array with sub-instructions
    console.group('📥 Loading Tasks from Backend');
    console.log(`Received ${data.tasks.length} tasks`);
    data.tasks.forEach((task, i) => {
      console.log(`Task ${i + 1}: "${task.name}" - ${task.subInstructions?.length || 0} sub-instructions`);
    });
    console.groupEnd();
    
    tasks = data.tasks.map(task => ({
      text: task.text,
      name: task.name,
      subInstructions: task.subInstructions || [],
      estimatedDuration: task.estimatedDuration,
      validate: (e) => {
        // Generic validation - AI will do the real validation
        return true;
      }
    }));
    
    console.log('✅ Tasks array updated:', tasks);
    
    // Mark tasks as loaded
    tasksLoaded = true;

    // Update overall goal from task names
    const goalText = data.tasks.map(t => t.name).join(', ');
    const goalDiv = document.querySelector('#panel-body > div:first-child > div:last-child');
    if (goalDiv) {
      goalDiv.textContent = `Complete ${data.tasks.length} tasks: ${goalText}`;
    }

    // Step counter removed for cleaner UI

    // Update current task with sub-instructions
    updateCurrentTaskDisplay();

    // Update steps list
    updateStepsList();

    console.log('✅ UI updated with dynamic tasks');
  } catch (error) {
    console.error('❌ Failed to load tasks from backend:', error);
    showLoadingError(`Failed to load tasks: ${error.message}`);
  }
}

// Show error in UI
function showLoadingError(message) {
  const taskDesc = document.getElementById('task-description');
  const aiFeedback = document.getElementById('ai-feedback');

  if (taskDesc) {
    taskDesc.textContent = message;
  }

  if (aiFeedback) {
    aiFeedback.textContent = '⚠️ ' + message;
    aiFeedback.style.display = 'block';
    aiFeedback.style.background = '#fff3cd';
    aiFeedback.style.borderLeft = '3px solid #ff9800';
    aiFeedback.style.color = '#856404';
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

// Update current task display with sub-instructions
function updateCurrentTaskDisplay() {
  const taskDesc = document.getElementById('task-description');
  if (!taskDesc || tasks.length === 0) return;

  const currentTask = tasks[stepCount - 1];
  if (!currentTask) return;

  // Build HTML with main task goal and sub-instructions
  let html = `<div style="margin-bottom: 10px;">
    <strong style="color: #1976d2;">${currentTask.name || currentTask.text}</strong>
  </div>`;

  if (currentTask.subInstructions && currentTask.subInstructions.length > 0) {
    html += `<div style="color: #666; font-size: 12px; margin-bottom: 8px;">Follow these steps:</div>`;
    html += `<ol style="margin: 0; padding-left: 20px; line-height: 1.8; color: #444;">`;
    currentTask.subInstructions.forEach((instruction, index) => {
      html += `<li style="margin-bottom: 4px;">${instruction}</li>`;
    });
    html += `</ol>`;
  } else {
    html += `<div style="color: #666; line-height: 1.5;">${currentTask.text}</div>`;
  }

  taskDesc.innerHTML = html;
}

// Track completed sub-instructions
let completedSubInstructions = new Set();

// Populate steps list - show sub-instructions as numbered steps
function updateStepsList() {
  const stepsList = document.getElementById('steps-list');
  if (!stepsList) return;

  // Handle empty tasks array
  if (tasks.length === 0) {
    stepsList.innerHTML = '<div style="color: #999; font-size: 12px;">Loading tasks...</div>';
    return;
  }

  // Get current task and its sub-instructions
  const currentTask = tasks[stepCount - 1];
  if (!currentTask || !currentTask.subInstructions || currentTask.subInstructions.length === 0) {
    console.warn('⚠️ Task has no sub-instructions! This will cause immediate completion.');
    console.warn('Task:', currentTask);
    console.warn('This is a backend issue - the AI did not generate sub-instructions.');
    
    // Fallback to showing main tasks if no sub-instructions
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
              ${stepNum}. ${task.name || task.text}
            </div>
            ${task.estimatedDuration ? `<div style="font-size: 10px; color: #999; margin-top: 2px;">⏱️ ${task.estimatedDuration}</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
    return;
  }

  // Show sub-instructions as numbered steps
  stepsList.innerHTML = currentTask.subInstructions.map((instruction, index) => {
    const stepNum = index + 1;
    const isComplete = completedSubInstructions.has(stepNum);

    let icon = '⭕';
    let color = '#666';
    let bgColor = 'transparent';
    let textDecoration = 'none';

    if (isComplete) {
      icon = '✅';
      color = '#4CAF50';
      bgColor = '#e8f5e9';
      textDecoration = 'line-through';
    }

    return `
      <div id="sub-step-${stepNum}" style="padding: 10px; margin-bottom: 6px; border-radius: 4px; background: ${bgColor}; display: flex; align-items: start; gap: 10px; transition: all 0.3s ease;">
        <span style="flex-shrink: 0; font-size: 16px;">${icon}</span>
        <div style="flex: 1;">
          <div style="font-weight: 500; color: ${color}; line-height: 1.5; text-decoration: ${textDecoration};">
            ${stepNum}. ${instruction}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Show loading state initially
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

// Track last analysis time to prevent too-frequent calls
let lastAnalysisTime = 0;
const MIN_ANALYSIS_INTERVAL = 1000; // Minimum 1 second between analyses
let pendingAnalysisTimeout = null; // Track pending analysis to cancel duplicates

document.addEventListener('click', (e) => {
  // Check if target is an element and if it's inside the panel
  if (e.target && e.target.nodeType === Node.ELEMENT_NODE && e.target.closest('#ai-coach-panel')) return;

  const clickedText = e.target.textContent?.substring(0, 50) || e.target.tagName;
  logAction('click', `Clicked: ${clickedText}`);

  // Show immediate status on click
  const status = document.getElementById('status-message');
  if (status) {
    status.textContent = '🎯 Analyzing your click...';
  }

  // Force immediate AI analysis on click (but respect minimum interval)
  const now = Date.now();
  if (now - lastAnalysisTime < MIN_ANALYSIS_INTERVAL) {
    console.log('⏱️ Click too soon after last analysis - ignoring');
    if (status) {
      status.textContent = '⏱️ Please wait before clicking again...';
    }
    return;
  }

  // Cancel any pending analysis from previous click
  if (pendingAnalysisTimeout) {
    console.log('🚫 Canceling previous pending analysis');
    clearTimeout(pendingAnalysisTimeout);
    pendingAnalysisTimeout = null;
  }

  lastScreenshotHash = null;
  analysisInProgress = false; // Reset the flag to allow immediate analysis

  // Delay slightly to let the UI update after the click
  pendingAnalysisTimeout = setTimeout(() => {
    pendingAnalysisTimeout = null;
    analyzeWithAI();
  }, 300);
}, true);

// AI Analysis every 5 seconds
async function analyzeWithAI() {
  if (analysisInProgress) return;
  if (stepCount > tasks.length) return;
  
  // Respect minimum interval
  const now = Date.now();
  if (now - lastAnalysisTime < MIN_ANALYSIS_INTERVAL) {
    return;
  }
  
  analysisInProgress = true;
  lastAnalysisTime = now;
  
  let screenshot = null;
  let currentTask = null;
  
  try {
    // Capture screenshot
    screenshot = await captureScreenshot();
    if (!screenshot) {
      analysisInProgress = false;
      return;
    }
    
    const screenshotHash = simpleHash(screenshot);
    
    // Check if user recently clicked - if so, force analysis even if screen looks the same
    const lastAction = actionHistory.length > 0 ? actionHistory[actionHistory.length - 1] : null;
    const recentClickTime = lastAction && lastAction.action === 'click' ? new Date(lastAction.timestamp).getTime() : 0;
    const timeSinceClick = Date.now() - recentClickTime;
    const hadVeryRecentClick = timeSinceClick < 2000; // Within 2 seconds
    
    if (screenshotHash === lastScreenshotHash && !hadVeryRecentClick) {
      // Screen unchanged and no recent click, skip analysis
      analysisInProgress = false;
      return;
    }
    lastScreenshotHash = screenshotHash;
    
    currentTask = tasks[stepCount - 1];
    const status = document.getElementById('status-message');

    // Don't show "analyzing" message - keep previous feedback visible
    // Only send to backend for AI analysis with timeout
    console.log('📤 Sending screenshot to backend for analysis...');
    const startTime = Date.now();
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.error('⏱️ Request timeout after 20 seconds');
      controller.abort();
    }, 20000); // 20 second timeout (increased from 10)
    
    // Find the current sub-instruction (first incomplete one)
    const nextIncompleteStep = currentTask.subInstructions?.findIndex((_, idx) => !completedSubInstructions.has(idx + 1));
    const currentSubInstruction = nextIncompleteStep !== -1 && currentTask.subInstructions 
      ? currentTask.subInstructions[nextIncompleteStep] 
      : null;
    const currentSubStepNumber = nextIncompleteStep !== -1 ? nextIncompleteStep + 1 : 0;
    
    const response = await fetch('http://localhost:3000/ai/analyze-screen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        screenshot,
        currentTask: currentTask.text,
        currentSubInstruction: currentSubInstruction,
        currentSubStepNumber: currentSubStepNumber,
        totalSubSteps: currentTask.subInstructions?.length || 0,
        completedSubSteps: Array.from(completedSubInstructions),
        stepNumber: stepCount,
        totalSteps: tasks.length,
        cursorPosition: { x: mouseX, y: mouseY },
        actionHistory: actionHistory.slice(-5), // Last 5 actions
        url: window.location.href
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const elapsed = Date.now() - startTime;
    console.log(`✅ Backend responded in ${elapsed}ms`);

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`📥 Received AI response (total time: ${Date.now() - startTime}ms)`);

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
    // IMPORTANT: Default to false if there's an error
    let taskComplete = data.error ? false : (data.taskComplete || false);
    
    if (!taskComplete && feedback && data.feedback?.includes('```json')) {
      const jsonMatch = data.feedback.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          taskComplete = parsed.taskComplete || false;
        } catch (e) {
          // ignore
        }
      }
    }
    
    // Never mark complete if AI analysis failed
    if (data.error) {
      taskComplete = false;
    }

    // Check if we should mark a sub-instruction as complete
    // Mark sub-instructions as complete progressively based on user actions
    const activeTask = tasks[stepCount - 1];
    if (activeTask && activeTask.subInstructions && activeTask.subInstructions.length > 0) {
      // Check if user took a recent action (click or navigation)
      const lastAction = actionHistory.length > 0 ? actionHistory[actionHistory.length - 1] : null;
      const hadRecentClick = lastAction && lastAction.action === 'click';
      const hadUrlChange = lastUrl !== window.location.href;
      const hadRecentAction = hadRecentClick || hadUrlChange;
      
      // Determine which sub-step to mark complete based on feedback
      const nextIncompleteStep = activeTask.subInstructions.findIndex((_, idx) => !completedSubInstructions.has(idx + 1));
      
      // Only mark complete if:
      // 1. There's an incomplete step
      // 2. AI gives VERY SPECIFIC positive feedback with exclamation mark
      // 3. Feedback explicitly mentions completing the step
      // 4. AI provides proof of completion
      // Note: Removed hadRecentAction requirement for observation steps
      if (nextIncompleteStep !== -1 && feedback) {
        const feedbackLower = feedback.toLowerCase();
        
        // Require VERY specific completion phrases with exclamation marks AND proof
        const hasStrongCompletion = (
          (feedbackLower.includes('great!') && feedbackLower.includes('step')) ||
          (feedbackLower.includes('perfect!') && feedbackLower.includes('step')) ||
          (feedbackLower.includes('excellent!') && feedbackLower.includes('step')) ||
          (feedbackLower.includes('completed') && feedbackLower.includes('!')) ||
          (feedbackLower.includes('done!') && feedbackLower.includes('step'))
        );
        
        // Also check if AI provided proof
        const hasProof = data.proof && data.proof.length > 10;
        const proofInFeedback = feedbackLower.includes('proof:');
        
        // Log what we received for debugging
        console.group(`🔍 Completion Check - Step ${nextIncompleteStep + 1}`);
        console.log(`Strong Completion Phrase: ${hasStrongCompletion ? '✅ YES' : '❌ NO'}`);
        console.log(`Has Proof Field: ${hasProof ? '✅ YES' : '❌ NO'} (${data.proof?.length || 0} chars)`);
        console.log(`Proof in Feedback: ${proofInFeedback ? '✅ YES' : '❌ NO'}`);
        console.log(`Feedback: "${feedback}"`);
        if (data.proof) {
          console.log(`Proof: "${data.proof}"`);
        }
        console.groupEnd();
        
        if (hasStrongCompletion && (hasProof || proofInFeedback)) {
          // Mark the next incomplete sub-instruction as complete
          const stepToComplete = nextIncompleteStep + 1;
          
          // Prevent duplicate completions
          if (!completedSubInstructions.has(stepToComplete)) {
            completedSubInstructions.add(stepToComplete);
            const proof = data.proof || 'AI verified completion';
            console.group(`✅ MARKING COMPLETE - Step ${stepToComplete}`);
            console.log(`Instruction: "${activeTask.subInstructions[nextIncompleteStep]}"`);
            console.log(`Proof: "${proof}"`);
            console.log(`Full AI Response:`, data);
            console.groupEnd();
            
            // Animate the completion
            setTimeout(() => {
              const stepElement = document.getElementById(`sub-step-${stepToComplete}`);
              if (stepElement) {
                stepElement.style.transform = 'scale(1.05)';
                setTimeout(() => {
                  stepElement.style.transform = 'scale(1)';
                  updateStepsList();
                }, 200);
              }
            }, 300);
          }
        } else if (hasStrongCompletion && !hasProof && !proofInFeedback) {
          console.group('⚠️ IGNORING - No Proof Provided');
          console.warn(`AI tried to mark step complete without proof`);
          console.warn(`Feedback: "${feedback}"`);
          console.warn(`data.proof: ${data.proof || 'undefined'}`);
          console.groupEnd();
        }
      }
    }

    // Check if ALL sub-instructions are actually complete (ignore AI's taskComplete flag)
    const allSubInstructionsComplete = activeTask && 
                                       activeTask.subInstructions && 
                                       activeTask.subInstructions.length > 0 &&
                                       completedSubInstructions.size === activeTask.subInstructions.length;
    
    // Only move to next task when ALL sub-instructions are manually completed
    if (allSubInstructionsComplete && stepCount < tasks.length) {
      console.group('🎯 TASK COMPLETION - All Sub-Instructions Done');
      console.log('Completed sub-instructions:', Array.from(completedSubInstructions));
      console.log('Total sub-instructions:', activeTask.subInstructions.length);
      console.log('Moving to next task...');
      console.groupEnd();
      
      logAction('task_completed', `Completed: ${currentTask.text}`);
      setTimeout(() => {
        stepCount++;
        completedSubInstructions.clear(); // Reset for next task
        updateCurrentTaskDisplay(); // Update task display with new task
        if (status) {
          status.textContent = '💡 Ready for next step';
        }
        updateStepsList(); // Update the steps list
      }, 1500);
    } else if (allSubInstructionsComplete && stepCount === tasks.length) {
      console.group('🎉 ALL TASKS COMPLETION - All Sub-Instructions Done');
      console.log('All tasks completed through manual sub-instruction completion');
      console.log('Total tasks:', tasks.length);
      console.groupEnd();
      
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

      // Send completion event to backend to mark onboarding as complete
      logAction('training_completed', 'All tasks finished');
      console.log('🎉 Training complete! Notifying backend...');
      
      // Mark onboarding as complete in backend
      fetch('http://localhost:3000/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: internEmail,
          completedAt: new Date().toISOString()
        })
      }).then(res => {
        if (res.ok) {
          console.log('✅ Backend notified of completion');
        }
      }).catch(err => {
        console.error('❌ Failed to notify backend:', err);
      });
    }

  } catch (error) {
    const aiFeedback = document.getElementById('ai-feedback');
    const status = document.getElementById('status-message');

    // Check for extension context invalidation
    if (error.message.includes('Extension context invalidated')) {
      console.error('🔄 Extension was reloaded - page needs refresh');
      if (aiFeedback) {
        aiFeedback.textContent = '🔄 Extension updated. Please reload this page to continue.';
        aiFeedback.style.display = 'block';
        aiFeedback.style.background = '#fff3cd';
        aiFeedback.style.borderLeft = '3px solid #ff9800';
        aiFeedback.style.color = '#856404';
      }
      if (status) {
        status.textContent = '🔄 Please reload page';
      }
      analysisInProgress = false;
      return;
    }

    // Log detailed error information
    console.group('❌ AI Analysis Error');
    console.error('Error message:', error.message);
    console.error('Error type:', error.name);
    console.error('Full error:', error);
    console.error('Screenshot captured:', screenshot ? 'Yes' : 'No');
    console.error('Screenshot length:', screenshot?.length || 0);
    console.error('Current task:', currentTask);
    console.groupEnd();

    if (aiFeedback) {
      if (error.message.includes('Failed to fetch')) {
        aiFeedback.textContent = '⚠️ Backend offline. Start with: node backend/index.js';
        aiFeedback.style.display = 'block';
        aiFeedback.style.background = '#fff3cd';
        aiFeedback.style.borderLeft = '3px solid #ff9800';
        aiFeedback.style.color = '#856404';
      } else if (error.message.includes('aborted')) {
        aiFeedback.textContent = '⚠️ Analysis timeout - screenshot took too long';
        aiFeedback.style.display = 'block';
        aiFeedback.style.background = '#fff3cd';
        aiFeedback.style.borderLeft = '3px solid #ff9800';
        aiFeedback.style.color = '#856404';
      } else {
        aiFeedback.textContent = `⚠️ AI analysis error: ${error.message}`;
        aiFeedback.style.display = 'block';
        aiFeedback.style.background = '#fff3cd';
        aiFeedback.style.borderLeft = '3px solid #ff9800';
        aiFeedback.style.color = '#856404';
      }
    }

    if (status) {
      status.textContent = `⚠️ Error: ${error.message.substring(0, 50)}`;
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

// Start AI analysis loop - every 5 seconds
setInterval(analyzeWithAI, 5000);
