/* ============================================================
   STUDY FOCUS TIMER — app.js
   ============================================================ */

/* ── Constants ── */
const CIRC = 2 * Math.PI * 92; // SVG circle circumference (r = 92)

/* ── State ── */
let totalSecs    = 0;
let elapsed      = 0;
let timerInt     = null;
let running      = false;

let modeMin      = 25;
let freeMode     = false;
let isCoding     = false;

let sessions     = [];
let totalMinsAll = 0;
let codeMinsAll  = 0;
let streak       = 0;
let bestStreak   = 0;
let activeTab    = 'timer';

const FOCUS_THRESHOLDS = {
  focused: 80,
  distracted: 50
};

let studentProfile = {
  name: '',
  classGrade: '',
  age: '',
  subjects: [],
  targetDaily: '',
  targetWeekly: ''
};

let tabBlurCount   = 0;
let vsCodeSwitches = 0;
let lastBlurAt     = 0;

/* ============================================================
   MODE SELECTION
   ============================================================ */
function setMode(btn, min, coding) {
  // Deactivate all pills, activate clicked one
  document.querySelectorAll('.pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  modeMin  = min;
  freeMode = (min === 0);
  isCoding = coding;

  // Show/hide coding tip banner
  document.getElementById('codingTip').style.display = coding ? 'block' : 'none';

  // Hide VS Code badges
  document.getElementById('vsPill').style.display    = 'none';
  document.getElementById('vsAlert').style.display   = 'none';

  // Colour the start button
  document.getElementById('startBtn').classList.toggle('coding', coding);

  if (!running) resetTimer();
}

/* ============================================================
   UI BINDINGS (MV3 CSP safe)
   ============================================================ */
function bindUi() {
  const startBtn = document.getElementById('startBtn');
  if (startBtn) startBtn.addEventListener('click', toggleTimer);

  const resetBtn = document.getElementById('resetBtn');
  if (resetBtn) resetBtn.addEventListener('click', () => resetTimer({ logIncomplete: true }));

  const endBtn = document.getElementById('endBtn');
  if (endBtn) endBtn.addEventListener('click', () => endSession(false));

  const saveProfileBtn = document.getElementById('saveProfileBtn');
  if (saveProfileBtn) saveProfileBtn.addEventListener('click', saveProfile);

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab || 'timer';
      setActiveTab(tab);
    });
  });

  document.querySelectorAll('.pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const min = Number(btn.dataset.min || 0);
      const coding = btn.dataset.coding === 'true';
      setMode(btn, min, coding);
    });
  });
}

function setActiveTab(tabName) {
  activeTab = tabName;

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-panel').forEach((panel) => {
    panel.classList.toggle('active', panel.id === 'tab' + tabName.charAt(0).toUpperCase() + tabName.slice(1));
  });
}

/* ============================================================
   TIME FORMATTING
   ============================================================ */
function fmt(secs) {
  if (secs >= 3600) {
    const h   = Math.floor(secs / 3600);
    const m   = Math.floor((secs % 3600) / 60);
    const sec = secs % 60;
    return pad(h) + ':' + pad(m) + ':' + pad(sec);
  }
  return pad(Math.floor(secs / 60)) + ':' + pad(secs % 60);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/* ============================================================
   SVG ARC
   ============================================================ */
function setArc(ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));
  document.getElementById('arcFill').style.strokeDashoffset = CIRC * (1 - clamped);
}

/* ============================================================
   RESET TIMER
   ============================================================ */
function resetTimer(options = {}) {
  const { logIncomplete = false } = options;

  clearInterval(timerInt);

  if (logIncomplete && elapsed >= 8) {
    recordSession(false);
  }

  running        = false;
  elapsed        = 0;
  tabBlurCount   = 0;
  vsCodeSwitches = 0;
  lastBlurAt     = 0;

  totalSecs = freeMode ? 0 : modeMin * 60;

  document.getElementById('timeDisplay').textContent = freeMode ? '00:00' : fmt(totalSecs);
  document.getElementById('timeStatus').textContent  = 'ready';
  document.getElementById('startBtn').textContent    = 'Start';
  document.getElementById('endBtn').style.display    = 'none';
  document.getElementById('vsAlert').style.display   = 'none';
  document.getElementById('vsPill').style.display    = 'none';
  document.getElementById('arcFill').style.stroke    = isCoding ? '#fb923c' : '#14b8a6';

  setArc(freeMode ? 0 : 1);

  bgMsg({ type: 'SESSION_STOP' });
}

/* ============================================================
   START / PAUSE TOGGLE
   ============================================================ */
function toggleTimer() {
  const wasRunning = running;
  if (running) {
    // Pause
    running = false;
    clearInterval(timerInt);
    document.getElementById('startBtn').textContent   = 'Resume';
    document.getElementById('timeStatus').textContent = 'paused';
  } else {
    // Start / Resume
    running = true;
    document.getElementById('startBtn').textContent = 'Pause';
    document.getElementById('endBtn').style.display = '';

    const col = isCoding ? '#fb923c' : '#14b8a6';
    const lbl = isCoding ? 'coding...' : 'focusing...';
    document.getElementById('timeStatus').innerHTML =
      '<span class="live-dot pulse" style="background:' + col + '"></span>' + lbl;

    timerInt = setInterval(tick, 1000);
  }

  if (!wasRunning && running) {
    bgMsg({ type: 'SESSION_START', durationMins: freeMode ? 0 : modeMin, coding: isCoding });
  }
}

/* ============================================================
   TICK (called every second)
   ============================================================ */
function tick() {
  elapsed++;

  if (freeMode) {
    // Count up
    totalSecs = elapsed;
    document.getElementById('timeDisplay').textContent = fmt(elapsed);
    document.getElementById('arcFill').style.stroke    = isCoding ? '#fb923c' : '#14b8a6';
    setArc(Math.min(elapsed / 7200, 1)); // max arc at 2 h
  } else {
    // Count down
    const rem = totalSecs - elapsed;
    document.getElementById('timeDisplay').textContent = fmt(Math.max(rem, 0));
    setArc(Math.max(rem, 0) / totalSecs);

    if (rem <= 0) {
      clearInterval(timerInt);
      running = false;
      endSession(true); // completed = true
    }
  }
}

/* ============================================================
   BROWSER / WINDOW FOCUS DETECTION
   ─ Coding mode  → VS Code switches tracked but do NOT hurt score
   ─ Study mode   → any blur = distraction, hurts score
   ============================================================ */
function handleBlur() {
  if (!running) return;
  lastBlurAt = Date.now();
}

function handleFocus() {
  if (!running || !lastBlurAt) return;
  const away = Date.now() - lastBlurAt;

  if (away > 1200) { // ignore accidental micro-blurs < 1.2 s
    if (isCoding) {
      vsCodeSwitches++;
      showVsAlert();
    } else {
      tabBlurCount++;
    }
  }
  lastBlurAt = 0;
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) handleBlur();
  else                 handleFocus();
});
window.addEventListener('blur',  handleBlur);
window.addEventListener('focus', handleFocus);

/* ── VS Code alert banner ── */
function showVsAlert() {
  const el = document.getElementById('vsAlert');
  el.style.display = 'flex';
  document.getElementById('vsPill').style.display = 'block';
  clearTimeout(window._vsTimer);
  window._vsTimer = setTimeout(() => { el.style.display = 'none'; }, 4000);
}

/* ============================================================
   FOCUS SCORE CALCULATION
   ─ Starts at 100
   ─ Each distraction   −13 pts  (capped at −45)
   ─ Early end penalty  scaled by % of session completed
   ============================================================ */
function calcScore(completed) {
  let score = 100;

  // In coding mode only non-VS-Code blurs count as distractions
  const distractions = isCoding ? tabBlurCount : (tabBlurCount + vsCodeSwitches);
  score -= Math.min(distractions * 13, 45);

  // Penalty for ending early
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
  if (elapsed < 8) { resetTimer(); return; } // ignore trivial sessions

  clearInterval(timerInt);
  running = false;

  recordSession(completed);

  // Reset internal counters
  elapsed        = 0;
  tabBlurCount   = 0;
  vsCodeSwitches = 0;
  lastBlurAt     = 0;

  // Reset clock display
  totalSecs = freeMode ? 0 : modeMin * 60;
  document.getElementById('timeDisplay').textContent = freeMode ? '00:00' : fmt(totalSecs);
  document.getElementById('timeStatus').textContent  = 'done!';
  document.getElementById('startBtn').textContent    = 'Start';
  document.getElementById('endBtn').style.display    = 'none';
  document.getElementById('vsPill').style.display    = 'none';
  document.getElementById('arcFill').style.stroke    = isCoding ? '#fb923c' : '#14b8a6';
  setArc(completed ? 0 : 1);

  bgMsg({ type: 'SESSION_STOP' });
}

/* ============================================================
   RECORD SESSION
   ============================================================ */
function recordSession(completed) {
  const score   = calcScore(completed);
  const focus   = focusLabelForScore(score);
  const subject = document.getElementById('subjectInput').value.trim()
                  || (isCoding ? 'Coding' : 'Study');
  const mins    = Math.round(elapsed / 60);

  sessions.unshift({
    subject,
    mins,
    score,
    focusLabel: focus.label,
    completed,
    coding:     isCoding,
    vsSwitches: vsCodeSwitches,
    blurs:      tabBlurCount,
    time:       Date.now()
  });

  totalMinsAll += mins;
  if (isCoding) codeMinsAll += mins;
  streak++;
  if (streak > bestStreak) bestStreak = streak;

  updateStats();
  renderLog();
  updateFocusDisplay(score);
  updateAnalysisPanel();
  saveToStorage();
}

/* ============================================================
   UPDATE STATS PANEL
   ============================================================ */
function updateStats() {
  document.getElementById('statSessions').textContent = sessions.length;
  document.getElementById('statTotal').textContent    = totalMinsAll + 'm';
  document.getElementById('statCode').textContent     = codeMinsAll + 'm';
  document.getElementById('statStreak').textContent   = bestStreak;
}

/* ============================================================
   UPDATE FOCUS SCORE DISPLAY
   ============================================================ */
function updateFocusDisplay(score) {
  document.getElementById('focusNum').textContent = score;

  const bar = document.getElementById('focusBar');
  bar.style.width = score + '%';

  let col, hint;
  if      (score >= 85) { col = '#14b8a6'; hint = 'Excellent! You were deeply focused this session.'; }
  else if (score >= 65) { col = '#22d3ee'; hint = 'Good focus — only minor distractions.'; }
  else if (score >= 45) { col = '#fbbf24'; hint = 'Moderate focus. Try to reduce tab switching.'; }
  else                  { col = '#f87171'; hint = 'Low focus. Stay on your work next time!'; }

  bar.style.background = col;
  document.getElementById('focusNum').style.color  = col;
  document.getElementById('focusHint').textContent = hint;
}

/* ============================================================
   RENDER SESSION LOG
   ============================================================ */
function renderLog() {
  const list = document.getElementById('logList');

  if (!sessions.length) {
    list.innerHTML = '<div class="empty">No sessions yet</div>';
    return;
  }

  list.innerHTML = sessions.slice(0, 10).map(s => {
    const focus = focusLabelForScore(s.score);
    const col  = focus.color;

    const timeObj = new Date(s.time || Date.now());
    const time = timeObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const codeTag  = s.coding
      ? '<span class="tag-vs">VS Code</span>'
      : '';

    const vsInfo   = s.coding && s.vsSwitches > 0
      ? ` · ${s.vsSwitches} VS switch${s.vsSwitches > 1 ? 'es' : ''}`
      : '';

    const blurInfo = !s.coding && s.blurs > 0
      ? ` · ${s.blurs} distraction${s.blurs > 1 ? 's' : ''}`
      : '';

    return `
      <div class="log-item">
        <div class="log-dot" style="background:${col}"></div>
        <div class="log-info">
          <div class="log-sub">${s.subject} ${codeTag}</div>
          <div class="log-meta">
            ${time}${vsInfo}${blurInfo}
            · <span style="color:${col};font-weight:600">${focus.label}</span>
          </div>
        </div>
        <div class="log-dur" style="color:${col}">
          ${s.mins}m
          &nbsp;<span class="tag-score"
            style="background:${col}22;color:${col}">${s.score}</span>
        </div>
      </div>`;
  }).join('');
}

/* ============================================================
   STUDENT PROFILE + ANALYSIS
   ============================================================ */
function normalizeSubjects(raw) {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

function focusLabelForScore(score) {
  if (score >= FOCUS_THRESHOLDS.focused) {
    return { label: 'Focused', color: '#14b8a6' };
  }
  if (score >= FOCUS_THRESHOLDS.distracted) {
    return { label: 'Distracted', color: '#fbbf24' };
  }
  return { label: 'Unfocused', color: '#f87171' };
}

function renderProfile() {
  const nameEl = document.getElementById('studentName');
  const classEl = document.getElementById('studentClass');
  const ageEl = document.getElementById('studentAge');
  const subjectsEl = document.getElementById('studentSubjects');
  const dailyEl = document.getElementById('targetDaily');
  const weeklyEl = document.getElementById('targetWeekly');
  const statusEl = document.getElementById('profileStatus');

  if (nameEl) nameEl.value = studentProfile.name || '';
  if (classEl) classEl.value = studentProfile.classGrade || '';
  if (ageEl) ageEl.value = studentProfile.age || '';
  if (subjectsEl) subjectsEl.value = (studentProfile.subjects || []).join(', ');
  if (dailyEl) dailyEl.value = studentProfile.targetDaily || '';
  if (weeklyEl) weeklyEl.value = studentProfile.targetWeekly || '';

  if (statusEl) {
    const subjects = Array.isArray(studentProfile.subjects) ? studentProfile.subjects : [];
    const hasProfile = studentProfile.name || studentProfile.classGrade || subjects.length;
    statusEl.textContent = hasProfile ? 'Profile loaded' : 'Not saved yet';
    statusEl.style.color = hasProfile ? '#22d3ee' : '';
  }
}

function saveProfile() {
  const nameEl = document.getElementById('studentName');
  const classEl = document.getElementById('studentClass');
  const ageEl = document.getElementById('studentAge');
  const subjectsEl = document.getElementById('studentSubjects');
  const dailyEl = document.getElementById('targetDaily');
  const weeklyEl = document.getElementById('targetWeekly');
  const statusEl = document.getElementById('profileStatus');

  studentProfile = {
    name: nameEl ? nameEl.value.trim() : '',
    classGrade: classEl ? classEl.value.trim() : '',
    age: ageEl ? ageEl.value.trim() : '',
    subjects: subjectsEl ? normalizeSubjects(subjectsEl.value) : [],
    targetDaily: dailyEl ? dailyEl.value.trim() : '',
    targetWeekly: weeklyEl ? weeklyEl.value.trim() : ''
  };

  saveToStorage();
  updateAnalysisPanel();

  if (statusEl) {
    statusEl.textContent = 'Profile saved';
    statusEl.style.color = '#34d399';
  }
}

function updateAnalysisPanel() {
  const studentEl = document.getElementById('analysisStudent');
  const lastEl = document.getElementById('analysisLast');
  const avgEl = document.getElementById('analysisAvg');
  const focusedEl = document.getElementById('analysisFocused');
  const distractedEl = document.getElementById('analysisDistracted');
  const unfocusedEl = document.getElementById('analysisUnfocused');

  if (studentEl) {
    if (studentProfile.name || studentProfile.classGrade) {
      const detail = [studentProfile.name, studentProfile.classGrade].filter(Boolean).join(' · ');
      studentEl.textContent = detail;
    } else {
      studentEl.textContent = 'Add a profile to see analysis';
    }
  }

  if (!sessions.length) {
    if (lastEl) lastEl.textContent = '—';
    if (avgEl) avgEl.textContent = '—';
    if (focusedEl) focusedEl.textContent = '0';
    if (distractedEl) distractedEl.textContent = '0';
    if (unfocusedEl) unfocusedEl.textContent = '0';
    return;
  }

  const totalScore = sessions.reduce((sum, s) => sum + (s.score || 0), 0);
  const avgScore = Math.round(totalScore / sessions.length);
  const lastScore = sessions[0].score || 0;

  const lastLabel = focusLabelForScore(lastScore);
  const avgLabel = focusLabelForScore(avgScore);

  if (lastEl) {
    lastEl.textContent = `${lastLabel.label} (${lastScore})`;
    lastEl.style.color = lastLabel.color;
  }
  if (avgEl) {
    avgEl.textContent = `${avgScore} (${avgLabel.label})`;
    avgEl.style.color = avgLabel.color;
  }

  let focusedCount = 0;
  let distractedCount = 0;
  let unfocusedCount = 0;

  sessions.forEach((s) => {
    const label = focusLabelForScore(s.score || 0).label;
    if (label === 'Focused') focusedCount++;
    else if (label === 'Distracted') distractedCount++;
    else unfocusedCount++;
  });

  if (focusedEl) focusedEl.textContent = String(focusedCount);
  if (distractedEl) distractedEl.textContent = String(distractedCount);
  if (unfocusedEl) unfocusedEl.textContent = String(unfocusedCount);
}

/* ============================================================
   CHROME EXTENSION HELPERS
   ============================================================ */

/** Send a message to the background service worker (safe — ignores if not in extension) */
function bgMsg(payload) {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage(payload).catch(() => {});
  }
}

/** Persist sessions array to chrome.storage.local */
function saveToStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.set({
      sessions:     sessions,
      totalMinsAll: totalMinsAll,
      codeMinsAll:  codeMinsAll,
      bestStreak:   bestStreak,
      studentProfile: studentProfile
    });
  }
}

/** Load persisted data on popup open */
function loadFromStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(
      ['sessions', 'totalMinsAll', 'codeMinsAll', 'bestStreak', 'studentProfile'],
      (data) => {
        if (Array.isArray(data.sessions)) {
          sessions = data.sessions.map((s) => ({
            ...s,
            time: s.time ? new Date(s.time).getTime() : Date.now()
          }));
        }
        if (data.totalMinsAll) totalMinsAll = data.totalMinsAll;
        if (data.codeMinsAll)  codeMinsAll  = data.codeMinsAll;
        if (data.bestStreak)   bestStreak   = data.bestStreak;
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
      }
    );
  }
}

/* Background notifications are triggered directly in the timer handlers. */

/* ── Send badge tick every 60 s while running ── */
setInterval(() => {
  if (!running || freeMode) return;
  const rem  = totalSecs - elapsed;
  if (rem <= 0) return;
  const mins = Math.ceil(rem / 60);
  bgMsg({ type: 'TICK_UPDATE', label: mins + 'm' });
}, 60000);

/* ============================================================
   INIT
   ============================================================ */
bindUi();
loadFromStorage();
resetTimer();
renderProfile();
updateAnalysisPanel();
setActiveTab('timer');
