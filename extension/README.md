# AI Onboarding Coach - Chrome Extension

## Installation & Setup

### 1. Load the Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Select the `/Users/danielachacon/projects/Onboardly/extension` folder
5. The extension should now appear in your extensions list

### 2. Reload After Changes

**Every time you make changes to the extension files**, you must reload it:

1. Go to `chrome://extensions/`
2. Find "AI Onboarding Coach"
3. Click the **reload icon** (circular arrow) ⟳
4. Refresh any open GCP Console tabs

### 3. View Console Logs

To debug screenshot capture issues:

1. Right-click the extension icon → **Manage Extension**
2. Click **Service Worker** link under "Inspect views"
3. This opens DevTools for the background script
4. Check the Console tab for screenshot capture logs

To debug content script issues:

1. Open the GCP Console page
2. Press F12 to open DevTools
3. Go to Console tab
4. Look for logs prefixed with 🤖, 📸, ✅, or ❌

### 4. Troubleshooting Screenshot Capture

If you see "Failed to capture screenshot":

**Solution 1: Reload the Extension**
- Go to `chrome://extensions/`
- Click reload ⟳ on "AI Onboarding Coach"
- Refresh the GCP Console tab

**Solution 2: Check Permissions**
- The extension needs permission to capture the visible tab
- Make sure you're on `https://console.cloud.google.com/*`
- Check that the extension icon shows as active

**Solution 3: Verify Backend is Running**
- Backend should be running on `http://localhost:5000`
- Check backend console for incoming requests
- Make sure Flask app is active

**Solution 4: Check for Extension Conflicts**
- Other screenshot or security extensions might interfere
- Try disabling other extensions temporarily

### 5. Expected Behavior

When working correctly, you should see:

1. Coach panel appears on GCP Console pages
2. Every 5 seconds, a screenshot is captured
3. Screenshot is sent to backend for analysis
4. AI guidance appears in the panel
5. Steps advance automatically when correct

### Console Output (Success)

```
🤖 AI Onboarding Coach loaded on GCP Console
✅ AI Coach monitoring started
🔍 Starting capture and analyze...
📸 Capture request received from tab: 12345
🔍 Attempting to capture tab 12345 in window 1
✅ Screenshot captured successfully, size: 50000 chars
📸 Screenshot captured successfully, length: 50000
✅ Analysis complete: {...}
```

### Console Output (Error)

```
❌ Runtime error: Cannot access contents of the page...
❌ Screenshot capture error: ...
❌ No response from background script
```

## Files

- `manifest.json` - Extension configuration
- `background.js` - Background service worker (handles screenshots)
- `content.js` - Content script (UI and API calls)
- `content.css` - Styling for coach panel
- `icon*.png` - Extension icons

## Permissions

The extension requires:
- `activeTab` - Access the currently active tab
- `tabs` - Access tab information
- `storage` - Store user preferences
- `notifications` - Show notifications
- Host permission for `https://console.cloud.google.com/*`
