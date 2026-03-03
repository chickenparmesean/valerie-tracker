// Valerie Agent URL Bridge — background service worker
// Tracks the active tab URL and POSTs it to the Electron agent via localhost HTTP bridge.

const BRIDGE_URL = 'http://127.0.0.1:19876/url';
const INTERNAL_PREFIXES = ['chrome://', 'chrome-extension://', 'about:', 'devtools://'];

let currentUrl = null;

function isInternalPage(url) {
  if (!url) return true;
  return INTERNAL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

function sendUrl(url) {
  const resolved = isInternalPage(url) ? null : url;
  currentUrl = resolved;
  try {
    fetch(BRIDGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: resolved }),
    }).catch(() => {});
  } catch (_) {
    // Agent may not be running — silently ignore
  }
}

// Tab switched
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (chrome.runtime.lastError) return;
    sendUrl(tab.url);
  });
});

// Page finished loading in active tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  if (!tab.active) return;
  sendUrl(tab.url);
});

// Service worker startup — query current active tab
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (chrome.runtime.lastError) return;
  if (tabs && tabs.length > 0) {
    sendUrl(tabs[0].url);
  }
});
