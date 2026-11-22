(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const KEY = 'daybloom.v1';
const VERSION = '1.4.0';
const PPH = 64, PPM = PPH / 60;
const SHORT_H = 40; // shorter blocks get the one-line layout + a compact start time
const COLORS = ['#ff6b6b','#ff9f43','#feca57','#1dd1a1','#48dbfb','#5f7cff','#a55eea','#ff78b5','#8395a7'];
const ICONS = ['📝','💼','🏃','📚','🍽️','🛒','🧘','💡','📞','✈️','🎯','🛌','💻','🎵','🧹','💊'];
const REPEATS = [['none','Does not repeat'],['daily','Every day'],['weekdays','Weekdays'],['weekly','Every week'],['monthly','Every month']];
const REMINDS = [['','No reminder'],['0','At start time'],['5','5 min before'],['10','10 min before'],['15','15 min before'],['30','30 min before'],['60','1 hour before']];
const pad = n => String(n).padStart(2, '0');
const ds = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ds(d); };
const addMonths = (s, n) => { const d = parse(s); d.setMonth(d.getMonth() + n, 1); return ds(d); };
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fromMin = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
const uid = () => Math.random().toString(36).slice(2, 9);
const snap = m => Math.round(m / 15) * 15;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const todayStr = () => ds(new Date());
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };
const showSheet = el => { el._at = Date.now(); clearTimeout(el._t); el.hidden = false; void el.offsetWidth; el.classList.add('open'); };
const hideSheet = el => { el.classList.remove('open'); clearTimeout(el._t); el._t = setTimeout(() => { if (!el.classList.contains('open')) el.hidden = true; }, 340); };
function burst(el, n = 14) {
  const r = el.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i'), a = Math.random() * 6.283, d = 34 + Math.random() * 60;
    p.className = 'conf';
    p.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;background:${COLORS[i % COLORS.length]}`;
    document.body.appendChild(p); setTimeout(() => p.remove(), 800);
  }
}

/* ---------- state ---------- */
function sample() {
  const t = todayStr();
  const mk = (title, icon, color, time, dur, repeat, date = t) => ({ id: uid(), title, icon, color, date, time, dur, notes: '', subtasks: [], repeat, remind: null, done: {}, skip: [] });
  return [
    mk('Morning routine', '🧘', COLORS[3], '07:00', 30, 'daily'),
    mk('Deep work', '💻', COLORS[5], '09:00', 90, 'weekdays'),
    mk('Lunch', '🍽️', COLORS[1], '13:00', 45, 'daily'),
    mk('Workout', '🏃', COLORS[0], '18:00', 60, 'weekdays'),
    mk('Buy groceries', '🛒', COLORS[2], null, 30, 'none', null),
    mk('Call mom', '📞', COLORS[7], null, 15, 'none', null)
  ];
}
function load() {
  try { const x = JSON.parse(localStorage.getItem(KEY)); if (x && x.tasks) { x.settings = Object.assign({ theme: 'system', accent: '#5f7cff', h24: false, mon: true }, x.settings); x.focus = x.focus || {}; x.fired = x.fired || {}; x.templates = x.templates || []; return x; } } catch (e) {}
  return { tasks: sample(), settings: { theme: 'system', accent: '#5f7cff', h24: false, mon: true }, templates: [], focus: {}, fired: {} };
}
let S = load();
let nativeT;
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} clearTimeout(nativeT); nativeT = setTimeout(scheduleNative, 800); };
let view = 'day', cur = todayStr(), monthCur = cur.slice(0, 8) + '01', needScroll = true;
let animate = true, navDir = 0, drawerMode = null, deferredInstall = null, searchQ = '';
const byId = id => S.tasks.find(t => t.id === id);

/* ---------- imported data ---------- */
// Backups from older versions (or hand-edited files) may be missing fields. Fill them in,
// otherwise occursOn() skips tasks with an unknown repeat and the import looks like it failed.
function normalizeTask(t) {
  t = t && typeof t === 'object' ? t : {};
  return {
    id: typeof t.id === 'string' && t.id ? t.id : uid(),
    title: typeof t.title === 'string' && t.title.trim() ? t.title : 'Untitled',
    icon: typeof t.icon === 'string' && t.icon ? t.icon : '📝',
    color: COLORS.includes(t.color) ? t.color : COLORS[5],
    date: typeof t.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t.date) ? t.date : null,
    time: typeof t.time === 'string' && /^\d{1,2}:\d{2}$/.test(t.time) ? t.time : null,
    dur: Math.max(5, parseInt(t.dur, 10) || 30),
    notes: typeof t.notes === 'string' ? t.notes : '',
    subtasks: Array.isArray(t.subtasks)
      ? t.subtasks.filter(s => s && typeof s.t === 'string').map(s => ({ id: s.id || uid(), t: s.t, done: !!s.done }))
      : [],
    repeat: REPEATS.some(([v]) => v === t.repeat) ? t.repeat : 'none',
    remind: t.remind == null || t.remind === '' || isNaN(+t.remind) ? null : +t.remind,
    done: t.done && typeof t.done === 'object' ? t.done : {},
    skip: Array.isArray(t.skip) ? t.skip.filter(d => typeof d === 'string') : []
  };
}

/* ---------- recurrence ---------- */
function occursOn(t, day) {
  if (!t.date) return false;
  if (t.skip && t.skip.includes(day)) return false;
  if (t.repeat === 'none') return t.date === day;
  if (day < t.date) return false;
  const a = parse(t.date), b = parse(day);
  switch (t.repeat) {
    case 'daily': return true;
    case 'weekdays': return b.getDay() % 6 !== 0;
    case 'weekly': return a.getDay() === b.getDay();
    case 'monthly': return a.getDate() === b.getDate();
  }
  return false;
}
function tasksOn(day) {
  return S.tasks.filter(t => occursOn(t, day)).map(t => ({ t, day, done: !!t.done[day] }))
    .sort((a, b) => (a.t.time || '99:99').localeCompare(b.t.time || '99:99'));
}

/* ---------- formatting ---------- */
function fmt(t) {
  if (!t) return '';
  if (S.settings.h24) return t;
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}
const fmtHour = h => S.settings.h24 ? `${pad(h)}:00` : (h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`);
const fmtDur = m => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}` : `${m}m`;
// compact clock for 30-minute blocks, where "7:00 AM" is too wide to share a line with the title
const shortTime = t => { if (!t) return ''; if (S.settings.h24) return t; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}:${pad(m)}`; };
const longDate = s => parse(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
// stored dates can be missing or hand-edited, and parse() throws on anything that isn't YYYY-MM-DD
const longDateSafe = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? longDate(s) : '';

/* ---------- theme ---------- */
function applyTheme() {
  const th = S.settings.theme;
  const dark = th === 'dark' || (th === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.mode = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--accent', S.settings.accent);
}

/* ---------- render ---------- */
function render() {
  applyTheme();
  renderDrawer();
  renderHeader();
  renderStrip();
  if (view === 'day') renderDay(); else if (view === 'month') renderMonth(); else renderInsights();
}
function stage() {
  const v = $('#view');
  v.classList.remove('anim', 'slide-l', 'slide-r', 'fade'); void v.offsetWidth;
  if (animate) v.classList.add('anim', navDir > 0 ? 'slide-l' : navDir < 0 ? 'slide-r' : 'fade');
  animate = false; navDir = 0;
}
function countUp() {
  $$('[data-count]').forEach(el => {
    const to = +el.dataset.count, suf = el.dataset.suf || '', t0 = performance.now();
    const step = now => { const k = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(to * e) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
function openDrawer(mode) {
  drawerMode = mode; const card = $('#drawerCard');
  card.classList.add('fresh'); renderDrawer(); showSheet($('#drawer'));
  setTimeout(() => card.classList.remove('fresh'), 800);
}
function closeDrawer() { drawerMode = null; hideSheet($('#drawer')); }
function renderDrawer() {
  $$('[data-act="view"]').forEach(b => b.classList.toggle('active', b.dataset.v === view));
  if (!drawerMode) return;
  let h = '<div class="grab"></div>';
  const head = title => `<div class="sheet-head"><h2>${title}</h2><button class="sheet-x" data-act="closeDrawer" aria-label="Close">✕</button></div>`;
  if (drawerMode === 'search') {
    h += head('Search') + `<div class="searchbox"><input id="searchInput" type="search" placeholder="Find a task, note or subtask" value="${esc(searchQ)}" autocomplete="off"></div><div id="searchResults"></div>`;
  } else if (drawerMode === 'inbox') {
    const inbox = S.tasks.filter(t => !t.date);
    h += head('Inbox') + `<p class="hint">Ideas and to-dos without a date. Tap the calendar button to put one on ${esc(longDate(cur))}.</p>
      <ul id="inboxList">${inbox.length ? inbox.map((t, k) => `
        <li class="${t.done.inbox ? 'done' : ''}" style="--i:${k};--c:${t.color}">
          <button class="chk ${t.done.inbox ? 'done' : ''}" data-act="toggle" data-id="${t.id}" data-day="inbox" aria-label="Complete"></button>
          <span class="t" data-act="edit" data-id="${t.id}">${esc(t.icon)} ${esc(t.title)}</span>
          <button class="mini" data-act="schedule" data-id="${t.id}" title="Schedule">📅</button>
        </li>`).join('') : '<div class="empty">Nothing here yet. Park ideas and to-dos without a date.</div>'}</ul>
      <button class="primary wide" data-act="inboxAdd">+ Add to inbox</button>`;
  } else {
    const s = S.settings;
    h += head('Settings');
    h += `<p class="sec-label">Appearance</p>
      <div class="set-group">
        <div class="set-row"><span>Theme</span>
          <select data-set="theme">${['system', 'light', 'dark'].map(v => `<option value="${v}" ${s.theme === v ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}</select></div>
        <div class="set-row"><span>Accent</span><div class="swatches">${COLORS.map(c => `<button class="swatch ${s.accent === c ? 'on' : ''}" style="background:${c}" data-act="accent" data-c="${c}" aria-label="Accent ${c}"></button>`).join('')}</div></div>
        <label class="set-row"><span>24-hour clock</span><input type="checkbox" data-set="h24" ${s.h24 ? 'checked' : ''}></label>
        <label class="set-row"><span>Week starts Monday</span><input type="checkbox" data-set="mon" ${s.mon ? 'checked' : ''}></label>
      </div>
      <p class="sec-label">Data</p>
      <div class="set-group">
        <button class="set-link" data-act="export">Export backup</button>
        <button class="set-link" data-act="import">Import backup</button>
        <button class="set-link" data-act="autoBackup">Back up now</button>
        ${S.autoBackupAt ? '<button class="set-link" data-act="restoreAuto">Restore automatic backup</button>' : ''}
        <button class="set-link danger" data-act="reset">Reset to sample data</button>
      </div>
      <p class="sec-label">Device</p>
      <div class="set-group">
        <button class="set-link" data-act="notif">Notifications</button>
        ${LN() ? '' : '<button class="set-link" data-act="install">Install app</button>'}
      </div>
      <p class="hint" style="margin-top:14px">${S.lastBackup ? 'Last export: ' + esc(longDateSafe(S.lastBackup)) : 'No export yet — worth keeping one off the device'}<br>${S.autoBackupAt ? 'Automatic backup: ' + esc(longDateSafe(S.autoBackupAt)) : 'Automatic backup: runs weekly when you open the app'}</p>
      <p class="hint ver">Daybloom ${VERSION} · data stays on this device</p>`;
  }
  $('#drawerCard').innerHTML = h;
  if (drawerMode === 'search') drawSearch();
}
function drawSearch() {
  const box = $('#searchResults'); if (!box) return;
  const q = searchQ.trim().toLowerCase();
  const haystack = t => [t.title, t.notes || '', ...(t.subtasks || []).map(s => s.t)].join(' ').toLowerCase();
  const list = (q ? S.tasks.filter(t => haystack(t).includes(q)) : S.tasks.slice())
    .sort((a, b) => (a.date || '9999') === (b.date || '9999') ? (a.time || '').localeCompare(b.time || '') : (a.date || '9999').localeCompare(b.date || '9999'));
  box.innerHTML = list.length
    ? `<ul class="results">${list.slice(0, 40).map((t, k) => `
        <li class="res ${t.done && t.done.inbox ? 'done' : ''}" style="--i:${k};--c:${t.color}" data-act="openTask" data-id="${t.id}">
          <span class="ic">${esc(t.icon)}</span>
          <span class="t">${esc(t.title)}<em class="meta">${t.date ? esc(longDateSafe(t.date)) + (t.time ? ' · ' + fmt(t.time) : '') : 'Inbox · no date'}</em></span>
        </li>`).join('')}</ul>`
    : `<div class="empty">No task matches “${esc(searchQ.trim())}”.</div>`;
}
function renderHeader() {
  const title = $('#title'), sub = $('#subtitle'), today = todayStr();
  let pct = 0;
  if (view === 'day') {
    title.textContent = cur === today ? 'Today' : cur === addDays(today, 1) ? 'Tomorrow' : cur === addDays(today, -1) ? 'Yesterday' : parse(cur).toLocaleDateString(undefined, { weekday: 'long' });
    const items = tasksOn(cur), done = items.filter(i => i.done).length;
    pct = items.length ? done / items.length * 100 : 0;
    sub.textContent = `${parse(cur).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} · ${done}/${items.length} done`;
  } else if (view === 'month') {
    title.textContent = 'Calendar'; sub.textContent = parse(monthCur).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  } else { title.textContent = 'Insights'; sub.textContent = 'Last 7 days'; }
  $('#progress i').style.width = pct + '%';
  $('#progress').style.visibility = view === 'day' ? 'visible' : 'hidden';
  $('#todayBtn').style.display = (view === 'day' && cur !== today) ? '' : 'none';
  // the Insights charts run to the right edge, so the add button would sit on top of them
  $('#fab').style.display = view === 'insights' ? 'none' : '';
  $('#weekStrip').style.display = view === 'day' ? '' : 'none';
}
function renderStrip() {
  if (view !== 'day') return;
  $('#weekStrip').className = animate ? 'anim' : '';
  const d = parse(cur), diff = (d.getDay() - (S.settings.mon ? 1 : 0) + 7) % 7, start = addDays(cur, -diff);
  let h = '';
  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i), items = tasksOn(day), done = items.filter(x => x.done).length;
    const p = items.length ? (done / items.length) * 360 : 0;
    h += `<div class="wd ${day === cur ? 'sel' : ''} ${day === todayStr() ? 'today' : ''}" data-act="goto" data-day="${day}">
      <small>${parse(day).toLocaleDateString(undefined, { weekday: 'short' })}</small>
      <div class="ring" style="--p:${p}deg"><span>${parse(day).getDate()}</span></div></div>`;
  }
  $('#weekStrip').innerHTML = h;
}

function blockHTML(i, lane, lanes, n) {
  const t = i.t, start = toMin(t.time), dur = t.dur || 30;
  const sn = t.subtasks.length, sd = t.subtasks.filter(s => s.done).length;
  const subs = sn ? ` · ☑ ${sd}/${sn}` : '';
  const note = t.notes && t.notes.trim() ? ' · 📝' : '';
  const w = 100 / lanes;
  const hpx = Math.max(dur * PPM, 34) - 2;
  // one threshold drives both the layout class and the time format, so they can't disagree
  const compact = hpx < SHORT_H;
  const when = compact
    ? shortTime(t.time)
    : `${fmt(t.time)} – ${fmt(fromMin(start + dur))} · ${fmtDur(dur)}${subs}${note}${t.repeat !== 'none' ? ' · 🔁' : ''}`;
  return `<div class="blk ${i.done ? 'done' : ''} ${compact ? 'short' : ''}" data-id="${t.id}" style="--i:${n};--c:${t.color};top:${start * PPM}px;height:${hpx}px;left:calc(${lane * w}% + 6px);width:calc(${w}% - 12px)">
    <button class="chk ${i.done ? 'done' : ''}" data-act="toggle" data-id="${t.id}" data-day="${i.day}" aria-label="Complete"></button>
    <div class="bt"><b>${esc(t.icon)} ${esc(t.title)}</b><small>${when}</small>${sn ? `<i class="sp" style="--v:${sd / sn * 100}%"></i>` : ''}</div>
    <div class="grip" aria-label="Drag to move">⠿</div><div class="rs"></div></div>`;
}
function layout(timed) {
  const out = []; let cluster = [], clusterEnd = -1;
  const flush = () => { const lanes = Math.max(1, ...cluster.map(c => c.lane + 1)); cluster.forEach(c => out.push(blockHTML(c.i, c.lane, lanes, c.n))); cluster = []; };
  const laneEnds = [];
  timed.forEach(i => {
    const s = toMin(i.t.time), e = s + Math.max(i.t.dur || 30, 30);
    if (s >= clusterEnd) { flush(); laneEnds.length = 0; clusterEnd = -1; }
    let lane = laneEnds.findIndex(le => le <= s);
    if (lane < 0) { lane = laneEnds.length; laneEnds.push(e); } else laneEnds[lane] = e;
    cluster.push({ i, lane, n: out.length + cluster.length }); clusterEnd = Math.max(clusterEnd, e);
  });
  flush();
  return out.join('');
}
function renderDay() {
  const items = tasksOn(cur), timed = items.filter(i => i.t.time), untimed = items.filter(i => !i.t.time);
  let h = '';
  if (untimed.length) {
    h += `<div class="tray"><h4>Anytime</h4>${untimed.map((i, k) => `
      <div class="row ${i.done ? 'done' : ''}" style="--i:${k};--c:${i.t.color}" data-act="edit" data-id="${i.t.id}">
        <button class="chk ${i.done ? 'done' : ''}" data-act="toggle" data-id="${i.t.id}" data-day="${i.day}"></button>
        <span class="ic">${esc(i.t.icon)}</span><span class="t">${esc(i.t.title)}${i.t.subtasks.length ? `<em class="meta">☑ ${i.t.subtasks.filter(x => x.done).length}/${i.t.subtasks.length}</em>` : ''}${i.t.notes && i.t.notes.trim() ? '<em class="meta">📝</em>' : ''}</span></div>`).join('')}</div>`;
  }
  let hours = '';
  for (let hr = 0; hr < 24; hr++) hours += `<div class="hr" style="top:${hr * PPH}px"><span>${fmtHour(hr)}</span></div>`;
  if (!items.length) {
    // nothing planned: a short empty state instead of 24 empty hour rows
    $('#view').innerHTML = h + `<div class="empty-day"><span class="ed-ic">🌱</span><b>Nothing planned</b><p>No tasks on ${esc(longDate(cur))}. Add one to start shaping the day.</p><button class="primary" data-act="add">+ Add a task</button></div>`;
    stage();
    return;
  }
  h += `<div class="timeline" id="grid">${hours}${layout(timed)}${cur === todayStr() ? '<div class="now" id="nowLine"><span id="nowTime"></span></div>' : ''}</div>`;
  $('#view').innerHTML = h;
  stage();
  updateNow();
  if (needScroll) {
    needScroll = false;
    const first = timed.length ? toMin(timed[0].t.time) : 8 * 60;
    const now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
    const target = (cur === todayStr() ? nm : first) - 60;
    $('#view').scrollTop = Math.max(0, target * PPM);
  }
}
function updateNow() {
  const el = $('#nowLine'); if (!el) return;
  const n = new Date(), m = n.getHours() * 60 + n.getMinutes(); el.style.top = m * PPM + 'px';
  const label = $('#nowTime'); if (label) label.textContent = fmt(fromMin(m));
}
function renderMonth() {
  const first = parse(monthCur), mon = S.settings.mon;
  const off = (first.getDay() - (mon ? 1 : 0) + 7) % 7;
  const names = mon ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  let h = `<div class="mnav"><button data-act="prev" aria-label="Previous month">‹</button><b>${parse(monthCur).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button data-act="next" aria-label="Next month">›</button></div>`;
  h += '<div class="month">' + names.map(n => `<div class="mh">${n}</div>`).join('');
  const startDay = addDays(monthCur, -off);
  for (let i = 0; i < 42; i++) {
    const day = addDays(startDay, i), d = parse(day), items = tasksOn(day);
    if (i >= 35 && d.getMonth() !== first.getMonth()) break;
    h += `<div class="mc ${d.getMonth() !== first.getMonth() ? 'out' : ''} ${day === todayStr() ? 'today' : ''}" style="--i:${i}" data-act="goto" data-day="${day}" data-open="1"><b>${d.getDate()}</b>
      <div class="dots">${items.slice(0, 8).map(x => `<i class="${x.done ? 'done' : ''}" style="--c:${x.t.color}"></i>`).join('')}</div></div>`;
  }
  $('#view').innerHTML = h + '</div>';
  stage();
  $('#view').scrollTop = 0; // a view switch shouldn't inherit the previous view's scroll offset
}
function renderInsights() {
  const days = [], today = todayStr();
  for (let i = 6; i >= 0; i--) days.push(addDays(today, -i));
  let total = 0, done = 0, focus = 0;
  const stats = days.map(day => {
    const it = tasksOn(day), d = it.filter(x => x.done).length;
    total += it.length; done += d; focus += S.focus[day] || 0;
    return { day, n: it.length, d };
  });
  let streak = 0;
  for (let i = 0; i <= 365; i++) {
    const it = tasksOn(addDays(today, -i));
    if (it.length && it.every(x => x.done)) streak++; else if (i === 0) continue; else break;
  }
  const max = Math.max(1, ...stats.map(s => s.n));
  $('#view').innerHTML = `
    <div class="cards">
      <div class="stat"><b data-count="${total ? Math.round(done / total * 100) : 0}" data-suf="%">0%</b><span>Completion rate</span></div>
      <div class="stat"><b data-count="${done}">0</b><span>Tasks completed</span></div>
      <div class="stat"><b data-count="${streak}">0</b><span>Day streak</span></div>
      <div class="stat"><b data-count="${focus}" data-suf="m">0m</b><span>Focus time</span></div>
    </div>
    <div class="bars">${stats.map(s => `<div class="bar"><span>${s.d}/${s.n}</span>
      <i style="height:${Math.max(6, s.n / max * 150)}px"><em style="height:${s.n ? s.d / s.n * 100 : 0}%"></em></i>
      <span>${parse(s.day).toLocaleDateString(undefined, { weekday: 'short' })}</span></div>`).join('')}</div>`;
  stage();
  countUp();
  $('#view').scrollTop = 0;
}

/* ---------- editor ---------- */
function openEditor(id, pre) {
  const base = { id: uid(), title: '', icon: '📝', color: COLORS[5], date: cur, time: null, dur: 30, notes: '', subtasks: [], repeat: 'none', remind: null, done: {}, skip: [] };
  const t = id ? JSON.parse(JSON.stringify(byId(id))) : Object.assign(base, pre || {});
  const isNew = !id;
  let subs = t.subtasks.slice();
  const card = $('#modalCard');
  card.innerHTML = `
    <div class="grab"></div>
    <div class="sheet-head"><h2>${isNew ? 'New task' : 'Edit task'}</h2><button class="sheet-x" id="eCloseX" aria-label="Close">✕</button></div>
    ${isNew && S.templates.length ? `<div class="field"><label>Templates</label><div class="tpls">${S.templates.map(tp => `<span class="tpl"><button data-tpl="${tp.id}">${esc(tp.icon)} ${esc(tp.name)}</button><button class="x" data-tpldel="${tp.id}" aria-label="Delete template">✕</button></span>`).join('')}</div></div>` : ''}
    <div class="field"><label>Title</label><input id="eTitle" value="${esc(t.title)}" placeholder="What do you want to do?"></div>
    <div class="field"><label>Icon</label><div class="opts" id="eIcons">${ICONS.map(i => `<button data-v="${i}" class="${t.icon === i ? 'on' : ''}">${i}</button>`).join('')}</div></div>
    <div class="field"><label>Color</label><div class="opts" id="eColors">${COLORS.map(c => `<button class="col ${t.color === c ? 'on' : ''}" data-v="${c}" style="background:${c}"></button>`).join('')}</div></div>
    <div class="grid2">
      <div class="field"><label>Date (empty = Inbox)</label><input type="date" id="eDate" value="${t.date || ''}"></div>
      <div class="field"><label>Start time</label><input type="time" id="eTime" value="${t.time || ''}"></div>
      <div class="field"><label>Duration (min)</label><input type="number" id="eDur" min="5" step="5" value="${t.dur || 30}"></div>
      <div class="field"><label>Reminder</label><select id="eRemind">${REMINDS.map(([v, l]) => `<option value="${v}" ${String(t.remind ?? '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Repeat</label><select id="eRepeat">${REPEATS.map(([v, l]) => `<option value="${v}" ${t.repeat === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="field"><label>Subtasks</label><div id="eSubs"></div><div class="sub"><input type="text" id="eSubNew" placeholder="Add a subtask and press Enter"></div></div>
    <div class="field"><label>Notes</label><textarea id="eNotes" rows="3">${esc(t.notes)}</textarea></div>
    <div class="foot">
      ${isNew ? '' : `<div class="foot-sec"><button class="danger" id="eDel">Delete</button><button id="eDup">Copy</button><button id="eFocus">Focus</button><button id="eTpl">Template</button></div>`}
      <div class="foot-main">
        ${isNew ? '<button id="eTpl">Save as template</button>' : ''}
        <button id="eCancel">Cancel</button><button class="primary" id="eSave">Save</button>
      </div>
    </div>`;
  const drawSubs = () => {
    $('#eSubs', card).innerHTML = subs.map((s, i) => `<div class="sub"><input type="checkbox" data-i="${i}" ${s.done ? 'checked' : ''} style="width:auto"><input type="text" data-t="${i}" value="${esc(s.t)}"><button class="x" data-x="${i}">✕</button></div>`).join('');
  };
  drawSubs();
  card.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tpl) {
      const tp = S.templates.find(x => x.id === b.dataset.tpl); if (!tp) return;
      openEditor(null, { title: tp.title, icon: tp.icon, color: tp.color, time: tp.time, dur: tp.dur, notes: tp.notes, repeat: tp.repeat, remind: tp.remind, date: $('#eDate', card).value || null, subtasks: tp.subtasks.map(x => ({ id: uid(), t: x.t, done: false })) });
      buzz(8); return;
    }
    if (b.dataset.tpldel) {
      if (confirm('Delete this template?')) { S.templates = S.templates.filter(x => x.id !== b.dataset.tpldel); save(); openEditor(null, { date: $('#eDate', card).value || null }); }
      return;
    }
    if (b.parentElement.id === 'eIcons') { t.icon = b.dataset.v; $$('#eIcons button', card).forEach(x => x.classList.toggle('on', x === b)); }
    else if (b.parentElement.id === 'eColors') { t.color = b.dataset.v; $$('#eColors button', card).forEach(x => x.classList.toggle('on', x === b)); }
    else if (b.dataset.x !== undefined) { subs.splice(+b.dataset.x, 1); drawSubs(); }
  };
  card.onchange = e => {
    if (e.target.dataset.i !== undefined) subs[+e.target.dataset.i].done = e.target.checked;
    if (e.target.dataset.t !== undefined) subs[+e.target.dataset.t].t = e.target.value;
  };
  $('#eSubNew', card).onkeydown = e => {
    if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); subs.push({ id: uid(), t: e.target.value.trim(), done: false }); e.target.value = ''; drawSubs(); }
  };
  $('#eCancel', card).onclick = closeModal;
  $('#eTpl', card).onclick = () => {
    const title = $('#eTitle', card).value.trim();
    if (!title) { $('#eTitle', card).focus(); toast('Give the task a title first'); return; }
    const tp = { id: uid(), name: title, title, icon: t.icon, color: t.color, time: $('#eTime', card).value || null, dur: Math.max(5, parseInt($('#eDur', card).value) || 30), notes: $('#eNotes', card).value, repeat: $('#eRepeat', card).value, remind: $('#eRemind', card).value === '' ? null : +$('#eRemind', card).value, subtasks: subs.filter(x => x.t.trim()).map(x => ({ id: uid(), t: x.t, done: false })) };
    S.templates = S.templates.filter(x => x.name.toLowerCase() !== title.toLowerCase()).concat(tp);
    save(); buzz(12); toast('Saved as a template ★ — find it under New task');
  };
  $('#eSave', card).onclick = () => {
    const title = $('#eTitle', card).value.trim();
    if (!title) { $('#eTitle', card).focus(); return; }
    const pending = $('#eSubNew', card).value.trim(); if (pending) subs.push({ id: uid(), t: pending, done: false });
    t.title = title;
    t.date = $('#eDate', card).value || null;
    t.time = $('#eTime', card).value || null;
    t.dur = Math.max(5, parseInt($('#eDur', card).value) || 30);
    t.remind = $('#eRemind', card).value === '' ? null : +$('#eRemind', card).value;
    t.repeat = t.date ? $('#eRepeat', card).value : 'none';
    t.notes = $('#eNotes', card).value;
    t.subtasks = subs.filter(s => s.t.trim());
    if (isNew) S.tasks.push(t); else S.tasks[S.tasks.findIndex(x => x.id === t.id)] = t;
    save(); closeModal(); render();
  };
  if (!isNew) {
    $('#eDel', card).onclick = () => {
      const orig = byId(t.id), snap = stateSnapshot();
      if (orig.repeat !== 'none' && orig.date) {
        if (confirm('Delete the whole series?\nOK = all repeats, Cancel = only ' + cur)) S.tasks = S.tasks.filter(x => x.id !== t.id);
        else { orig.skip = (orig.skip || []).concat(cur); }
      } else S.tasks = S.tasks.filter(x => x.id !== t.id);
      save(); closeModal(); render(); offerUndo('Task deleted', snap);
    };
    $('#eDup', card).onclick = () => { const c = JSON.parse(JSON.stringify(byId(t.id))); c.id = uid(); c.title += ' (copy)'; c.done = {}; S.tasks.push(c); save(); closeModal(); render(); toast('Duplicated'); };
    $('#eFocus', card).onclick = () => { closeModal(); openFocus(t.id); };
  }
  $('#eCloseX', card).onclick = closeModal;
  showSheet($('#modal'));
  if (isNew) setTimeout(() => $('#eTitle', card).focus(), 380);
}
function closeModal() { hideSheet($('#modal')); }

/* ---------- focus timer ---------- */
// Time is derived from a wall-clock deadline, not from counting intervals, so backgrounding
// the app (where timers are throttled or killed) no longer pauses or loses the session.
let F = { id: null, total: 25 * 60, remain: 25 * 60, iv: null, running: false, endsAt: 0, day: todayStr() };
function drawFocus() {
  $('#fRing').style.setProperty('--fp', ((1 - F.remain / F.total) * 360) + 'deg');
  $('#fTime').textContent = `${pad(Math.floor(F.remain / 60))}:${pad(F.remain % 60)}`;
  $('#fStart').textContent = F.running ? 'Pause' : 'Start';
}
function logFocus(sec, day = todayStr()) { if (sec < 60) return; S.focus[day] = (S.focus[day] || 0) + Math.round(sec / 60); save(); }
function clearTick() { clearInterval(F.iv); F.iv = null; }
function leftSeconds() { return F.running ? Math.max(0, Math.round((F.endsAt - Date.now()) / 1000)) : F.remain; }
function persistFocus() {
  if (F.total && (F.running || (F.remain > 0 && F.remain < F.total))) {
    S.focusSession = { id: F.id, total: F.total, remain: F.remain, endsAt: F.running ? F.endsAt : 0, day: F.day };
  } else delete S.focusSession;
  save();
}
function tickFocus() {
  if (!F.running) return;
  const left = leftSeconds();
  if (left !== F.remain) { F.remain = left; drawFocus(); }
  if (left <= 0) finishFocus();
}
function startFocusTimer() {
  if (F.remain <= 0) F.remain = F.total;
  F.running = true; F.endsAt = Date.now() + F.remain * 1000;
  clearTick(); F.iv = setInterval(tickFocus, 250);
  drawFocus(); persistFocus();
}
function pauseFocusTimer() {
  if (!F.running) return;
  F.remain = leftSeconds(); F.running = false; clearTick();
  drawFocus(); persistFocus();
}
function finishFocus() {
  clearTick(); F.running = false; F.remain = 0;
  logFocus(F.total, F.day);
  delete S.focusSession; save();
  drawFocus();
  notify('Focus complete 🎉', 'Time for a break.');
  if (view === 'insights') render();
}
function openFocus(id) {
  const s = S.focusSession;
  F.id = id; clearTick(); F.running = false;
  if (s && s.total) {
    F.total = s.total; F.day = s.day || todayStr();
    F.remain = s.endsAt ? Math.max(0, Math.round((s.endsAt - Date.now()) / 1000)) : s.remain;
    if (F.remain <= 0) { F.remain = 0; logFocus(s.total, F.day); delete S.focusSession; save(); }
    else if (s.endsAt) { F.running = true; F.endsAt = s.endsAt; F.iv = setInterval(tickFocus, 250); }
  } else { F.total = F.remain = 25 * 60; F.day = todayStr(); }
  $('#fTitle').textContent = byId(id) ? `${byId(id).icon} ${byId(id).title}` : 'Focus';
  $$('.fpresets button').forEach(b => b.classList.toggle('on', +b.dataset.f === Math.round(F.total / 60)));
  drawFocus(); showSheet($('#focus'));
}
function restoreFocusSession() {
  const s = S.focusSession; if (!s || !s.total) return;
  F.id = s.id; F.total = s.total; F.day = s.day || todayStr();
  if (s.endsAt) {
    const left = Math.round((s.endsAt - Date.now()) / 1000);
    if (left > 0) { F.remain = left; F.running = true; F.endsAt = s.endsAt; F.iv = setInterval(tickFocus, 250); }
    else { F.remain = 0; logFocus(s.total, F.day); delete S.focusSession; save(); }
  } else F.remain = s.remain;
  drawFocus();
}
$('#fStart').onclick = () => { F.running ? pauseFocusTimer() : startFocusTimer(); };
$('#fReset').onclick = () => { clearTick(); F.running = false; F.remain = F.total; delete S.focusSession; save(); drawFocus(); };
$('#fClose').onclick = () => {
  // a running timer keeps going in the background; a paused one logs what was actually spent
  if (F.running) persistFocus();
  else { const spent = F.total - F.remain; if (spent >= 60 && F.remain > 0) logFocus(spent, F.day); delete S.focusSession; save(); }
  hideSheet($('#focus'));
};
$$('.fpresets button').forEach(b => b.onclick = () => {
  clearTick(); F.running = false; F.total = F.remain = +b.dataset.f * 60; F.day = F.day || todayStr(); delete S.focusSession; save();
  $$('.fpresets button').forEach(x => x.classList.toggle('on', x === b)); drawFocus();
});

/* ---------- toast + notifications ---------- */
let toastT;
// a toast can carry an Undo button, which is the safety net for destructive actions
function toast(msg, undo) {
  const el = $('#toast');
  el.textContent = msg;
  if (undo) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'undo'; b.textContent = 'Undo';
    b.onclick = () => { clearTimeout(toastT); el.classList.remove('show'); undo(); };
    el.appendChild(b);
  }
  el.classList.toggle('act', !!undo);
  el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), undo ? 6000 : 3500);
}
const stateSnapshot = () => JSON.stringify(S);
// call with a snapshot taken BEFORE the change: restoring it also reverts side effects
function offerUndo(msg, snap) {
  toast(msg, () => { try { S = JSON.parse(snap); } catch (e) { return; } save(); render(); });
}
function notify(title, body) {
  toast(`${title}${body ? ' — ' + body : ''}`);
  try { if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body }); } catch (e) {}
}
function tick() {
  const now = new Date(), today = ds(now), nm = now.getHours() * 60 + now.getMinutes();
  Object.keys(S.fired).forEach(k => { if (!k.startsWith(today)) delete S.fired[k]; });
  tasksOn(today).forEach(({ t, done }) => {
    if (done || !t.time || t.remind == null) return;
    const start = toMin(t.time), k = `${today}|${t.id}|${t.time}`;
    if (S.fired[k]) return;
    if (nm >= start - t.remind && nm <= start + 5) {
      S.fired[k] = 1; save();
      notify(`${t.icon} ${t.title}`, t.remind ? `Starts in ${start - nm} min (${fmt(t.time)})` : `Starting now (${fmt(t.time)})`);
    }
  });
  updateNow();
}
setInterval(tick, 20000);

/* ---------- events ---------- */
const isTyping = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement && document.activeElement.tagName);
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.id;
  switch (act) {
    case 'toggle': {
      const t = byId(id); if (!t) break; const d = el.dataset.day, nowDone = !t.done[d];
      t.done[d] = nowDone; save(); buzz(nowDone ? 18 : 8);
      el.classList.toggle('done', nowDone); el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
      const holder = el.closest('.blk,.row,li'); if (holder) holder.classList.toggle('done', nowDone);
      if (nowDone) {
        burst(el, 12);
        if (d === cur && view === 'day' && tasksOn(cur).every(x => x.done)) setTimeout(() => { burst($('#title'), 30); buzz([30, 40, 30]); toast('All done for today 🎉'); }, 260);
      }
      setTimeout(render, 420); break;
    }
    case 'closeDrawer': closeDrawer(); break;
    case 'edit': closeDrawer(); openEditor(id); break;
    case 'goto': { const nd = el.dataset.day; navDir = nd > cur ? 1 : nd < cur ? -1 : 0; cur = nd; monthCur = cur.slice(0, 8) + '01'; if (el.dataset.open) { view = 'day'; navDir = 0; needScroll = true; } animate = true; buzz(6); render(); break; }
    case 'view': if (view === el.dataset.v) break; view = el.dataset.v; needScroll = true; navDir = 0; animate = true; if (view === 'month') monthCur = cur.slice(0, 8) + '01'; buzz(6); render(); break;
    case 'inboxAdd': closeDrawer(); openEditor(null, { date: null }); break;
    case 'schedule': { const t = byId(id); t.date = cur; save(); closeDrawer(); view = 'day'; animate = true; render(); openEditor(id); toast('Moved to ' + longDate(cur)); break; }
    case 'add': openEditor(null, { date: view === 'day' ? cur : todayStr() }); break;
    case 'prev': shift(-1); break;
    case 'next': shift(1); break;
    case 'today': navDir = todayStr() > cur ? 1 : -1; cur = todayStr(); monthCur = cur.slice(0, 8) + '01'; needScroll = true; animate = true; buzz(6); render(); break;
    case 'menu': openDrawer('inbox'); break;
    case 'search': searchQ = ''; openDrawer('search'); setTimeout(() => { const i = $('#searchInput'); if (i) i.focus(); }, 320); break;
    case 'openTask': {
      const t = byId(id); if (!t) break;
      closeDrawer(); cur = t.date || todayStr(); monthCur = cur.slice(0, 8) + '01';
      view = 'day'; needScroll = true; animate = true; render(); openEditor(id); break;
    }
    case 'autoBackup': autoBackup(true); break;
    case 'restoreAuto': restoreAutoBackup(); break;
    case 'settings': openDrawer('settings'); break;
    case 'install': if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; } else toast('In Chrome: menu ⋮ → Install app (needs https hosting)'); break;
    case 'accent': S.settings.accent = el.dataset.c; save(); render(); break;
    case 'notif':
      if (LN()) { enableNativeNotifications(); break; }
      if (!('Notification' in window)) { toast('Notifications are not supported in this browser (in-app reminders still work)'); break; }
      Notification.requestPermission().then(p => toast(p === 'granted' ? 'Notifications enabled ✅' : 'Permission not granted — in-app reminders will still appear'));
      break;
    case 'export': exportBackup(); break;
    case 'import': $('#importFile').click(); break;
    case 'reset': {
      const snap = stateSnapshot();
      S = { tasks: sample(), settings: S.settings, templates: S.templates || [], lastBackup: S.lastBackup, autoBackupAt: S.autoBackupAt, focus: {}, fired: {} };
      save(); render(); offerUndo('Reset to sample data', snap); break;
    }
  }
});
document.addEventListener('input', e => {
  if (e.target.id !== 'searchInput') return;
  searchQ = e.target.value; drawSearch();
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.set; if (!k) return;
  S.settings[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; save(); render();
});
$('#importFile').onchange = e => {
  const f = e.target.files && e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    e.target.value = '';
    let x;
    try { x = JSON.parse(String(r.result).replace(/^\uFEFF/, '')); } catch (err) { toast('That file is not valid JSON'); return; }
    if (!x || !Array.isArray(x.tasks)) { toast('That file is not a Daybloom backup'); return; }
    applyImport(x);
    toast(`Imported ${S.tasks.length} task${S.tasks.length === 1 ? '' : 's'} ✅`);
  };
  r.onerror = () => { e.target.value = ''; toast('Could not read that file'); };
  r.readAsText(f);
};
const canDismiss = el => Date.now() - (el._at || 0) > 500; // ignore the ghost mouse event that follows a tap
$('#modal').addEventListener('mousedown', e => { if (e.target.id === 'modal' && canDismiss(e.target)) closeModal(); });
$('#drawer').addEventListener('mousedown', e => { if (e.target.id === 'drawer' && canDismiss(e.target)) closeDrawer(); });
$('#focus').addEventListener('mousedown', e => { if (e.target.id === 'focus' && canDismiss(e.target)) $('#fClose').click(); });
function shift(dir) {
  if (view === 'month') monthCur = addMonths(monthCur, dir); else if (view === 'day') cur = addDays(cur, dir); else return;
  navDir = dir; animate = true; buzz(6); render();
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeDrawer(); return; }
  if (isTyping() || e.metaKey || e.ctrlKey || !$('#modal').hidden) return;
  if (e.key === 'n') { e.preventDefault(); openEditor(null, { date: cur }); }
  else if (e.key === 't') { cur = todayStr(); needScroll = true; render(); }
  else if (e.key === 'ArrowLeft') shift(-1);
  else if (e.key === 'ArrowRight') shift(1);
  else if (e.key === '1') { view = 'day'; needScroll = true; render(); }
  else if (e.key === '2') { view = 'month'; render(); }
  else if (e.key === '3') { view = 'insights'; render(); }
});

/* timeline: click empty slot to add, drag to move, drag bottom edge to resize */
const viewEl = $('#view');
viewEl.addEventListener('click', e => {
  const grid = $('#grid'); if (!grid || !(e.target === grid || e.target.classList.contains('hr'))) return;
  const y = e.clientY - grid.getBoundingClientRect().top;
  const m = Math.max(0, Math.min(23 * 60 + 45, Math.floor(y / PPM / 15) * 15));
  openEditor(null, { date: cur, time: fromMin(m) });
});
viewEl.addEventListener('pointerdown', e => {
  const blk = e.target.closest('.blk'); if (!blk || e.target.closest('.chk')) return;
  const id = blk.dataset.id, t = byId(id); if (!t) return;
  const mode = e.target.classList.contains('rs') ? 'resize' : 'move';
  // On touch screens only the grip / resize handle drag; the rest of the block scrolls and taps to edit
  const canDrag = e.pointerType !== 'touch' || e.target.classList.contains('grip') || mode === 'resize';
  const y0 = e.clientY, top0 = parseFloat(blk.style.top), h0 = parseFloat(blk.style.height);
  let moved = false;
  try { blk.setPointerCapture(e.pointerId); } catch (err) {}
  let lastM = -1, curTop = top0;
  const mv = ev => {
    if (!canDrag) return;
    const dy = ev.clientY - y0;
    if (!moved && Math.abs(dy) > 4) { moved = true; blk.classList.add('lift'); blk.style.transition = 'none'; buzz(10); }
    if (!moved) return;
    if (mode === 'move') {
      // translate instead of top: the block moves on the compositor, no layout or paint per frame
      curTop = Math.max(0, Math.min(24 * PPH - h0, top0 + dy));
      blk.style.transform = `translateY(${curTop - top0}px) scale(1.03)`;
      const mm = snap(curTop / PPM); if (mm !== lastM) { lastM = mm; buzz(4); }
      blk.style.setProperty('--tip', `"${fmt(fromMin(Math.min(mm, 24 * 60 - 15)))}"`);
    } else {
      const hh = Math.max(15 * PPM, h0 + dy); blk.style.height = hh + 'px';
      const mm = Math.max(15, snap((hh + 2) / PPM)); if (mm !== lastM) { lastM = mm; buzz(4); }
      blk.style.setProperty('--tip', `"${fmtDur(mm)}"`);
    }
  };
  const end = () => { blk.removeEventListener('pointermove', mv); blk.removeEventListener('pointerup', up); blk.removeEventListener('pointercancel', cancel); };
  // interrupted drag (pointercancel, e.g. the phone starts scrolling): put the block back where it was
  const cancel = () => { end(); if (moved) { blk.style.transform = ''; blk.style.transition = ''; blk.style.height = h0 + 'px'; blk.classList.remove('lift'); } };
  const up = () => {
    end();
    if (!moved) { openEditor(id); return; } // a tap anywhere on the block (even the resize edge) opens it
    if (mode === 'move') t.time = fromMin(Math.min(snap(curTop / PPM), 24 * 60 - 15));
    else t.dur = Math.max(15, snap((parseFloat(blk.style.height) + 2) / PPM));
    save(); render();
  };
  blk.addEventListener('pointermove', mv); blk.addEventListener('pointerup', up); blk.addEventListener('pointercancel', cancel);
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (S.settings.theme === 'system') applyTheme(); });

/* ---------- native Android reminders (Capacitor Local Notifications) ---------- */
function plug(name) {
  const c = window.Capacitor;
  return (c && c.isNativePlatform && c.isNativePlatform() && c.Plugins && c.Plugins[name]) || null;
}
const LN = () => plug('LocalNotifications');

/* backup: share sheet in the APK (save to Drive, WhatsApp, email...), file download in a browser */
async function exportBackup() {
  const json = JSON.stringify(S, null, 2), name = `daybloom-backup-${todayStr()}.json`;
  const fsP = plug('Filesystem'), shP = plug('Share');
  try {
    if (fsP && shP) {
      const r = await fsP.writeFile({ path: name, data: json, directory: 'CACHE', encoding: 'utf8' });
      await shP.share({ title: 'Daybloom backup', text: 'Daybloom backup ' + todayStr(), files: [r.uri], dialogTitle: 'Save your backup to Drive or send it to yourself' });
    } else {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
    }
    S.lastBackup = todayStr(); save(); if (drawerMode === 'settings') renderDrawer();
    toast('Backup ready ✅');
  } catch (e) {
    if (!/cancel/i.test(String((e && e.message) || e))) toast('Backup failed. Try again.');
  }
}
/* ---------- automatic backups ---------- */
// One rolling backup, refreshed weekly on launch, so cleared data or a lost phone still has
// a recent copy. Native writes a file to Documents; the browser keeps a second localStorage key.
const AUTO_FILE = 'daybloom-auto-backup.json', AUTO_KEY = 'daybloom.autobackup';
async function autoBackup(manual) {
  const json = JSON.stringify(S), fsP = plug('Filesystem');
  let ok = false;
  if (fsP) { try { await fsP.writeFile({ path: AUTO_FILE, data: json, directory: 'DOCUMENTS', encoding: 'utf8', recursive: true }); ok = true; } catch (e) {} }
  if (!ok) { try { localStorage.setItem(AUTO_KEY, json); ok = true; } catch (e) {} }
  if (ok) {
    S.autoBackupAt = todayStr(); save();
    if (drawerMode === 'settings') renderDrawer();
    if (manual) toast('Backup saved ✅');
  } else if (manual) toast('Could not save a backup on this device');
}
const autoBackupDue = () => !S.autoBackupAt || S.autoBackupAt < addDays(todayStr(), -7);
function applyImport(x) {
  S = {
    tasks: x.tasks.map(normalizeTask),
    settings: Object.assign({ theme: 'system', accent: '#5f7cff', h24: false, mon: true }, S.settings, x.settings && typeof x.settings === 'object' ? x.settings : {}),
    templates: Array.isArray(x.templates) ? x.templates : [],
    focus: x.focus && typeof x.focus === 'object' ? x.focus : {},
    fired: {},
    lastBackup: x.lastBackup,
    autoBackupAt: x.autoBackupAt
  };
  save(); closeDrawer(); render(); buzz(20);
}
async function restoreAutoBackup() {
  const fsP = plug('Filesystem');
  let raw = null;
  if (fsP) { try { const r = await fsP.readFile({ path: AUTO_FILE, directory: 'DOCUMENTS', encoding: 'utf8' }); raw = typeof r.data === 'string' ? r.data : null; } catch (e) {} }
  if (!raw) { try { raw = localStorage.getItem(AUTO_KEY); } catch (e) {} }
  if (!raw) { toast('No automatic backup on this device yet'); return; }
  let x; try { x = JSON.parse(raw); } catch (e) { toast('That backup is not readable'); return; }
  if (!x || !Array.isArray(x.tasks)) { toast('That backup is not readable'); return; }
  const snap = stateSnapshot();
  applyImport(x);
  offerUndo(`Restored ${x.tasks.length} task${x.tasks.length === 1 ? '' : 's'}`, snap);
}
function hashId(str) { let h = 7; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h) % 2147483000 + 1; }
const CHANNEL = { id: 'reminders', name: 'Task reminders', description: 'Reminders before your tasks start', importance: 4, visibility: 1, vibration: true };
async function scheduleNative() {
  const ln = LN(); if (!ln) return;
  try {
    const perm = await ln.checkPermissions(); if (perm.display !== 'granted') return;
    const pend = await ln.getPending();
    if (pend.notifications && pend.notifications.length) await ln.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
    const now = Date.now(), list = [];
    for (let i = 0; i <= 14; i++) {
      const day = addDays(todayStr(), i), [y, m, d] = day.split('-').map(Number);
      tasksOn(day).forEach(({ t, done }) => {
        if (done || !t.time || t.remind == null) return;
        const at = new Date(new Date(y, m - 1, d, 0, toMin(t.time)).getTime() - t.remind * 60000);
        if (at.getTime() <= now) return;
        list.push({ id: hashId(t.id + '|' + day), title: `${t.icon} ${t.title}`, body: t.remind ? `Starts in ${t.remind} min (${fmt(t.time)})` : `Starting now (${fmt(t.time)})`, schedule: { at, allowWhileIdle: true }, channelId: 'reminders' });
      });
    }
    list.sort((a, b) => a.schedule.at - b.schedule.at);
    if (list.length) await ln.schedule({ notifications: list.slice(0, 60) });
  } catch (e) {}
}
async function enableNativeNotifications() {
  const ln = LN(); if (!ln) return;
  try {
    const p = await ln.requestPermissions();
    if (p.display !== 'granted') { toast('Notifications are blocked. Turn them on in Android Settings > Apps > Daybloom.'); return; }
    await ln.createChannel(CHANNEL);
    try {
      const ex = await ln.checkExactNotificationSetting();
      if (ex.exact_alarm !== 'granted') { toast('Allow "Alarms & reminders" so reminders arrive on time'); await ln.changeExactNotificationSetting(); }
    } catch (e) {}
    await scheduleNative(); toast('Reminders enabled ✅');
  } catch (e) { toast('Could not enable notifications'); }
}

/* swipe left/right to change day (or month) */
let sx = 0, sy = 0, st = 0, swOk = false;
$('#app').addEventListener('touchstart', e => {
  const t = e.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now();
  swOk = !e.target.closest('.grip,.rs,.chk,input,select,textarea') && view !== 'insights';
}, { passive: true });
$('#app').addEventListener('touchend', e => {
  if (!swOk) return; swOk = false;
  const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
  if (Math.abs(dx) > 70 && Math.abs(dy) < 45 && Date.now() - st < 650) shift(dx < 0 ? 1 : -1);
}, { passive: true });

/* drag a sheet down by its handle to dismiss */
let gy = null, gcard = null;
document.addEventListener('touchstart', e => {
  const g = e.target.closest('.grab'); if (!g) return;
  gcard = g.closest('.card'); gy = e.touches[0].clientY; gcard.style.transition = 'none';
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (gy == null) return;
  gcard.style.transform = `translateY(${Math.max(0, e.touches[0].clientY - gy)}px)`;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (gy == null) return;
  const dy = e.changedTouches[0].clientY - gy, ov = gcard.closest('.overlay');
  gcard.style.transition = ''; gcard.style.transform = ''; gy = null;
  if (dy > 90) { if (ov.id === 'modal') closeModal(); else if (ov.id === 'drawer') closeDrawer(); else if (ov.id === 'focus') $('#fClose').click(); }
}, { passive: true });

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; });

render();
tick();
restoreFocusSession();
if (autoBackupDue()) setTimeout(() => autoBackup(false), 2000);
if (LN()) { LN().createChannel(CHANNEL).catch(() => {}); scheduleNative(); }

/* Android back button: close the top sheet, then go back to Day, then to Today, then exit */
const AppP = plug('App');
if (AppP && AppP.addListener) {
  AppP.addListener('backButton', () => {
    if ($('#focus').classList.contains('open')) { $('#fClose').click(); return; }
    if ($('#modal').classList.contains('open')) { closeModal(); return; }
    if ($('#drawer').classList.contains('open')) { closeDrawer(); return; }
    if (view !== 'day') { view = 'day'; navDir = 0; animate = true; needScroll = true; render(); return; }
    if (cur !== todayStr()) { navDir = todayStr() > cur ? 1 : -1; cur = todayStr(); monthCur = cur.slice(0, 8) + '01'; needScroll = true; animate = true; render(); return; }
    if (AppP.exitApp) AppP.exitApp(); else if (AppP.minimizeApp) AppP.minimizeApp();
  });
}

/* PWA: offline support + installable on Android (needs https or localhost) */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
/* Re-sync when the app returns to the foreground (new day, due reminders) */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  tickFocus();
  render(); tick(); scheduleNative();
  if (autoBackupDue()) autoBackup(false);
});
})();
