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
  if (resetBtn) resetBtn.addEventListener('click', resetTimer);

  const endBtn = document.getElementById('endBtn');
  if (endBtn) endBtn.addEventListener('click', () => endSession(false));

  document.querySelectorAll('.pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const min = Number(btn.dataset.min || 0);
      const coding = btn.dataset.coding === 'true';
      setMode(btn, min, coding);
    });
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
function resetTimer() {
  clearInterval(timerInt);
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

  const score   = calcScore(completed);
  const subject = document.getElementById('subjectInput').value.trim()
                  || (isCoding ? 'Coding' : 'Study');
  const mins    = Math.round(elapsed / 60);

  // Save session record
  sessions.unshift({
    subject,
    mins,
    score,
    completed,
    coding:    isCoding,
    vsSwitches: vsCodeSwitches,
    blurs:     tabBlurCount,
    time:      new Date()
  });

  // Accumulate totals
  totalMinsAll += mins;
  if (isCoding) codeMinsAll += mins;
  streak++;
  if (streak > bestStreak) bestStreak = streak;

  // Update UI
  updateStats();
  renderLog();
  updateFocusDisplay(score);

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
    const col  = s.score >= 85 ? '#14b8a6'
           : s.score >= 65 ? '#22d3ee'
               : s.score >= 45 ? '#fbbf24'
               : '#f87171';

    const tag  = s.score >= 85 ? 'excellent'
               : s.score >= 65 ? 'good'
               : s.score >= 45 ? 'ok'
               : 'low';

    const time = s.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

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
            · <span style="color:${col};font-weight:600">${tag}</span>
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
      bestStreak:   bestStreak
    });
  }
}

/** Load persisted data on popup open */
function loadFromStorage() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(
      ['sessions', 'totalMinsAll', 'codeMinsAll', 'bestStreak'],
      (data) => {
        if (data.sessions)     sessions     = data.sessions;
        if (data.totalMinsAll) totalMinsAll = data.totalMinsAll;
        if (data.codeMinsAll)  codeMinsAll  = data.codeMinsAll;
        if (data.bestStreak)   bestStreak   = data.bestStreak;
        updateStats();
        renderLog();
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
