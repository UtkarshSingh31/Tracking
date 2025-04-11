const BACKEND_URL = "http://127.0.0.1:5000/log-activity";
let activeTabId = null;
let startTime = null;
const tabData = new Map(); // Store tab URL information

// Initialize service worker
console.log("Service Worker initialized!");

const isInternalUrl = (url) => {
  return url.startsWith('chrome://') || 
         url.startsWith('about:') || 
         url.includes('//newtab/');
};

// Track tab URL changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url && tab.active) {
    tabData.set(tabId, {
      url: tab.url,
      title: tab.title
    });
  }
});

// Main navigation listener
chrome.webNavigation.onCompleted.addListener(async (details) => {
  try {
    if (details.frameId !== 0) return;

    const currentTab = await chrome.tabs.get(details.tabId);
    const currentUrl = currentTab.url;
    
    // Update tab data
    tabData.set(details.tabId, {
      url: currentUrl,
      title: currentTab.title
    });

    // Handle previous tab
    console.log('Navigated to:', details.url); 
    if (activeTabId !== null && activeTabId !== details.tabId) {
      const previousTabData = tabData.get(activeTabId) || { url: "Unknown" };
      await logActivity({
        url: previousTabData.url,
        startTime,
        endTime: new Date().toISOString(),
        type: "TAB_SWITCH"
      });
    }

    // Update active tab
    activeTabId = details.tabId;
    startTime = new Date().toISOString();

  } catch (error) {
    console.error("Navigation error:", error);
  }
});

// Handle tab closing
chrome.tabs.onRemoved.addListener(async (tabId) => {
  try {
    if (tabId === activeTabId) {
      const tabDataEntry = tabData.get(tabId) || { url: "Unknown" };
      await logActivity({
        url: tabDataEntry.url,
        startTime,
        endTime: new Date().toISOString(),
        type: "TAB_CLOSE"
      });
      activeTabId = null;
      startTime = null;
      tabData.delete(tabId);
    }
  } catch (error) {
    console.error("Tab removal error:", error);
  }
});

// Improved logging function
async function logActivity({ url, startTime, endTime, type }) {
  try {
    const storageData = await chrome.storage.local.get(["userId", "email"]);
    
    // Clean URL
    const cleanUrl = new URL(url).hostname.replace(/^www\./, '');

    const activityData = {
      user_id: storageData.userId || "Unknown",
      email: storageData.email || "Unknown",
      url: cleanUrl,
      start_time: startTime,
      end_time: endTime,
      activity_type: type
    };

    console.log("Logging:", activityData);
    
    const response = await fetch(BACKEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(activityData),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Logging failed:", error.message);
  }
}

// Keep service worker active
chrome.runtime.onStartup.addListener(() => {
  console.log("Extension started");
  chrome.storage.local.set({ initialized: true });
});