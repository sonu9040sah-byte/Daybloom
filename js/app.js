(() => {
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const KEY = 'daybloom.v1';
const PPH = 64, PPM = PPH / 60;
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
let animate = true, navDir = 0, drawerMode = null, deferredInstall = null;
const byId = id => S.tasks.find(t => t.id === id);

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
const longDate = s => parse(s).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

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
  if (drawerMode === 'inbox') {
    const inbox = S.tasks.filter(t => !t.date);
    h += `<h2>Inbox</h2><p class="hint">Ideas and to-dos without a date. Tap 📅 to put one on ${esc(longDate(cur))}.</p>
      <ul id="inboxList">${inbox.length ? inbox.map((t, k) => `
        <li class="${t.done.inbox ? 'done' : ''}" style="--i:${k};--c:${t.color}">
          <button class="chk ${t.done.inbox ? 'done' : ''}" data-act="toggle" data-id="${t.id}" data-day="inbox" aria-label="Complete"></button>
          <span class="t" data-act="edit" data-id="${t.id}">${esc(t.icon)} ${esc(t.title)}</span>
          <button class="mini" data-act="schedule" data-id="${t.id}" title="Schedule">📅</button>
        </li>`).join('') : '<div class="empty">Nothing here yet. Park ideas and to-dos without a date.</div>'}</ul>
      <button class="primary wide" data-act="inboxAdd">+ Add to inbox</button>`;
  } else {
    const s = S.settings;
    h += `<h2>Settings</h2>
      <div class="set-row"><span>Theme</span>
        <select data-set="theme">${['system', 'light', 'dark'].map(v => `<option ${s.theme === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="set-row"><span>Accent</span><div class="swatches">${COLORS.map(c => `<button class="swatch ${s.accent === c ? 'on' : ''}" style="background:${c}" data-act="accent" data-c="${c}" aria-label="Accent ${c}"></button>`).join('')}</div></div>
      <label class="set-row"><span>24-hour clock</span><input type="checkbox" data-set="h24" ${s.h24 ? 'checked' : ''}></label>
      <label class="set-row"><span>Week starts Monday</span><input type="checkbox" data-set="mon" ${s.mon ? 'checked' : ''}></label>
      <p class="hint">Last backup: ${s.lastBackup || S.lastBackup ? esc(longDate(S.lastBackup)) : 'never — tap Export to save one'}</p>
      <div class="btn-row">
        <button data-act="notif">🔔 Notifications</button>
        ${LN() ? '' : '<button data-act="install">📲 Install app</button>'}
        <button data-act="export">⬇️ Export</button>
        <button data-act="import">⬆️ Import</button>
        <button data-act="reset" style="grid-column:1/-1">♻️ Reset to sample data</button>
      </div>`;
  }
  $('#drawerCard').innerHTML = h;
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
  return `<div class="blk ${i.done ? 'done' : ''} ${hpx < 56 ? 'short' : ''}" data-id="${t.id}" style="--i:${n};--c:${t.color};top:${start * PPM}px;height:${hpx}px;left:calc(${lane * w}% + 6px);width:calc(${w}% - 12px)">
    <button class="chk ${i.done ? 'done' : ''}" data-act="toggle" data-id="${t.id}" data-day="${i.day}" aria-label="Complete"></button>
    <div class="bt"><b>${esc(t.icon)} ${esc(t.title)}</b><small>${fmt(t.time)} – ${fmt(fromMin(start + dur))} · ${fmtDur(dur)}${subs}${note}${t.repeat !== 'none' ? ' · 🔁' : ''}</small>${sn ? `<i class="sp" style="--v:${sd / sn * 100}%"></i>` : ''}</div>
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
  h += `<div class="timeline" id="grid">${hours}${layout(timed)}${cur === todayStr() ? '<div class="now" id="nowLine"></div>' : ''}</div>`;
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
  const n = new Date(); el.style.top = (n.getHours() * 60 + n.getMinutes()) * PPM + 'px';
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
}

/* ---------- editor ---------- */
function openEditor(id, pre) {
  const base = { id: uid(), title: '', icon: '📝', color: COLORS[5], date: cur, time: null, dur: 30, notes: '', subtasks: [], repeat: 'none', remind: null, done: {}, skip: [] };
  const t = id ? JSON.parse(JSON.stringify(byId(id))) : Object.assign(base, pre || {});
  const isNew = !id;
  let subs = t.subtasks.slice();
  const card = $('#modalCard');
  card.innerHTML = `
    <div class="grab"></div><h2>${isNew ? 'New task' : 'Edit task'}</h2>
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
      ${isNew ? '' : '<button class="danger" id="eDel">Delete</button><button id="eDup">Duplicate</button><button id="eFocus">⏱ Focus</button>'}
      <button id="eTpl">★ Template</button>
      <button id="eCancel">Cancel</button><button class="primary" id="eSave">Save</button>
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
      const orig = byId(t.id);
      if (orig.repeat !== 'none' && orig.date) {
        if (confirm('Delete the whole series?\nOK = all repeats, Cancel = only ' + cur)) S.tasks = S.tasks.filter(x => x.id !== t.id);
        else { orig.skip = (orig.skip || []).concat(cur); }
      } else S.tasks = S.tasks.filter(x => x.id !== t.id);
      save(); closeModal(); render(); toast('Task deleted');
    };
    $('#eDup', card).onclick = () => { const c = JSON.parse(JSON.stringify(byId(t.id))); c.id = uid(); c.title += ' (copy)'; c.done = {}; S.tasks.push(c); save(); closeModal(); render(); toast('Duplicated'); };
    $('#eFocus', card).onclick = () => { closeModal(); openFocus(t.id); };
  }
  showSheet($('#modal'));
  if (isNew) setTimeout(() => $('#eTitle', card).focus(), 380);
}
function closeModal() { hideSheet($('#modal')); }

/* ---------- focus timer ---------- */
let F = { id: null, total: 25 * 60, remain: 25 * 60, iv: null };
function drawFocus() { $('#fRing').style.setProperty('--fp', ((1 - F.remain / F.total) * 360) + 'deg'); $('#fTime').textContent = `${pad(Math.floor(F.remain / 60))}:${pad(F.remain % 60)}`; $('#fStart').textContent = F.iv ? 'Pause' : 'Start'; }
function openFocus(id) {
  F.id = id; stopFocus(); F.total = F.remain = 25 * 60;
  $('#fTitle').textContent = byId(id) ? `${byId(id).icon} ${byId(id).title}` : 'Focus';
  $$('.fpresets button').forEach(b => b.classList.toggle('on', b.dataset.f === '25'));
  drawFocus(); showSheet($('#focus'));
}
function stopFocus() { clearInterval(F.iv); F.iv = null; }
function logFocus(sec) { const d = todayStr(); S.focus[d] = (S.focus[d] || 0) + Math.round(sec / 60); save(); }
$('#fStart').onclick = () => {
  if (F.iv) { stopFocus(); drawFocus(); return; }
  F.iv = setInterval(() => {
    F.remain--; drawFocus();
    if (F.remain <= 0) { stopFocus(); logFocus(F.total); notify('Focus complete 🎉', 'Time for a break.'); drawFocus(); if (view === 'insights') render(); }
  }, 1000);
  drawFocus();
};
$('#fReset').onclick = () => { stopFocus(); F.remain = F.total; drawFocus(); };
$('#fClose').onclick = () => {
  const spent = F.total - F.remain;
  if (F.iv || (spent > 0 && F.remain > 0)) { stopFocus(); if (spent >= 60) logFocus(spent); }
  hideSheet($('#focus'));
};
$$('.fpresets button').forEach(b => b.onclick = () => {
  stopFocus(); F.total = F.remain = +b.dataset.f * 60;
  $$('.fpresets button').forEach(x => x.classList.toggle('on', x === b)); drawFocus();
});

/* ---------- toast + notifications ---------- */
let toastT;
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 3500); }
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
    case 'reset': if (confirm('Reset everything to the sample data? This deletes all your tasks.')) { S = { tasks: sample(), settings: S.settings, templates: S.templates || [], lastBackup: S.lastBackup, focus: {}, fired: {} }; save(); render(); } break;
  }
});
document.addEventListener('change', e => {
  const k = e.target.dataset && e.target.dataset.set; if (!k) return;
  S.settings[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; save(); render();
});
$('#importFile').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { try { const x = JSON.parse(r.result); if (!Array.isArray(x.tasks)) throw 0; S = Object.assign({ settings: S.settings, focus: {}, fired: {}, templates: [] }, x); S.templates = S.templates || []; S.focus = S.focus || {}; S.fired = S.fired || {}; save(); render(); toast('Backup imported'); } catch (err) { toast('Invalid backup file'); } };
  r.readAsText(f); e.target.value = '';
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
  let lastM = -1;
  const mv = ev => {
    if (!canDrag) return;
    const dy = ev.clientY - y0;
    if (!moved && Math.abs(dy) > 4) { moved = true; blk.classList.add('lift'); buzz(10); }
    if (!moved) return;
    if (mode === 'move') {
      const top = Math.max(0, Math.min(24 * PPH - h0, top0 + dy)); blk.style.top = top + 'px';
      const mm = snap(top / PPM); if (mm !== lastM) { lastM = mm; buzz(4); }
      blk.style.setProperty('--tip', `"${fmt(fromMin(Math.min(mm, 24 * 60 - 15)))}"`);
    } else {
      const hh = Math.max(15 * PPM, h0 + dy); blk.style.height = hh + 'px';
      const mm = Math.max(15, snap((hh + 2) / PPM)); if (mm !== lastM) { lastM = mm; buzz(4); }
      blk.style.setProperty('--tip', `"${fmtDur(mm)}"`);
    }
  };
  const end = () => { blk.removeEventListener('pointermove', mv); blk.removeEventListener('pointerup', up); blk.removeEventListener('pointercancel', end); };
  const up = () => {
    end();
    if (!moved) { openEditor(id); return; } // a tap anywhere on the block (even the resize edge) opens it
    if (mode === 'move') t.time = fromMin(Math.min(snap(parseFloat(blk.style.top) / PPM), 24 * 60 - 15));
    else t.dur = Math.max(15, snap((parseFloat(blk.style.height) + 2) / PPM));
    save(); render();
  };
  blk.addEventListener('pointermove', mv); blk.addEventListener('pointerup', up); blk.addEventListener('pointercancel', end);
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
document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); tick(); scheduleNative(); } });
})();
