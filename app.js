/* ============================================================
   STUDY FOCUS TIMER — app.js  (v2)
   ============================================================ */

/* ── Constants ── */
const CIRC = 2 * Math.PI * 96; // SVG circle circumference (r=96)

/* ── State ── */
let totalSecs    = 0;
let elapsed      = 0;
let timerInt     = null;
let running      = false;

let modeMin      = 25;
let freeMode     = false;
let isCoding     = false;

let sessions        = [];
let totalMinsAll    = 0;
let codeMinsAll     = 0;
let completedCount  = 0;
let streak          = 0;
let bestStreak      = 0;
let activeTab       = 'timer';
let currentFilter   = 'all';
let sessionStartEpoch = 0;

const FOCUS_THRESHOLDS = { focused: 80, distracted: 50 };

let studentProfile = {
  name: '', classGrade: '', age: '',
  subjects: [], targetDaily: '', targetWeekly: ''
};

let tabBlurCount   = 0;
let vsCodeSwitches = 0;
let lastBlurAt     = 0;

/* ============================================================
   SAFE ELEMENT HELPER
   ============================================================ */
function el(id) { return document.getElementById(id); }

/* ============================================================
   MODE SELECTION
   ============================================================ */
function setMode(btn, min, coding) {
  document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  modeMin  = min;
  freeMode = (min === 0);
  isCoding = coding;

  el('codingTip').style.display = coding ? 'block' : 'none';
  el('vsPill').style.display    = 'none';
  el('vsAlert').style.display   = 'none';

  const startBtn = el('startBtn');
  startBtn.classList.toggle('coding', coding && !running);

  if (!running) resetTimer();
}

/* ============================================================
   TABS
   ============================================================ */
function setActiveTab(tabName) {
  activeTab = tabName;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(p => {
    const key = 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1);
    p.classList.toggle('active', p.id === key);
  });
  if (tabName === 'history') renderFullLog();
}

/* ============================================================
   UI BINDINGS
   ============================================================ */
function bindUi() {
  el('startBtn').addEventListener('click', toggleTimer);
  el('resetBtn').addEventListener('click', () => resetTimer({ logIncomplete: true }));
  el('endBtn').addEventListener('click', () => endSession(false));
  el('saveProfileBtn').addEventListener('click', saveProfile);
  el('modalOkBtn').addEventListener('click', closeModal);
  el('seeAllBtn').addEventListener('click', () => setActiveTab('history'));
  el('clearHistoryBtn').addEventListener('click', clearHistory);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab || 'timer'));
  });

  document.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      const min    = Number(btn.dataset.min || 0);
      const coding = btn.dataset.coding === 'true';
      setMode(btn, min, coding);
    });
  });

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderFullLog();
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); toggleTimer(); }
    if (e.code === 'KeyR')  { resetTimer({ logIncomplete: true }); }
  });
}

/* ============================================================
   TIME FORMATTING
   ============================================================ */
function fmt(secs) {
  if (secs >= 3600) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(s);
  }
  return pad(Math.floor(secs / 60)) + ':' + pad(secs % 60);
}
function pad(n) { return String(n).padStart(2, '0'); }
function fmtMins(m) {
  if (m >= 60) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  return m + 'm';
}

/* ============================================================
   SVG ARC
   ============================================================ */
function setArc(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  el('arcFill').style.strokeDashoffset = CIRC * (1 - clamped);
}

/* ============================================================
   RESET TIMER
   ============================================================ */
function resetTimer(options = {}) {
  const { logIncomplete = false } = options;
  clearInterval(timerInt);

  if (logIncomplete && elapsed >= 8) recordSession(false);

  running = false; elapsed = 0;
  tabBlurCount = 0; vsCodeSwitches = 0; lastBlurAt = 0; sessionStartEpoch = 0;

  totalSecs = freeMode ? 0 : modeMin * 60;

  el('timeDisplay').textContent = freeMode ? '00:00' : fmt(totalSecs);
  el('timeStatus').textContent  = 'ready';
  const startBtn = el('startBtn');
  startBtn.textContent = '▶ Start';
  startBtn.classList.remove('paused');
  startBtn.classList.toggle('coding', isCoding);
  el('endBtn').style.display    = 'none';
  el('vsAlert').style.display   = 'none';
  el('vsPill').style.display    = 'none';
  el('arcFill').style.stroke    = isCoding ? '#fb923c' : '#14b8a6';

  setArc(freeMode ? 0 : 1);
  updateHeaderStatus();
  bgMsg({ type: 'SESSION_STOP' });
}

/* ============================================================
   START / PAUSE TOGGLE
   ============================================================ */
function toggleTimer() {
  const wasRunning = running;

  if (running) {
    running = false;
    clearInterval(timerInt);
    const startBtn = el('startBtn');
    startBtn.textContent = '▶ Resume';
    startBtn.classList.add('paused');
    el('timeStatus').textContent = 'paused';
  } else {
    running = true;
    if (!sessionStartEpoch) sessionStartEpoch = Date.now();

    const startBtn = el('startBtn');
    startBtn.textContent = '⏸ Pause';
    startBtn.classList.remove('paused');
    el('endBtn').style.display = '';

    const col = isCoding ? '#fb923c' : '#14b8a6';
    const lbl = isCoding ? 'coding...' : 'focusing...';
    el('timeStatus').innerHTML =
      '<span class="live-dot pulse" style="background:' + col + '"></span>' + lbl;

    timerInt = setInterval(tick, 1000);
  }

  if (!wasRunning && running) {
    bgMsg({ type: 'SESSION_START', durationMins: freeMode ? 0 : modeMin, coding: isCoding });
  }
  updateHeaderStatus();
}

/* ============================================================
   TICK
   ============================================================ */
function tick() {
  elapsed++;

  if (freeMode) {
    totalSecs = elapsed;
    el('timeDisplay').textContent = fmt(elapsed);
    el('arcFill').style.stroke    = isCoding ? '#fb923c' : '#14b8a6';
    setArc(Math.min(elapsed / 7200, 1));
  } else {
    const rem = totalSecs - elapsed;
    el('timeDisplay').textContent = fmt(Math.max(rem, 0));
    setArc(Math.max(rem, 0) / totalSecs);

    // Pulse arc red in last 60s
    if (rem <= 60 && rem > 0) {
      el('arcFill').style.stroke = '#f87171';
    }

    if (rem <= 0) {
      clearInterval(timerInt);
      running = false;
      endSession(true);
    }
  }
}

/* ============================================================
   BLUR / FOCUS DETECTION
   ============================================================ */
function handleBlur() {
  if (!running) return;
  lastBlurAt = Date.now();
}
function handleFocus() {
  if (!running || !lastBlurAt) return;
  const away = Date.now() - lastBlurAt;
  if (away > 1200) {
    if (isCoding) { vsCodeSwitches++; showVsAlert(); }
    else          { tabBlurCount++; }
  }
  lastBlurAt = 0;
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) handleBlur(); else handleFocus();
});
window.addEventListener('blur',  handleBlur);
window.addEventListener('focus', handleFocus);

function showVsAlert() {
  const e = el('vsAlert');
  e.style.display = 'flex';
  el('vsPill').style.display = 'block';
  clearTimeout(window._vsTimer);
  window._vsTimer = setTimeout(() => { e.style.display = 'none'; }, 4000);
}

/* ============================================================
   FOCUS SCORE
   ============================================================ */
function calcScore(completed) {
  let score = 100;
  const distractions = isCoding ? tabBlurCount : (tabBlurCount + vsCodeSwitches);
  score -= Math.min(distractions * 13, 45);
  if (!completed && !freeMode && modeMin > 0) {
    const pct = Math.min(elapsed / (modeMin * 60), 1);
    score = Math.round(score * pct);
  }
  return Math.max(score, 5);
}

/* ============================================================
   END SESSION
   ============================================================ */
function endSession(completed = false) {
  if (elapsed < 8) { resetTimer(); return; }
  clearInterval(timerInt);
  running = false;

  const score = calcScore(completed);
  recordSession(completed, score);

  // Burst effect on completion
  if (completed) {
    const ring = el('celebrateRing');
    ring.classList.remove('burst');
    void ring.offsetWidth; // reflow
    ring.classList.add('burst');
  }

  elapsed = 0; tabBlurCount = 0; vsCodeSwitches = 0; lastBlurAt = 0;

  totalSecs = freeMode ? 0 : modeMin * 60;
  el('timeDisplay').textContent = freeMode ? '00:00' : fmt(totalSecs);
  el('timeStatus').textContent  = completed ? 'done! 🎉' : 'ended';
  const startBtn = el('startBtn');
  startBtn.textContent = '▶ Start';
  startBtn.classList.remove('paused');
  el('endBtn').style.display = 'none';
  el('vsPill').style.display = 'none';
  el('arcFill').style.stroke = isCoding ? '#fb923c' : '#14b8a6';
  setArc(completed ? 0 : 1);

  updateHeaderStatus();
  bgMsg({ type: 'SESSION_STOP' });

  // Show completion modal
  showModal(completed, score);
}

/* ============================================================
   COMPLETION MODAL
   ============================================================ */
function showModal(completed, score) {
  const modal = el('completionModal');
  const focus = focusLabelForScore(score);

  el('modalEmoji').textContent   = completed ? '🎉' : '✅';
  el('modalTitle').textContent   = completed ? 'Session Complete!' : 'Session Ended';
  el('modalSub').textContent     = completed
    ? getCompletionMessage(score)
    : 'Good work! Partial sessions count too.';

  el('modalScore').textContent   = score;
  el('modalScore').style.color   = focus.color;

  const mins = Math.round((sessions[0] || {}).mins || 0);
  el('modalStats').innerHTML = `
    <span>⏱ ${fmtMins(mins)}</span>
    <span>·</span>
    <span style="color:${focus.color}">${focus.label}</span>
    <span>·</span>
    <span>🔥 Streak: ${streak}</span>
  `;

  modal.classList.add('open');
}

function closeModal() {
  el('completionModal').classList.remove('open');
}

function getCompletionMessage(score) {
  if (score >= 90) return 'Incredible focus! You were locked in. 🔥';
  if (score >= 75) return 'Great work! Only minor distractions.';
  if (score >= 55) return 'Decent session. Try to limit tab-switching next time.';
  return 'Room for improvement — you\'ve got this!';
}

/* ============================================================
   RECORD SESSION
   ============================================================ */
function recordSession(completed, score) {
  score = score !== undefined ? score : calcScore(completed);
  const focus   = focusLabelForScore(score);
  const subject = (el('subjectInput').value.trim()) || (isCoding ? 'Coding' : 'Study');
  const mins    = Math.round(elapsed / 60);

  sessions.unshift({
    subject, mins, score,
    focusLabel: focus.label,
    completed,
    coding:     isCoding,
    vsSwitches: vsCodeSwitches,
    blurs:      tabBlurCount,
    time:       Date.now()
  });

  totalMinsAll += mins;
  if (isCoding) codeMinsAll += mins;
  if (completed) completedCount++;
  streak++;
  if (streak > bestStreak) bestStreak = streak;

  updateStats();
  renderLog();
  updateFocusDisplay(score);
  updateHeaderStatus();
  updateDailyProgress();
  updateAnalysisPanel();
  saveToStorage();
}

/* ============================================================
   HEADER STATUS
   ============================================================ */
function updateHeaderStatus() {
  el('completedCount').textContent = completedCount;
  el('headerStreak').textContent   = bestStreak;

  const dot = el('runningDot');
  if (running) {
    dot.classList.add('active');
    el('runningStatus').textContent = freeMode
      ? 'running (' + fmt(elapsed) + ')'
      : 'running (' + fmt(Math.max(totalSecs - elapsed, 0)) + ' left)';
  } else {
    dot.classList.remove('active');
    el('runningStatus').textContent = 'not running';
  }
}

/* ============================================================
   DAILY PROGRESS
   ============================================================ */
function updateDailyProgress() {
  const today = new Date().toDateString();
  const todayMins = sessions
    .filter(s => new Date(s.time).toDateString() === today)
    .reduce((sum, s) => sum + (s.mins || 0), 0);

  const target = parseInt(studentProfile.targetDaily) || 0;
  const pct    = target > 0 ? Math.min((todayMins / target) * 100, 100) : 0;

  el('dailyFill').style.width = pct + '%';
  el('dailyVal').textContent  = target > 0
    ? todayMins + ' / ' + target + ' min'
    : todayMins + ' min today';
}

/* ============================================================
   STATS PANEL
   ============================================================ */
function updateStats() {
  el('statSessions').textContent  = sessions.length;
  el('statCompleted').textContent = completedCount;
  el('statTotal').textContent     = fmtMins(totalMinsAll);
  el('statCode').textContent      = fmtMins(codeMinsAll);
  el('statStreak').textContent    = bestStreak;
}

/* ============================================================
   FOCUS SCORE DISPLAY
   ============================================================ */
function updateFocusDisplay(score) {
  el('focusNum').textContent = score;
  const bar = el('focusBar');
  bar.style.width = score + '%';

  let col, hint;
  if      (score >= 85) { col = '#14b8a6'; hint = '🔥 Excellent! Deep focus achieved.'; }
  else if (score >= 65) { col = '#22d3ee'; hint = '👍 Good focus — minor distractions only.'; }
  else if (score >= 45) { col = '#fbbf24'; hint = '⚠️ Moderate focus. Reduce tab switching.'; }
  else                  { col = '#f87171'; hint = '😬 Low focus. Try again — you\'ve got this!'; }

  bar.style.background = col;
  el('focusNum').style.color   = col;
  el('focusHint').textContent  = hint;
}

/* ============================================================
   FOCUS LABEL
   ============================================================ */
function focusLabelForScore(score) {
  if (score >= FOCUS_THRESHOLDS.focused)    return { label: 'Focused',    color: '#14b8a6' };
  if (score >= FOCUS_THRESHOLDS.distracted) return { label: 'Distracted', color: '#fbbf24' };
  return { label: 'Unfocused', color: '#f87171' };
}

/* ============================================================
   RENDER SESSION LOG (mini — timer tab, max 5)
   ============================================================ */
function renderLog() {
  const list = el('logList');
  if (!sessions.length) {
    list.innerHTML = '<div class="empty">No sessions yet — start your first one!</div>';
    return;
  }
  list.innerHTML = sessions.slice(0, 5).map(s => buildLogItem(s)).join('');
}

/* ============================================================
   RENDER FULL LOG (history tab)
   ============================================================ */
function renderFullLog() {
  const list = el('fullLogList');
  const completedC  = sessions.filter(s => s.completed).length;
  const incompleteC = sessions.filter(s => !s.completed).length;

  el('hbTotal').textContent     = sessions.length;
  el('hbCompleted').textContent = completedC;
  el('hbIncomplete').textContent = incompleteC;
  el('hbTotalMins').textContent  = fmtMins(totalMinsAll);

  let filtered = sessions;
  if      (currentFilter === 'completed')   filtered = sessions.filter(s => s.completed);
  else if (currentFilter === 'incomplete')  filtered = sessions.filter(s => !s.completed);
  else if (currentFilter === 'coding')      filtered = sessions.filter(s => s.coding);

  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No sessions match this filter.</div>';
    return;
  }

  // Group by date
  const groups = {};
  filtered.forEach(s => {
    const d = new Date(s.time).toDateString();
    if (!groups[d]) groups[d] = [];
    groups[d].push(s);
  });

  let html = '';
  Object.keys(groups).forEach(date => {
    const dayTotal = groups[date].reduce((sum, s) => sum + (s.mins || 0), 0);
    html += `<div class="log-date-header">
      <span>${formatDateHeader(date)}</span>
      <span style="color:var(--accent);font-family:monospace">${fmtMins(dayTotal)}</span>
    </div>`;
    html += groups[date].map(s => buildLogItem(s, true)).join('');
  });

  list.innerHTML = html;
}

function formatDateHeader(dateStr) {
  const d = new Date(dateStr);
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (dateStr === today) return '📅 Today';
  if (dateStr === yesterday) return '📅 Yesterday';
  return '📅 ' + d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildLogItem(s, showDate = false) {
  const focus     = focusLabelForScore(s.score);
  const col       = focus.color;
  const timeObj   = new Date(s.time || Date.now());
  const timeStr   = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const codeTag   = s.coding
    ? '<span class="tag-vs">💻 VS</span>'
    : '';
  const doneTag   = s.completed
    ? '<span class="tag-complete">✓ done</span>'
    : '<span class="tag-incomplete">◑ partial</span>';

  const vsInfo    = s.coding && s.vsSwitches > 0
    ? ` · ${s.vsSwitches} VS switch${s.vsSwitches > 1 ? 'es' : ''}`
    : '';
  const blurInfo  = !s.coding && s.blurs > 0
    ? ` · ${s.blurs} distraction${s.blurs > 1 ? 's' : ''}`
    : '';

  return `
    <div class="log-item">
      <div class="log-dot" style="background:${col}"></div>
      <div class="log-info">
        <div class="log-sub">${s.subject} ${codeTag}</div>
        <div class="log-meta">
          ${timeStr}${vsInfo}${blurInfo}
          · <span style="color:${col};font-weight:600">${focus.label}</span>
        </div>
      </div>
      <div class="log-right">
        <div class="log-dur" style="color:${col}">${fmtMins(s.mins)}&nbsp;<span class="tag-score" style="background:${col}22;color:${col}">${s.score}</span></div>
        ${doneTag}
      </div>
    </div>`;
}

/* ============================================================
   CLEAR HISTORY
   ============================================================ */
function clearHistory() {
  if (!confirm('Clear all session history? This cannot be undone.')) return;
  sessions = []; totalMinsAll = 0; codeMinsAll = 0;
  completedCount = 0; streak = 0; bestStreak = 0;
  updateStats(); renderLog(); renderFullLog();
  updateAnalysisPanel(); updateDailyProgress(); updateHeaderStatus();
  el('focusNum').textContent = '—';
  el('focusBar').style.width = '0%';
  el('focusHint').textContent = 'Complete a session to see your focus score';
  saveToStorage();
}

/* ============================================================
   PROFILE + ANALYSIS
   ============================================================ */
function normalizeSubjects(raw) {
  if (!raw) return [];
  return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function renderProfile() {
  const s = studentProfile;
  const safe = (id, val) => { const e = el(id); if (e) e.value = val || ''; };
  safe('studentName',     s.name);
  safe('studentClass',    s.classGrade);
  safe('studentAge',      s.age);
  safe('studentSubjects', (s.subjects || []).join(', '));
  safe('targetDaily',     s.targetDaily);
  safe('targetWeekly',    s.targetWeekly);

  const statusEl = el('profileStatus');
  const hasProfile = s.name || s.classGrade || (s.subjects || []).length;
  if (statusEl) {
    statusEl.textContent = hasProfile ? '✅ Profile loaded' : 'Not saved yet';
    statusEl.style.color = hasProfile ? '#34d399' : '';
  }
}

function saveProfile() {
  studentProfile = {
    name:        el('studentName').value.trim(),
    classGrade:  el('studentClass').value.trim(),
    age:         el('studentAge').value.trim(),
    subjects:    normalizeSubjects(el('studentSubjects').value),
    targetDaily: el('targetDaily').value.trim(),
    targetWeekly:el('targetWeekly').value.trim()
  };
  saveToStorage();
  updateAnalysisPanel();
  updateDailyProgress();

  const statusEl = el('profileStatus');
  if (statusEl) { statusEl.textContent = '✅ Saved!'; statusEl.style.color = '#34d399'; }
}

function updateAnalysisPanel() {
  const studentEl = el('analysisStudent');
  if (studentEl) {
    const detail = [studentProfile.name, studentProfile.classGrade].filter(Boolean).join(' · ');
    studentEl.textContent = detail || 'Add a profile to see analysis';
  }

  el('analysisBestStreak').textContent = bestStreak;

  if (!sessions.length) {
    ['analysisLast','analysisAvg'].forEach(id => { el(id).textContent = '—'; el(id).style.color = ''; });
    ['analysisFocused','analysisDistracted','analysisUnfocused'].forEach(id => el(id).textContent = '0');
    return;
  }

  const total   = sessions.reduce((sum, s) => sum + (s.score || 0), 0);
  const avg     = Math.round(total / sessions.length);
  const lastScr = sessions[0].score || 0;
  const lastLbl = focusLabelForScore(lastScr);
  const avgLbl  = focusLabelForScore(avg);

  const lastEl = el('analysisLast');
  lastEl.textContent = `${lastLbl.label} (${lastScr})`;
  lastEl.style.color = lastLbl.color;

  const avgEl = el('analysisAvg');
  avgEl.textContent  = `${avg} (${avgLbl.label})`;
  avgEl.style.color  = avgLbl.color;

  let fc = 0, dc = 0, uc = 0;
  sessions.forEach(s => {
    const l = focusLabelForScore(s.score || 0).label;
    if (l === 'Focused') fc++;
    else if (l === 'Distracted') dc++;
    else uc++;
  });
  el('analysisFocused').textContent    = fc;
  el('analysisDistracted').textContent = dc;
  el('analysisUnfocused').textContent  = uc;
}

/* ============================================================
   CHROME EXTENSION HELPERS
   ============================================================ */
function bgMsg(payload) {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage(payload).catch(() => {});
  }
}

function saveToStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({
      sessions, totalMinsAll, codeMinsAll,
      completedCount, bestStreak, studentProfile
    });
  }
}

function loadFromStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(
      ['sessions', 'totalMinsAll', 'codeMinsAll', 'completedCount', 'bestStreak', 'studentProfile'],
      (data) => {
        if (Array.isArray(data.sessions)) {
          sessions = data.sessions.map(s => ({
            ...s, time: s.time ? new Date(s.time).getTime() : Date.now()
          }));
          // Recount completed from stored data
          completedCount = sessions.filter(s => s.completed).length;
        }
        if (data.totalMinsAll)  totalMinsAll  = data.totalMinsAll;
        if (data.codeMinsAll)   codeMinsAll   = data.codeMinsAll;
        if (data.completedCount !== undefined) completedCount = data.completedCount;
        if (data.bestStreak)    bestStreak    = data.bestStreak;
        streak = sessions.length; // approximate
        if (data.studentProfile) {
          studentProfile = {
            ...studentProfile,
            ...data.studentProfile,
            subjects: Array.isArray(data.studentProfile.subjects) ? data.studentProfile.subjects : []
          };
        }
        updateStats();
        renderLog();
        renderProfile();
        updateAnalysisPanel();
        updateHeaderStatus();
        updateDailyProgress();
      }
    );
  }
}

/* Badge tick every 60s */
setInterval(() => {
  if (!running || freeMode) return;
  const rem  = totalSecs - elapsed;
  if (rem <= 0) return;
  const mins = Math.ceil(rem / 60);
  bgMsg({ type: 'TICK_UPDATE', label: mins + 'm' });
  updateHeaderStatus();
}, 60000);

/* Inject date-header style */
const style = document.createElement('style');
style.textContent = `
  .log-date-header {
    display: flex;
    justify-content: space-between;
    font-size: 10.5px;
    font-weight: 700;
    color: var(--text3);
    text-transform: uppercase;
    letter-spacing: .8px;
    padding: 10px 0 5px;
    border-bottom: 1px solid var(--border);
    margin-bottom: 2px;
  }
`;
document.head.appendChild(style);

/* ============================================================
   INIT
   ============================================================ */
bindUi();
loadFromStorage();
resetTimer();
renderProfile();
updateAnalysisPanel();
setActiveTab('timer');