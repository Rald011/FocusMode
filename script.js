const QUOTES = [
  "One task at a time.",
  "Stillness is not idleness.",
  "Begin. The rest follows.",
  "Depth over speed.",
  "Attention is a gift.",
  "Do less. Mean it more.",
  "The present moment is enough.",
  "Clarity comes from doing.",
  "Rest is part of the work.",
  "Focus is a form of courage."
];

const MODES = {
  focus: { mins: 25, label: 'focus session' },
  short: { mins: 5,  label: 'short break'   },
  long:  { mins: 15, label: 'long break'     }
};

let mode       = 'focus';
let total      = 25 * 60;
let remaining  = 25 * 60;
let running    = false;
let interval   = null;
let sessions   = 0;
let tasksDone  = 0;
let minFocused = 0;
let cycleCount = 0;
let tasks      = [];
let sound      = 'off';
let audioCtx   = null;
let soundNodes = [];
let isDark     = false;

function load() {
  const today = new Date().toDateString();
  const d = JSON.parse(localStorage.getItem('fm1') || '{}');

  if (d.date === today) {
    sessions   = d.sessions   || 0;
    tasksDone  = d.tasksDone  || 0;
    minFocused = d.minFocused || 0;
    cycleCount = d.cycleCount || 0;
  }

  tasks  = d.tasks || [];
  isDark = d.dark  || false;

  if (isDark) document.body.classList.add('dark');
  renderAll();
}

function save() {
  localStorage.setItem('fm1', JSON.stringify({
    date: new Date().toDateString(),
    sessions,
    tasksDone,
    minFocused,
    cycleCount,
    tasks,
    dark: isDark
  }));
}

function pickQuote() {
  const el = document.getElementById('quoteEl');
  el.style.opacity = '0';
  setTimeout(() => {
    el.textContent = '"' + QUOTES[Math.floor(Math.random() * QUOTES.length)] + '"';
    el.style.opacity = '1';
  }, 400);
}

function tickClock() {
  const n = new Date();
  document.getElementById('clockEl').textContent =
    n.getHours().toString().padStart(2, '0') + ':' +
    n.getMinutes().toString().padStart(2, '0');
}

function toggleTheme() {
  isDark = !isDark;
  document.body.classList.toggle('dark', isDark);
  save();
}

function switchMode(m) {
  if (running) pause();

  mode      = m;
  total     = MODES[m].mins * 60;
  remaining = total;

  document.getElementById('btnStart').textContent = 'Start';
  document.getElementById('timerSub').textContent = MODES[m].label;

  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active', 'brk'));

  const tabMap = { focus: 'tabFocus', short: 'tabShort', long: 'tabLong' };
  document.getElementById(tabMap[m]).classList.add('active');
  if (m !== 'focus') document.getElementById(tabMap[m]).classList.add('brk');

  const isBreak = m !== 'focus';
  document.getElementById('timerEl').classList.toggle('brk', isBreak);
  document.getElementById('progressFill').classList.toggle('brk', isBreak);
  document.getElementById('btnStart').classList.toggle('brk', isBreak);

  updateDisplay();
  updateBar();
}

function applySettings() {
  MODES.focus.mins = parseInt(document.getElementById('setFocus').value) || 25;
  MODES.short.mins = parseInt(document.getElementById('setShort').value) || 5;
  MODES.long.mins  = parseInt(document.getElementById('setLong').value)  || 15;

  if (!running) {
    total     = MODES[mode].mins * 60;
    remaining = total;
    updateDisplay();
    updateBar();
  }
}

function toggleTimer() {
  running ? pause() : start();
}

function start() {
  if (remaining <= 0) remaining = total;
  running = true;
  document.getElementById('btnStart').textContent = 'Pause';
  interval = setInterval(tick, 1000);
}

function pause() {
  running = false;
  clearInterval(interval);
  document.getElementById('btnStart').textContent = 'Resume';
}

function resetTimer() {
  pause();
  remaining = total;
  document.getElementById('btnStart').textContent = 'Start';
  updateDisplay();
  updateBar();
}

function skipSession() {
  pause();
  onEnd();
}

function tick() {
  if (remaining > 0) {
    remaining--;
    updateDisplay();
    updateBar();
    save();
  } else {
    onEnd();
  }
}

function onEnd() {
  clearInterval(interval);
  running = false;
  bell();

  if (mode === 'focus') {
    sessions++;
    cycleCount++;
    minFocused += MODES.focus.mins;
    save();
    renderStats();
    renderStreak();
    toast('Session complete. Rest now.');

    if (cycleCount >= 4) {
      cycleCount = 0;
      switchMode('long');
    } else {
      switchMode('short');
    }
    pickQuote();
  } else {
    toast('Break over. Back to it.');
    switchMode('focus');
  }

  document.getElementById('btnStart').textContent = 'Start';
}

function updateDisplay() {
  const m = String(Math.floor(remaining / 60)).padStart(2, '0');
  const s = String(remaining % 60).padStart(2, '0');
  document.getElementById('timerEl').textContent = m + ':' + s;
  document.title = m + ':' + s + ' · FocusMode';
}

function updateBar() {
  const pct = (remaining / total) * 100;
  document.getElementById('progressFill').style.width = pct + '%';
}

function addTask() {
  const field = document.getElementById('taskField');
  const txt   = field.value.trim();
  if (!txt) return;

  tasks.push({ id: Date.now(), text: txt, done: false });
  field.value = '';
  renderTasks();
  save();
}

function toggleTask(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  t.done = !t.done;
  if (t.done) tasksDone++;
  else if (tasksDone > 0) tasksDone--;

  renderStats();
  renderTasks();
  save();
}

function delTask(id) {
  tasks = tasks.filter(x => x.id !== id);
  renderTasks();
  save();
}

function renderTasks() {
  const list  = document.getElementById('taskList');
  const empty = document.getElementById('emptyMsg');

  list.innerHTML = '';

  if (!tasks.length) {
    list.appendChild(empty);
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  const doneCount = tasks.filter(t => t.done).length;
  document.getElementById('taskCount').textContent = doneCount + ' / ' + tasks.length;

  tasks.forEach(t => {
    const row = document.createElement('div');
    row.className = 'task-item' + (t.done ? ' done' : '');

    const chk       = document.createElement('div');
    chk.className   = 'chk';
    chk.textContent = t.done ? '✓' : '';
    chk.onclick     = (function(id) { return function() { toggleTask(id); }; })(t.id);

    const txt       = document.createElement('div');
    txt.className   = 'task-txt';
    txt.textContent = t.text;

    const del       = document.createElement('button');
    del.className   = 'del-btn';
    del.textContent = '×';
    del.onclick     = (function(id) { return function() { delTask(id); }; })(t.id);

    row.appendChild(chk);
    row.appendChild(txt);
    row.appendChild(del);
    list.appendChild(row);
  });
}

function renderStreak() {
  const row = document.getElementById('streakRow');
  row.innerHTML = '';

  for (let i = 0; i < 4; i++) {
    const dot = document.createElement('div');
    if      (i < cycleCount)   dot.className = 'streak-dot filled';
    else if (i === cycleCount) dot.className = 'streak-dot current';
    else                       dot.className = 'streak-dot';
    row.appendChild(dot);
  }

  const lbl       = document.createElement('span');
  lbl.className   = 'streak-label';
  lbl.textContent = cycleCount >= 4
    ? 'long break earned!'
    : (4 - cycleCount) + ' until long break';
  row.appendChild(lbl);
}

function renderStats() {
  document.getElementById('sSessions').textContent = sessions;
  document.getElementById('sTasks').textContent    = tasksDone;
  document.getElementById('sMinutes').textContent  = minFocused;
}

function getCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function stopSound() {
  soundNodes.forEach(n => { try { n.stop(); } catch (e) {} });
  soundNodes = [];
}

function setSound(type) {
  document.querySelectorAll('.snd-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('snd' + type.charAt(0).toUpperCase() + type.slice(1)).classList.add('active');

  stopSound();
  sound = type;
  if (type === 'off') return;

  try {
    const ctx  = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    const sr   = ctx.sampleRate;
    const len  = sr * 4;
    const buf  = ctx.createBuffer(1, len, sr);
    const data = buf.getChannelData(0);

    if (type === 'lofi') {
      let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        b0 = 0.99886*b0 + w*0.0555179;
        b1 = 0.99332*b1 + w*0.0750759;
        b2 = 0.96900*b2 + w*0.1538520;
        b3 = 0.86650*b3 + w*0.3104856;
        b4 = 0.55000*b4 + w*0.5329522;
        b5 = -0.7616*b5 - w*0.0168980;
        data[i] = (b0+b1+b2+b3+b4+b5+b6 + w*0.5362) * 0.045;
        b6 = w * 0.115926;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop   = true;
      const f    = ctx.createBiquadFilter();
      f.type     = 'lowpass';
      f.frequency.value = 450;
      const g    = ctx.createGain();
      g.gain.value = 0.5;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start();
      soundNodes.push(src);

    } else if (type === 'rain') {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop   = true;
      const f    = ctx.createBiquadFilter();
      f.type     = 'bandpass';
      f.frequency.value = 1100;
      f.Q.value  = 0.5;
      const g    = ctx.createGain();
      g.gain.value = 0.28;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start();
      soundNodes.push(src);

    } else if (type === 'white') {
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop   = true;
      const g    = ctx.createGain();
      g.gain.value = 0.06;
      src.connect(g); g.connect(ctx.destination);
      src.start();
      soundNodes.push(src);

    } else if (type === 'fire') {
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * (0.5 + 0.5 * Math.sin(i / sr * 0.7));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop   = true;
      const f    = ctx.createBiquadFilter();
      f.type     = 'lowpass';
      f.frequency.value = 320;
      const g    = ctx.createGain();
      g.gain.value = 0.22;
      src.connect(f); f.connect(g); g.connect(ctx.destination);
      src.start();
      soundNodes.push(src);
    }

  } catch (e) {
    console.error('Audio error:', e);
  }
}

function bell() {
  try {
    const ctx = getCtx();
    if (ctx.state === 'suspended') ctx.resume();

    [880, 660, 440].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type  = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, ctx.currentTime + i * 0.18);
      g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 1.5);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 1.5);
    });
  } catch (e) {
    console.error('Bell error:', e);
  }
}

function toast(msg) {
  const t = document.getElementById('toastEl');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}

function renderAll() {
  renderTasks();
  renderStats();
  renderStreak();
}

load();
updateDisplay();
updateBar();
pickQuote();
tickClock();
setInterval(tickClock, 15000);
setInterval(() => { if (!running) pickQuote(); }, 60000);
