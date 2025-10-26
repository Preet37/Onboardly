# AI Onboarding Coach - Embeddable Widget

Browser-agnostic JavaScript widget that brings AI-powered onboarding coaching to your webapp. No Chrome extension required!

## Features

✅ **Pure JavaScript** - No framework dependencies
✅ **Browser-agnostic** - Works in Chrome, Firefox, Safari, Edge
✅ **Screen Capture API** - Captures any content including iframes
✅ **Configurable** - 5-second intervals, custom positioning
✅ **Beautiful UI** - Gradient control panel + overlay guidance
✅ **Drop-in Integration** - Single `<script>` tag to embed

## Quick Start

### 1. Start the Backend

```bash
cd backend
source venv/bin/activate
python app.py
```

Backend runs at `http://localhost:5000`

### 2. Serve the Widget Files

You can use any web server. For development:

```bash
cd webapp
python -m http.server 8080
```

Or with Node.js:
```bash
npx http-server -p 8080
```

### 3. Open the Demo

Visit `http://localhost:8080/demo.html` in your browser.

### 4. Start Coaching

1. Click "Start Monitoring" in the AI Coach control panel
2. Grant screen sharing permission when prompted
3. Navigate to an onboarding page (or use the embedded iframe)
4. Watch the AI Coach analyze and provide guidance every 5 seconds!

## Integration Guide

### Basic Integration

Add two files to your HTML:

```html
<!DOCTYPE html>
<html>
<head>
  <title>My Onboarding App</title>
  <!-- Your app styles -->
</head>
<body>
  <!-- Your app content -->

  <!-- AI Coach Widget -->
  <script src="ai-coach-widget.js"></script>
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

### Configuration Options

```javascript
AICoach.init({
  // Backend API URL
  apiUrl: 'http://localhost:5000',

  // Initial task type
  taskType: 'jira' | 'conversion' | 'gcp_storage' | 'gcp_function',

  // Screenshot capture interval (milliseconds)
  captureInterval: 5000, // 5 seconds

  // Control panel position
  position: 'right' | 'left' | 'bottom-right',

  // Auto-start monitoring on page load
  autoStart: false
});
```

### Data Attribute Configuration

You can also configure via data attributes:

```html
<script
  src="ai-coach-widget.js"
  data-auto-init="true"
  data-api-url="http://localhost:5000"
  data-task-type="gcp_storage"
  data-capture-interval="5000"
  data-position="right"
  data-auto-start="false"
></script>
```

## API Reference

### `AICoach.init(options)`

Initialize the widget with configuration options.

**Parameters:**
- `options` (Object) - Configuration object

**Returns:** void

**Example:**
```javascript
AICoach.init({
  apiUrl: 'http://localhost:5000',
  taskType: 'gcp_storage'
});
```

---

### `AICoach.start()`

Manually start monitoring (requests screen capture permission).

**Returns:** void

**Example:**
```javascript
document.getElementById('my-btn').addEventListener('click', () => {
  AICoach.start();
});
```

---

### `AICoach.stop()`

Stop monitoring and release screen capture.

**Returns:** void

**Example:**
```javascript
AICoach.stop();
```

---

### `AICoach.setStep(stepNumber)`

Manually set the current step (1-7).

**Parameters:**
- `stepNumber` (Number) - Step number between 1 and 7

**Returns:** void

**Example:**
```javascript
// Jump to step 3
AICoach.setStep(3);
```

---

### `AICoach.getStatus()`

Get current widget status.

**Returns:** Object
```javascript
{
  isMonitoring: boolean,
  taskType: string,
  currentStep: number
}
```

**Example:**
```javascript
const status = AICoach.getStatus();
console.log(`Monitoring: ${status.isMonitoring}`);
console.log(`Task: ${status.taskType}`);
console.log(`Step: ${status.currentStep}`);
```

## Advanced Integration Examples

### With React

```jsx
import { useEffect } from 'react';

function OnboardingPage() {
  useEffect(() => {
    // Load widget script
    const script = document.createElement('script');
    script.src = '/ai-coach-widget.js';
    script.onload = () => {
      window.AICoach.init({
        apiUrl: process.env.REACT_APP_API_URL,
        taskType: 'gcp_storage',
        captureInterval: 5000
      });
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup
      window.AICoach?.stop();
    };
  }, []);

  return (
    <div>
      <h1>GCP Onboarding</h1>
      <iframe src="https://console.cloud.google.com" />
    </div>
  );
}
```

### With Vue

```vue
<template>
  <div>
    <h1>GCP Onboarding</h1>
    <iframe src="https://console.cloud.google.com" />
  </div>
</template>

<script>
export default {
  mounted() {
    const script = document.createElement('script');
    script.src = '/ai-coach-widget.js';
    script.onload = () => {
      window.AICoach.init({
        apiUrl: process.env.VUE_APP_API_URL,
        taskType: 'gcp_storage',
        captureInterval: 5000
      });
    };
    document.body.appendChild(script);
  },

  beforeUnmount() {
    window.AICoach?.stop();
  }
};
</script>
```

### With Angular

```typescript
import { Component, OnInit, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.component.html'
})
export class OnboardingComponent implements OnInit, OnDestroy {
  ngOnInit() {
    const script = document.createElement('script');
    script.src = '/assets/ai-coach-widget.js';
    script.onload = () => {
      (window as any).AICoach.init({
        apiUrl: 'http://localhost:5000',
        taskType: 'gcp_storage',
        captureInterval: 5000
      });
    };
    document.body.appendChild(script);
  }

  ngOnDestroy() {
    (window as any).AICoach?.stop();
  }
}
```

### Dynamic Task Switching

```javascript
// Initialize with default task
AICoach.init({
  apiUrl: 'http://localhost:5000',
  taskType: 'jira'
});

// Switch tasks dynamically
document.getElementById('task-select').addEventListener('change', (e) => {
  const newTask = e.target.value;

  // Stop current monitoring
  AICoach.stop();

  // Reinitialize with new task
  AICoach.init({
    apiUrl: 'http://localhost:5000',
    taskType: newTask,
    autoStart: true // Auto-start with new task
  });
});
```

## How It Works

### Screen Capture Flow

```
1. User clicks "Start Monitoring"
   ↓
2. Widget requests screen sharing permission
   ↓
3. Browser prompts user to select screen/window/tab
   ↓
4. User grants permission
   ↓
5. Widget captures screenshot via ImageCapture API
   ↓
6. Screenshot sent to backend API
   ↓
7. Backend analyzes with Gemini Vision AI
   ↓
8. Guidance panel appears on screen
   ↓
9. Repeat every 5 seconds
```

### Architecture

```
┌─────────────────────┐
│   Your Webapp       │
│   (with iframe)     │
└──────────┬──────────┘
           │
┌──────────▼──────────┐
│  AI Coach Widget    │
│  (JavaScript)       │
│  - Screen Capture   │
│  - UI Overlay       │
└──────────┬──────────┘
           │
           │ HTTP POST
           │
┌──────────▼──────────┐
│  Flask Backend      │
│  - Gemini Vision    │
│  - Coaching Logic   │
└─────────────────────┘
```

## Browser Compatibility

| Browser | Version | Screen Capture API | Status |
|---------|---------|-------------------|--------|
| Chrome  | 72+     | ✅ Supported       | ✅ Works |
| Firefox | 66+     | ✅ Supported       | ✅ Works |
| Safari  | 13+     | ✅ Supported       | ✅ Works |
| Edge    | 79+     | ✅ Supported       | ✅ Works |

**Note:** Screen Capture API requires HTTPS in production (localhost is exempt).

## Deployment

### Production Checklist

1. **Enable HTTPS** - Screen Capture API requires secure context
2. **Update API URL** - Point to production backend
3. **Configure CORS** - Restrict to your domain in backend
4. **Minify assets** - Minify JS and CSS for production
5. **CDN hosting** - Host widget files on CDN for performance

### Example Production Setup

```javascript
// production-config.js
AICoach.init({
  apiUrl: 'https://api.yourcompany.com',
  taskType: 'gcp_storage',
  captureInterval: 5000,
  position: 'right'
});
```

### Backend CORS Configuration

Update `backend/app.py`:

```python
from flask_cors import CORS

# Development (all origins)
CORS(app)

# Production (specific origin)
CORS(app, origins=['https://onboarding.yourcompany.com'])
```

## Customization

### Custom Styling

Override CSS variables:

```css
:root {
  --coach-primary-color: #667eea;
  --coach-secondary-color: #764ba2;
  --coach-success-color: #4CAF50;
  --coach-error-color: #F44336;
  --coach-warning-color: #FF9800;
}
```

Or add custom styles:

```css
.ai-coach-control {
  border-radius: 20px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
}

.ai-coach-guidance {
  max-width: 500px !important;
}
```

### Custom Position

```javascript
// Bottom left corner
AICoach.init({
  position: 'left', // This will position at top-left
  // To position at bottom-left, use custom CSS:
});
```

```css
.ai-coach-control.position-left {
  top: auto !important;
  bottom: 20px;
}
```

## Troubleshooting

### "Screen capture permission denied"

**Cause:** User denied permission or browser doesn't support Screen Capture API

**Solution:**
1. Ensure you're using a supported browser (Chrome 72+, Firefox 66+, etc.)
2. Use HTTPS (or localhost for development)
3. Click "Start Monitoring" again and grant permission

---

### "Backend connection failed"

**Cause:** Backend not running or CORS issue

**Solution:**
1. Verify backend is running: `curl http://localhost:5000/health`
2. Check browser console for CORS errors
3. Ensure CORS is enabled in backend

---

### "Guidance not appearing"

**Cause:** Screenshot analysis failing or Gemini API issue

**Solution:**
1. Check browser console for errors
2. Verify Gemini API key in `backend/.env`
3. Check backend logs for errors
4. Increase capture interval if rate-limited

---

### "Widget not loading"

**Cause:** Script path incorrect or CORS blocking

**Solution:**
1. Verify script path: `<script src="./ai-coach-widget.js"></script>`
2. Check browser console for 404 errors
3. Ensure CSS file is in same directory as JS

---

## Performance Considerations

### Capture Interval

- **5 seconds** (default): Good balance between responsiveness and performance
- **3 seconds**: More responsive, higher CPU usage
- **10 seconds**: Lower CPU usage, less responsive

```javascript
AICoach.init({
  captureInterval: 3000 // 3 seconds
});
```

### Image Quality

Screenshots are captured at screen resolution. For lower bandwidth:

Modify `ai-coach-widget.js`:
```javascript
// Change canvas.toDataURL quality
const screenshotDataUrl = canvas.toDataURL('image/jpeg', 0.7); // 70% quality
```

## Examples

See `demo.html` for a complete working example with:
- Sidebar task selection
- Iframe integration
- Dynamic task switching
- Custom styling

## Support

For issues or questions:
- Check the [main README](../README.md)
- Review [GCP_TASKS.md](../GCP_TASKS.md) for task details
- Open an issue on GitHub

## License

MIT License - Same as main project

---

**Built with ❤️ using Screen Capture API and Gemini AI**
