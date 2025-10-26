# Chrome Extension Integration with Onboarding Flow

## Overview

The Chrome extension now integrates with the onboarding workflow visualization. When an intern opens the extension on Google Cloud Console, it signals the backend to mark the "opened" step as completed in the real-time visualization.

## How It Works

### 1. **Onboarding Flow Starts**
- User submits intern name, email, and onboarding prompt on frontend (http://localhost:5173)
- Backend generates Jira tasks, sends welcome email, and starts SSE stream
- Visualization shows:
  - ✅ AI Analyzing → Completed
  - ✅ Generating Tasks → Completed
  - ✅ Sending to Intern → Completed
  - 🔄 **Intern Opening Training → Running (waiting)**
  - ⭕ Not Yet Onboarded → Pending (gray/uncolored)

### 2. **Intern Receives Welcome Email**
- Email contains:
  - Jira board link with all onboarding tasks
  - Calendar invite for first meeting
  - **Chrome Extension activation link** (chrome-extension://YOUR_EXTENSION_ID/activate.html?email=intern@example.com)

### 3. **Extension Activation**
- Intern clicks the activation link
- Opens `activate.html` which stores their email in `chrome.storage.local`
- Redirects to https://console.cloud.google.com/

### 4. **Extension Opens & Notifies Backend**
- When intern navigates to console.cloud.google.com, the extension's content script loads
- `content.js` checks `chrome.storage.local` for the intern's email
- If found, sends POST request to `http://localhost:3000/extension-opened` with the email
- Backend looks up the active SSE session and sends progress update:
  - ✅ **Intern Opening Training → Completed**
  - ✅ **Not Yet Onboarded → Onboarded** (node name changes + turns green)
- SSE stream closes, visualization complete!

## Files Modified/Created

### Backend (`/backend/index.js`)
- **Added `activeSessions` Map**: Tracks ongoing onboarding sessions by intern email
- **Modified `/onboard` endpoint**:
  - Stores session data with SSE `sendProgress` function
  - Removes simulated "opened" step
  - Leaves SSE stream open, waiting for extension notification
- **Created `/extension-opened` endpoint**:
  - Receives notification from extension
  - Sends "opened" completed + "onboarded" completed events
  - Closes SSE stream
- **Updated CORS**: Allows chrome-extension:// origins
- **Updated email**: Includes extension activation link with intern's email

### Extension
- **Modified `/extension/content.js`**:
  - Added `ONBOARDING_API_URL` constant
  - Added `notifyExtensionOpened()` function
  - Checks chrome.storage for intern email on load
  - Sends POST to backend if email found
  - Clears email after successful notification

- **Created `/extension/activate.html`**:
  - Activation page linked from welcome email
  - Extracts email from URL parameter
  - Stores in chrome.storage.local
  - Redirects to Google Cloud Console

### Frontend (`/frontend`)
- No changes needed - already supports real-time SSE updates

## Setup Instructions

### 1. Install the Chrome Extension
```bash
# Navigate to chrome://extensions/
# Enable "Developer mode"
# Click "Load unpacked"
# Select: /Users/danielachacon/projects/Onboardly/extension/
```

### 2. Get Extension ID
- After loading, copy the extension ID (e.g., `abcdefghijklmnopqrstuvwxyz`)
- Update in `/backend/index.js`:
  ```javascript
  const extensionActivationLink = `chrome-extension://YOUR_EXTENSION_ID/activate.html?email=${encodeURIComponent(intern.email)}`;
  ```

### 3. Test the Flow

1. **Start services:**
   ```bash
   # Backend
   cd /Users/danielachacon/projects/Onboardly/backend
   node index.js

   # Frontend
   cd /Users/danielachacon/projects/Onboardly/frontend
   npm run dev
   ```

2. **Open frontend**: http://localhost:5173

3. **Submit onboarding form**:
   - Name: Test Intern
   - Email: your-email@example.com
   - Prompt: "Onboard SWE intern to Google Cloud Platform"

4. **Watch visualization**: Steps 1-3 complete, Step 4 shows "Waiting for intern to open training extension..."

5. **Open extension activation link** (copy from terminal logs or email):
   - `chrome-extension://YOUR_EXTENSION_ID/activate.html?email=your-email@example.com`

6. **Navigate to console.cloud.google.com**

7. **Watch visualization complete**: Step 4 (Opened) and Step 5 (Onboarded) turn green!

## Architecture Diagram

```
┌─────────────┐
│   Frontend  │ (http://localhost:5173)
│ Visualization│
└──────┬──────┘
       │ SSE Stream (keeps connection open)
       │
┌──────▼───────────────────────────────────────┐
│             Backend Server                   │
│         (http://localhost:3000)              │
│                                              │
│  - /onboard (SSE streaming)                 │
│  - /extension-opened (receives notification)│
│  - activeSessions Map (tracks sessions)     │
└──────┬─────────────────────────▲─────────────┘
       │                         │
       │ Sends email             │ POST /extension-opened
       │ with activation link    │ { internEmail: "..." }
       │                         │
┌──────▼──────┐           ┌──────┴─────────┐
│   Intern    │           │   Chrome Ext   │
│   Email     │           │  content.js    │
└─────────────┘           └────────────────┘
       │                         ▲
       │ Clicks link             │
       └──────────────────┬──────┘
                          │
                   ┌──────▼──────────┐
                   │  activate.html  │
                   │ (stores email)  │
                   └─────────────────┘
```

## Key Implementation Details

### Backend Session Management
```javascript
// Store session when /onboard starts
const sessionData = {
  sendProgress,
  intern,
  res  // SSE response object
};
activeSessions.set(intern.email, sessionData);

// Retrieve and use when extension notifies
const session = activeSessions.get(internEmail);
session.sendProgress('opened', 'completed', { ... });
```

### Extension Storage Flow
```javascript
// activate.html sets email
await chrome.storage.local.set({ internEmail });

// content.js reads and notifies
const data = await chrome.storage.local.get(['internEmail']);
fetch(`${ONBOARDING_API_URL}/extension-opened`, {
  method: 'POST',
  body: JSON.stringify({ internEmail: data.internEmail })
});

// Clear after successful notification
await chrome.storage.local.remove(['internEmail']);
```

### SSE Event Flow
```javascript
// Step 4 stays in "running" state
sendProgress('opened', 'running', { message: 'Waiting...' });

// Stream stays open - no res.end()

// When extension notifies:
sendProgress('opened', 'completed', { ... });
sendProgress('onboarded', 'completed', { ... });
res.write('data: {"step":"done",...}\n\n');
res.end();  // Now close the stream
```

## Visualization States

### Before Extension Opens
- **opened node**: Gray ring (status: 'running')
- **onboarded node**: Gray ring (status: 'pending'), text: "Not Yet Onboarded", verb: "Waiting"

### After Extension Opens
- **opened node**: Green ring (status: 'completed'), text: "Intern Opening Training", verb: "Opened"
- **onboarded node**: Green ring (status: 'completed'), text: "Onboarded", verb: "Onboarded"

## Troubleshooting

### Extension doesn't notify backend
- Check browser console for errors
- Verify extension ID is correct in email link
- Ensure backend CORS allows chrome-extension:// origins
- Check chrome.storage has the email: `chrome.storage.local.get(['internEmail'], console.log)`

### Visualization stuck on "Waiting..."
- Check backend logs for `/extension-opened` request
- Verify activeSessions Map has the intern's email
- Ensure SSE connection is still open (check Network tab)

### Email activation link doesn't work
- Ensure extension is loaded in chrome://extensions/
- Check extension ID matches the one in backend code
- Try manually navigating to the activation URL with `?email=test@example.com`

## Future Enhancements

- Add timeout for extension opening (e.g., 1 hour)
- Store sessions in Redis instead of in-memory Map
- Add webhook for intern completing tasks in extension
- Track extension usage analytics
- Support multiple simultaneous onboarding sessions
