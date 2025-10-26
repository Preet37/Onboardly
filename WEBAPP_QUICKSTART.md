# Webapp Widget - Quick Start Guide

Get the AI Onboarding Coach running as an embeddable widget in **5 minutes**!

## What You're Building

An onboarding platform with an AI coach embedded directly in your webapp:

```
┌─────────────────────────────────────────────────┐
│  Your Webapp Header                             │
├──────────────────┬──────────────────────────────┤
│ Onboarding Tasks │  GCP Console (iframe)        │
│  ☐ Jira Setup    │                              │
│  ☑ GCP Storage   │  [Your users work here]      │
│  ☐ GCP Function  │                              │
└──────────────────┴──────────────────────────────┘
                                      ┌────────────┐
                                      │ AI Coach   │
                                      │ Panel      │
                                      │            │
                                      │ ✅ Status  │
                                      │ 📝 Advice  │
                                      └────────────┘
```

The AI watches what happens in the iframe and provides real-time coaching!

## Prerequisites

- Python 3.8+ installed
- A web browser (Chrome, Firefox, Safari, or Edge)
- Basic HTML/JavaScript knowledge

## Step 1: Start the Backend (2 minutes)

### Install Dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### Start the Server

```bash
python app.py
```

You should see:
```
 * Running on http://127.0.0.1:5000
```

✅ **Backend is ready!**

## Step 2: Serve the Webapp Files (1 minute)

Open a new terminal and navigate to the webapp directory:

```bash
cd webapp
```

Choose one method to serve the files:

### Option A: Python HTTP Server (Easiest)
```bash
python -m http.server 8080
```

### Option B: Node.js HTTP Server
```bash
npx http-server -p 8080
```

### Option C: PHP Server
```bash
php -S localhost:8080
```

You should see:
```
Serving HTTP on 0.0.0.0 port 8080 ...
```

✅ **Webapp server is ready!**

## Step 3: Open the Demo (30 seconds)

1. Open your browser
2. Navigate to: `http://localhost:8080/demo.html`
3. You should see the onboarding platform with:
   - Sidebar with tasks on the left
   - Main content area
   - AI Coach control panel (purple gradient box in top-right)

✅ **Demo is loaded!**

## Step 4: Start Coaching (1 minute)

1. **Click "Start Monitoring"** in the AI Coach control panel
2. **Browser will prompt for screen sharing permission**
   - Click "Allow" or "Share"
   - Select the browser tab/window you want to monitor
3. **AI Coach status** changes to "Monitoring" (green dot)
4. **Wait 5 seconds** - the first analysis will happen automatically

## Step 5: See It In Action (30 seconds)

### Option A: Use the Demo Iframe

1. Click "GCP Cloud Storage" in the sidebar
2. The GCP Console loads in an iframe
3. AI Coach analyzes the iframe content
4. Guidance panel appears in 5-10 seconds!

### Option B: Open a Real Page

1. In another tab, navigate to `https://console.cloud.google.com`
2. The AI Coach will analyze that tab
3. Guidance appears based on what you're doing

✅ **You're now being coached!**

## What Happens Next?

Every **5 seconds**, the AI Coach:

1. 📸 **Captures** a screenshot using Screen Capture API
2. 🤖 **Analyzes** the screenshot with Gemini Vision AI
3. 🧠 **Compares** to the expected onboarding step
4. 💬 **Coaches** you with personalized guidance
5. ✨ **Displays** the guidance panel with:
   - Status indicator (✅ On Track, ⚠️ Issues, etc.)
   - Specific problems detected
   - Next actions to take
   - Explanation of WHY

## Common First-Time Issues

### "Screen capture permission denied"

**Solution:**
- Reload the page
- Click "Start Monitoring" again
- When prompted, make sure to click "Allow" and select the correct window/tab

---

### "Cannot connect to backend"

**Solution:**
1. Check backend is running: `curl http://localhost:5000/health`
2. Should return: `{"status":"healthy","gemini_configured":true}`
3. If not, restart the backend server

---

### "No guidance appearing"

**Solution:**
- Wait 5 seconds after starting monitoring
- Check browser console (F12) for errors
- Ensure you're on a page that matches the selected task
- Try manually advancing the step using Prev/Next buttons

## Integrating Into Your Own Webapp

### Minimal Integration (2 lines of code)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Onboarding Platform</title>
</head>
<body>
  <h1>Welcome to Onboarding!</h1>

  <!-- Your onboarding content here -->
  <iframe src="https://console.cloud.google.com/storage"></iframe>

  <!-- AI Coach Widget - Just add these 2 scripts! -->
  <script src="http://localhost:8080/ai-coach-widget.js"></script>
  <script>
    AICoach.init({
      apiUrl: 'http://localhost:5000',
      taskType: 'gcp_storage',
      captureInterval: 5000
    });
  </script>
</body>
</html>
```

That's it! The AI Coach is now embedded in your webapp.

### Configuration Options

```javascript
AICoach.init({
  // Backend API URL (required)
  apiUrl: 'http://localhost:5000',

  // Initial task type (required)
  taskType: 'gcp_storage', // 'jira', 'conversion', 'gcp_function'

  // Capture interval in milliseconds (optional, default: 5000)
  captureInterval: 5000, // 5 seconds

  // Control panel position (optional, default: 'right')
  position: 'right', // 'left', 'bottom-right'

  // Auto-start monitoring on load (optional, default: false)
  autoStart: false
});
```

## Next Steps

### 1. Customize the Widget

Edit `ai-coach-widget.css` to match your brand:

```css
.ai-coach-control {
  background: linear-gradient(135deg, #your-color-1, #your-color-2) !important;
}
```

### 2. Add More Tasks

Edit `backend/app.py` to add your own onboarding tasks:

```python
ONBOARDING_CHECKLISTS = {
    "my_task": {
        "name": "My Custom Task",
        "steps": [
            {
                "id": 1,
                "description": "First step",
                "keywords": ["keyword1", "keyword2"],
                "required_fields": ["field_name"]
            },
            # ... more steps
        ]
    }
}
```

Then add the option to `webapp/demo.html`:

```html
<option value="my_task">My Custom Task</option>
```

### 3. Deploy to Production

See [webapp/README.md](webapp/README.md) for production deployment guide including:
- HTTPS configuration
- CORS security
- Asset minification
- CDN hosting

### 4. Advanced Features

The widget exposes a JavaScript API:

```javascript
// Start monitoring programmatically
AICoach.start();

// Stop monitoring
AICoach.stop();

// Set current step manually
AICoach.setStep(3);

// Get current status
const status = AICoach.getStatus();
console.log(status.isMonitoring); // true/false
console.log(status.currentStep);  // 1-7
console.log(status.taskType);     // 'gcp_storage'
```

## Troubleshooting

### Check Backend Health

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "gemini_configured": true
}
```

### Check Gemini API Key

```bash
cat backend/.env
```

Should show:
```
GEMINI_API_KEY=AIza...
```

### View Browser Console Logs

1. Press F12 to open DevTools
2. Click "Console" tab
3. Look for:
   - `AI Onboarding Coach initialized`
   - `Screenshot captured, analyzing...`
   - Any error messages

### Test Screenshot API Directly

```bash
curl -X POST http://localhost:5000/api/screenshot/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "screenshot": "data:image/png;base64,iVBORw0KG...",
    "task_type": "gcp_storage",
    "current_step": 1
  }'
```

## Comparison: Widget vs Extension

| Feature | Webapp Widget | Chrome Extension |
|---------|--------------|------------------|
| Browser Support | All modern browsers | Chrome only |
| Installation | `<script>` tag | Load unpacked extension |
| Use Case | Your own webapp | Any website |
| Capture Interval | 5s (configurable) | 10s (configurable) |
| User Permission | Screen sharing | Screen sharing |
| Deployment | Simple (host files) | Extension store submission |

**Recommendation:** Use the **webapp widget** if you're embedding the coach in your own onboarding platform. Use the **extension** if you need to monitor external sites you don't control.

## Support

- Full documentation: [webapp/README.md](webapp/README.md)
- GCP task guides: [GCP_TASKS.md](GCP_TASKS.md)
- Main README: [README.md](README.md)

## Success! 🎉

You now have an AI-powered onboarding coach embedded in your webapp that:
- ✅ Watches user actions in real-time
- ✅ Provides context-aware coaching
- ✅ Detects and explains mistakes
- ✅ Guides users like a senior engineer would

**Total setup time: ~5 minutes**

Ready to build amazing onboarding experiences! 🚀
