/* ============================================================
   STUDY FOCUS TIMER — background.js  (Service Worker)
   Handles: alarms, desktop notifications, badge text
   ============================================================ */

/* ── Alarm: fires when a fixed-duration session ends ── */
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'studySessionEnd') {
    chrome.notifications.create('sessionDone', {
      type:     'basic',
      iconUrl:  'icons/icon128.png',
      title:    'Study Session Complete!',
      message:  'Great work! Take a short break before your next session.',
      priority: 2
    });
    // Clear badge
    chrome.action.setBadgeText({ text: '' });
  }
});

/* ── Messages from popup ── */
chrome.runtime.onMessage.addListener((msg) => {

  // Start alarm + badge when session begins
  if (msg.type === 'SESSION_START' && msg.durationMins > 0) {
    chrome.alarms.create('studySessionEnd', {
      delayInMinutes: msg.durationMins
    });
    chrome.action.setBadgeBackgroundColor({ color: msg.coding ? '#fb923c' : '#7c6ff7' });
    chrome.action.setBadgeText({ text: 'ON' });
  }

  // Cancel alarm + clear badge on reset / early end
  if (msg.type === 'SESSION_STOP') {
    chrome.alarms.clear('studySessionEnd');
    chrome.action.setBadgeText({ text: '' });
  }

  // Update badge with remaining time (sent every minute from popup)
  if (msg.type === 'TICK_UPDATE' && msg.label) {
    chrome.action.setBadgeText({ text: msg.label });
  }
});