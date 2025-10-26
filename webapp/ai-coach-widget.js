/**
 * AI Onboarding Coach - Embeddable Widget
 *
 * Usage:
 *   <script src="ai-coach-widget.js"></script>
 *   <script>
 *     AICoach.init({
 *       apiUrl: 'http://localhost:5000',
 *       taskType: 'gcp_storage',
 *       captureInterval: 5000
 *     });
 *   </script>
 */

(function(window) {
  'use strict';

  // Widget state
  let isMonitoring = false;
  let captureInterval = null;
  let mediaStream = null;
  let currentStep = 1;
  let config = {
    apiUrl: 'http://localhost:5000',
    taskType: 'jira',
    captureInterval: 5000, // 5 seconds
    position: 'right', // 'right', 'left', 'bottom-right'
    autoStart: false
  };

  // UI Elements
  let controlPanel = null;
  let guidancePanel = null;

  /**
   * Initialize the AI Coach Widget
   */
  function init(options) {
    // Merge user config with defaults
    config = Object.assign({}, config, options);

    // Load CSS
    loadStyles();

    // Create control panel
    createControlPanel();

    // Auto-start if configured
    if (config.autoStart) {
      setTimeout(() => startMonitoring(), 1000);
    }

    console.log('AI Onboarding Coach initialized', config);
  }

  /**
   * Load widget styles dynamically
   */
  function loadStyles() {
    // Check if styles already loaded
    if (document.getElementById('ai-coach-widget-styles')) {
      return;
    }

    const link = document.createElement('link');
    link.id = 'ai-coach-widget-styles';
    link.rel = 'stylesheet';
    link.href = 'ai-coach-widget.css';
    document.head.appendChild(link);
  }

  /**
   * Create floating control panel
   */
  function createControlPanel() {
    controlPanel = document.createElement('div');
    controlPanel.id = 'ai-coach-control';
    controlPanel.className = `ai-coach-control position-${config.position}`;

    controlPanel.innerHTML = `
      <div class="control-header">
        <span class="control-title">AI Coach</span>
        <button class="control-toggle" id="coach-toggle">▼</button>
      </div>
      <div class="control-body" id="coach-control-body">
        <div class="status-indicator">
          <span class="indicator-dot" id="status-dot"></span>
          <span id="status-text">Inactive</span>
        </div>

        <div class="task-info">
          <label>Task:</label>
          <select id="task-select">
            <option value="jira">Jira Account Setup</option>
            <option value="conversion">Conversion Account Setup</option>
            <option value="gcp_storage">GCP Cloud Storage</option>
            <option value="gcp_function">GCP Cloud Function</option>
          </select>
        </div>

        <div class="step-info">
          <label>Step:</label>
          <div class="step-controls">
            <button id="prev-step" disabled>◀</button>
            <span id="current-step">1/7</span>
            <button id="next-step">▶</button>
          </div>
        </div>

        <button class="btn-primary" id="start-btn">Start Monitoring</button>
        <button class="btn-danger" id="stop-btn" style="display:none;">Stop Monitoring</button>
      </div>
    `;

    document.body.appendChild(controlPanel);

    // Set initial task
    document.getElementById('task-select').value = config.taskType;

    // Attach event listeners
    attachControlPanelListeners();
  }

  /**
   * Attach event listeners to control panel
   */
  function attachControlPanelListeners() {
    // Toggle control panel
    document.getElementById('coach-toggle').addEventListener('click', () => {
      const body = document.getElementById('coach-control-body');
      const toggle = document.getElementById('coach-toggle');
      if (body.style.display === 'none') {
        body.style.display = 'block';
        toggle.textContent = '▼';
      } else {
        body.style.display = 'none';
        toggle.textContent = '▶';
      }
    });

    // Task selection
    document.getElementById('task-select').addEventListener('change', (e) => {
      config.taskType = e.target.value;
      currentStep = 1;
      updateStepDisplay();
    });

    // Step controls
    document.getElementById('prev-step').addEventListener('click', () => {
      if (currentStep > 1) {
        currentStep--;
        updateStepDisplay();
      }
    });

    document.getElementById('next-step').addEventListener('click', () => {
      if (currentStep < 7) {
        currentStep++;
        updateStepDisplay();
      }
    });

    // Start/Stop buttons
    document.getElementById('start-btn').addEventListener('click', startMonitoring);
    document.getElementById('stop-btn').addEventListener('click', stopMonitoring);
  }

  /**
   * Update step display
   */
  function updateStepDisplay() {
    document.getElementById('current-step').textContent = `${currentStep}/7`;
    document.getElementById('prev-step').disabled = currentStep <= 1;
    document.getElementById('next-step').disabled = currentStep >= 7;
  }

  /**
   * Start monitoring
   */
  async function startMonitoring() {
    if (isMonitoring) {
      return;
    }

    try {
      // Request screen capture permission
      mediaStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });

      isMonitoring = true;
      updateStatus('active', 'Monitoring');

      // Show stop button
      document.getElementById('start-btn').style.display = 'none';
      document.getElementById('stop-btn').style.display = 'block';

      // Disable task selector
      document.getElementById('task-select').disabled = true;

      // Capture immediately
      captureAndAnalyze();

      // Set up interval
      captureInterval = setInterval(() => {
        captureAndAnalyze();
      }, config.captureInterval);

      console.log('AI Coach monitoring started');

    } catch (error) {
      console.error('Failed to start screen capture:', error);
      alert('Screen capture permission denied. Please allow screen sharing to use the AI Coach.');
      stopMonitoring();
    }
  }

  /**
   * Stop monitoring
   */
  function stopMonitoring() {
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }

    isMonitoring = false;
    updateStatus('inactive', 'Inactive');

    // Show start button
    document.getElementById('start-btn').style.display = 'block';
    document.getElementById('stop-btn').style.display = 'none';

    // Enable task selector
    document.getElementById('task-select').disabled = false;

    // Hide guidance panel
    if (guidancePanel) {
      guidancePanel.remove();
      guidancePanel = null;
    }

    console.log('AI Coach monitoring stopped');
  }

  /**
   * Update status indicator
   */
  function updateStatus(status, text) {
    const dot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    dot.className = `indicator-dot ${status}`;
    statusText.textContent = text;
  }

  /**
   * Capture screenshot and analyze
   */
  async function captureAndAnalyze() {
    if (!mediaStream || !isMonitoring) {
      return;
    }

    try {
      // Capture frame from video stream
      const videoTrack = mediaStream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(videoTrack);
      const bitmap = await imageCapture.grabFrame();

      // Convert to canvas
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);

      // Convert to base64
      const screenshotDataUrl = canvas.toDataURL('image/png');

      console.log('Screenshot captured, analyzing...');

      // Send to backend for analysis
      const analysis = await analyzeScreenshot(screenshotDataUrl);

      if (analysis.success) {
        // Get coaching guidance
        const guidance = await getGuidance(analysis.analysis);

        if (guidance.success) {
          // Show guidance panel
          showGuidancePanel(guidance.guidance, analysis.analysis);
        }
      }

    } catch (error) {
      console.error('Error capturing and analyzing:', error);
    }
  }

  /**
   * Send screenshot to backend for analysis
   */
  async function analyzeScreenshot(screenshotDataUrl) {
    const response = await fetch(`${config.apiUrl}/api/screenshot/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        screenshot: screenshotDataUrl,
        task_type: config.taskType,
        current_step: currentStep
      })
    });

    return await response.json();
  }

  /**
   * Get coaching guidance from backend
   */
  async function getGuidance(analysis) {
    const response = await fetch(`${config.apiUrl}/api/coaching/guidance`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        analysis,
        task_type: config.taskType,
        current_step: currentStep
      })
    });

    return await response.json();
  }

  /**
   * Show guidance panel with AI coaching
   */
  function showGuidancePanel(guidance, analysis) {
    // Remove existing panel
    if (guidancePanel) {
      guidancePanel.remove();
    }

    // Create new panel
    guidancePanel = document.createElement('div');
    guidancePanel.className = `ai-coach-guidance position-${config.position}`;

    // Status colors
    const statusColors = {
      'correct': '#4CAF50',
      'wrong_step': '#FF9800',
      'has_errors': '#F44336',
      'incomplete': '#2196F3'
    };

    const statusLabels = {
      'correct': 'On Track!',
      'wrong_step': 'Wrong Step',
      'has_errors': 'Errors Detected',
      'incomplete': 'Incomplete'
    };

    const status = guidance.step_status || 'unknown';
    const statusColor = statusColors[status] || '#9E9E9E';
    const statusLabel = statusLabels[status] || 'Analyzing...';

    guidancePanel.innerHTML = `
      <div class="guidance-header">
        <span class="guidance-title">AI Coach - Step ${currentStep}</span>
        <button class="guidance-close" id="close-guidance">✕</button>
      </div>

      <div class="guidance-body">
        <div class="status-badge" style="background: ${statusColor};">
          ${statusLabel}
        </div>

        <div class="guidance-section">
          <div class="section-title">Message:</div>
          <div class="section-content">${guidance.message || 'No message'}</div>
        </div>

        ${guidance.specific_issues && guidance.specific_issues.length > 0 ? `
          <div class="guidance-section">
            <div class="section-title" style="color: #F44336;">Issues Found:</div>
            <ul class="section-list">
              ${guidance.specific_issues.map(issue => `<li>${issue}</li>`).join('')}
            </ul>
          </div>
        ` : ''}

        ${guidance.next_actions && guidance.next_actions.length > 0 ? `
          <div class="guidance-section">
            <div class="section-title" style="color: #4CAF50;">Next Steps:</div>
            <ol class="section-list">
              ${guidance.next_actions.map(action => `<li>${action}</li>`).join('')}
            </ol>
          </div>
        ` : ''}

        ${guidance.explanation ? `
          <div class="guidance-section">
            <div class="section-title">Why:</div>
            <div class="section-content explanation">${guidance.explanation}</div>
          </div>
        ` : ''}

        <div class="guidance-footer">
          Current page: ${analysis.current_page || 'Unknown'}
        </div>
      </div>
    `;

    document.body.appendChild(guidancePanel);

    // Close button
    document.getElementById('close-guidance').addEventListener('click', () => {
      guidancePanel.remove();
      guidancePanel = null;
    });

    // Auto-hide after 30 seconds if status is correct
    if (status === 'correct') {
      setTimeout(() => {
        if (guidancePanel) {
          guidancePanel.style.transition = 'opacity 0.5s';
          guidancePanel.style.opacity = '0';
          setTimeout(() => {
            if (guidancePanel) {
              guidancePanel.remove();
              guidancePanel = null;
            }
          }, 500);
        }
      }, 30000);
    }
  }

  // Expose public API
  window.AICoach = {
    init: init,
    start: startMonitoring,
    stop: stopMonitoring,
    setStep: (step) => {
      currentStep = Math.max(1, Math.min(7, step));
      updateStepDisplay();
    },
    getStatus: () => ({
      isMonitoring,
      taskType: config.taskType,
      currentStep
    })
  };

  // Auto-initialize on DOM ready if data attributes present
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAutoInit);
  } else {
    checkAutoInit();
  }

  function checkAutoInit() {
    const script = document.querySelector('script[src*="ai-coach-widget.js"]');
    if (script && script.dataset.autoInit === 'true') {
      const options = {
        apiUrl: script.dataset.apiUrl || config.apiUrl,
        taskType: script.dataset.taskType || config.taskType,
        captureInterval: parseInt(script.dataset.captureInterval) || config.captureInterval,
        position: script.dataset.position || config.position,
        autoStart: script.dataset.autoStart === 'true'
      };
      init(options);
    }
  }

})(window);
