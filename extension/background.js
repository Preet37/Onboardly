m/**
 * AI Onboarding Coach - Background Service Worker
 * Handles screenshot capture
 */

// AI Onboarding Coach background service worker

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'captureTab') {
    const tabId = sender.tab?.id;
    const windowId = sender.tab?.windowId;

    if (!tabId) {
      sendResponse({ success: false, error: 'No tab ID available' });
      return true;
    }
    
    if (!windowId) {
      sendResponse({ success: false, error: 'No window ID available' });
      return true;
    }

    // Capture the visible tab
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else if (!dataUrl) {
        sendResponse({ success: false, error: 'No screenshot data' });
      } else {
        sendResponse({ success: true, screenshot: dataUrl });
      }
    });

    return true;
  }

  return false;
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
  if (!tab.url || !tab.url.includes('console.cloud.google.com')) {
    if (chrome.notifications && chrome.notifications.create) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon48.png',
        title: 'AI Onboarding Coach',
        message: 'Navigate to console.cloud.google.com to start coaching'
      });
    }
  }
});
