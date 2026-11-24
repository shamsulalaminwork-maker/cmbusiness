import { tasksModule } from './tasks.js';
import { projectsModule } from './projects.js';
import { CATALOG } from './catalog.js';
import { loadData, saveData, onBack, exitApp, sharePDF, shareText, isNative, saveImg as nSaveImg, loadImg as nLoadImg, delImg as nDelImg } from './native.js';
import * as S from './sync.js';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = n => String(r2(n));
const fmtComma = n => r2(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const longDate = iso => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const isQ = x => x.type === 'quotation';

const I = (p, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${p}</svg>`;
const ICON = {
  receipt: I('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  box: I('<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>'),
  gear: I('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  back: I('<path d="M15 5l-7 7 7 7"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>', 'stroke-width="2.4"'),
  trash: I('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>'),
  up: I('<path d="M6 15l6-6 6 6"/>'),
  down: I('<path d="M6 9l6 6 6-6"/>'),
  chev: I('<path d="M9 5l7 7-7 7"/>'),
  share: I('<path d="M12 3v12M7 8l5-5 5 5M5 14v6h14v-6"/>'),
  copy: I('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
  eye: I('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  check: I('<path d="M5 12l5 5 9-10"/>'),
  image: I('<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>'),
  quote: I('<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/>'),
  calc: I('<rect x="5" y="3" width="14" height="18" rx="3"/><path d="M8.5 7.5h7M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01"/>'),
  chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  tasks: I('<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.3 1.3L7 5M3.5 12l1.3 1.3L7 11M3.5 18l1.3 1.3L7 17"/>'),
  users: I('<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.4c2 .7 3.5 2.8 3.5 5.6"/>'),
  flag: I('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  cal: I('<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  link: I('<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'),
  msg: I('<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H10l-5 4v-4h-.5A1.5 1.5 0 0 1 4 14.5z"/>'),
  pencil: I('<path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 3 3L8 19z"/><path d="M14.5 6.5l3 3"/>'),
  send: I('<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>'),
  wallet: I('<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3"/><rect x="3.5" y="7.5" width="17" height="12" rx="3"/><circle cx="16.5" cy="13.5" r="1.1"/>'),
  home: I('<path d="M15 5l-7 7 7 7"/>'),
  house: I('<path d="M4 11l8-7 8 7v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>')
};

/* ---------- data ---------- */
const DEFAULT = {
  settings: { catalogV: 1, me: 'owner', prefix: 'C', next: 76, qprefix: 'Q', qnext: 1, email: 'corpomechbd@gmail.com', phone: '+8801612-170202', address: "Shop 128, 68-69 Concept Tower, Greenroad,\nPanthapath, 1205" },
  products: [
    { id: 'p1', name: 'Coupon', desc: "300 GSM Artcard, Dimension - 2'x2.25'", price: 4.4, unit: 'Pcs', flat: false },
    { id: 'p2', name: 'Cutting Charge', desc: '', price: 50, unit: '', flat: true },
    ...CATALOG.map(p => ({ ...p }))
  ],
  invoices: [], drafts: {},
  people: [{ id: 'owner', name: 'Shihab', phone: '' }], tasks: [], projects: []
};
let db = clone(DEFAULT);
const imgs = {};           // product id -> data URL (loaded at start)
const persist = () => { saveData(db); S.changed(); };
// photos: kept on the phone and mirrored to the online bucket when signed in
const saveImg = async (k, d) => { await nSaveImg(k, d); S.upImg(k, d); };
const delImg = async k => { await nDelImg(k); S.rmImg(k); };
const loadImg = async k => {
  const l = await nLoadImg(k); if (l) return l;
  const r = await S.downImg(k); if (r) await nSaveImg(k, r);
  return r;
};
let pendingRender = false;
const refresh = () => { if (stack.length) pendingRender = true; else renderTab(); };
const flushRender = () => { if (pendingRender && !stack.length) { pendingRender = false; renderTab(); } };
const pad = n => String(n).padStart(3, '0');
const docNo = type => type === 'quotation' ? db.settings.qprefix + pad(db.settings.qnext) : db.settings.prefix + pad(db.settings.next);
const newDoc = type => ({ id: uid(), type, no: docNo(type), date: todayISO(), customer: '', items: [], status: 'due', gallery: { on: false, ids: [] } });
const total = inv => r2(inv.items.reduce((s, i) => s + num(i.total), 0));

/* ---------- toast, back stack, pages, sheets ---------- */
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  $('#toasts').appendChild(t); setTimeout(() => t.remove(), 2700);
}
const stack = [];
const raf2 = fn => requestAnimationFrame(() => requestAnimationFrame(fn));
const updUnder = () => $('#tabview').classList.toggle('under', stack.some(e => e.page));

function pushPage(o) {
  const el = document.createElement('section'); el.className = 'page' + (o.cls ? ' ' + o.cls : '');
  el.innerHTML = `<header class="ph"><button class="ib tap" aria-label="Back">${ICON.back}</button><h1>${esc(o.title)}</h1><div class="pr"></div></header><div class="pb"></div><footer class="pf hid"></footer>`;
  $('#pages').appendChild(el);
  const entry = { page: true, el, o, close() { if (o.beforeClose && o.beforeClose(entry) === false) return; closePage(entry); } };
  stack.push(entry);
  $('.ib', el).onclick = () => goBack();
  entry.body = $('.pb', el); entry.foot = $('.pf', el); entry.right = $('.pr', el);
  o.build(entry);
  raf2(() => { el.classList.add('in'); updUnder(); });
  return entry;
}
function closePage(entry) {
  const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1);
  entry.el.classList.remove('in'); updUnder();
  setTimeout(() => { entry.el.remove(); flushRender(); }, 380);
}
function openSheet(html, bind) {
  const wrap = document.createElement('div'); wrap.className = 'sheetwrap';
  wrap.innerHTML = `<div class="backdrop"></div><div class="sheet"><div class="grab"></div>${html}</div>`;
  $('#overlay').appendChild(wrap);
  const entry = { el: wrap, close() { closeSheet(entry); } };
  stack.push(entry);
  $('.backdrop', wrap).onclick = () => goBack();
  if (bind) bind($('.sheet', wrap), entry);
  raf2(() => wrap.classList.add('in'));
  return entry;
}
function closeSheet(entry) {
  const i = stack.indexOf(entry); if (i >= 0) stack.splice(i, 1);
  entry.el.classList.remove('in'); setTimeout(() => { entry.el.remove(); flushRender(); }, 360);
}
function ask(title, msg, yesLabel, yes) {
  openSheet(`<h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="row"><div><button class="btn line full tap" data-n>Cancel</button></div><div><button class="btn full tap" data-y>${esc(yesLabel)}</button></div></div>`, (s, e) => {
    $('[data-n]', s).onclick = () => e.close();
    $('[data-y]', s).onclick = () => { e.close(); setTimeout(yes, 120); };
  });
}
function goBack() {
  if ($('#login') && !$('#login').classList.contains('hid')) return exitApp();
  const top = stack[stack.length - 1];
  if (top) return top.close();
  if (mod === 'home') return exitApp();
  if (tab !== MODS()[mod].tabs[0][0]) return switchTab(MODS()[mod].tabs[0][0]);
  goHome();
}

/* ---------- modules, home and tabs ---------- */
let mod = 'home', tab = 'invoices', filter = 'all';
const MODS = () => ({
  invoice: { tabs: [['invoices', 'Documents', ICON.receipt], ['products', 'Products', ICON.box], ['settings', 'Settings', ICON.gear]], views: { invoices: tDocs, products: tProducts, settings: tSettings } },
  projects: { tabs: P.tabs, views: P.views },
  tasks: { tabs: T.tabs, views: T.views }
});
function setShell() { $('#app').className = 'm-' + mod + (mod === 'home' ? ' home' : ''); }
function openMod(m, t) { mod = m; tab = t || MODS()[m].tabs[0][0]; setShell(); drawNav(); renderTab(); }
function goHome() { mod = 'home'; setShell(); drawNav(); renderTab(); }
function drawSide() {
  const M = MODS(), on = (m, t) => mod === m && (t === undefined || tab === t) ? 'on' : '';
  $('#side').innerHTML = `<div class="sb-brand"><span class="logo">C</span><b>CorpoMerch</b></div>
    <button class="sb tap ${on('home')}" data-sm="home">${ICON.house}Home</button>
    ${[['invoice', 'Invoice Generator'], ['projects', 'Projects'], ['tasks', 'Task Manager']].map(([m, n]) => `<div class="sb-h">${n}</div>${M[m].tabs.map(([k, l, ic]) => `<button class="sb tap ${on(m, k)}" data-sm="${m}" data-st="${k}">${ic}${l}</button>`).join('')}`).join('')}
    <div class="sb-h">Finance Manager</div><button class="sb tap soon" data-sm="finance">${ICON.wallet}Coming soon</button><div class="sbfoot">${pillHTML()}</div>`;
  $('#side').onclick = e => {
    if (e.target.closest('[data-acc]')) return openAccount();
    const b = e.target.closest('[data-sm]'); if (!b) return;
    const m = b.dataset.sm; if (m === 'finance') return toast('Finance Manager is coming soon');
    if (m === 'home') { if (mod !== 'home') goHome(); return; }
    if (mod === m && tab === b.dataset.st) return;
    if (stack.length) return toast('Save or close the open window first');
    openMod(m, b.dataset.st);
  };
}
function drawNav() {
  drawSide();
  const nav = $('#nav');
  if (mod === 'home') { nav.innerHTML = ''; return; }
  nav.innerHTML = MODS()[mod].tabs.map(([k, l, ic]) => `<button class="${tab === k ? 'on' : ''}" data-t="${k}">${ic}<span>${l}</span></button>`).join('');
  nav.onclick = e => { const b = e.target.closest('[data-t]'); if (b && b.dataset.t !== tab) switchTab(b.dataset.t); };
}
function switchTab(t) { tab = t; drawNav(); renderTab(); }
function renderTab() {
  $('#app > .fab')?.remove();
  const v = $('#tabview'); v.scrollTop = 0;
  if (mod === 'home') { v.innerHTML = '<div class="view"></div>'; return tHome($('.view', v)); }
  v.innerHTML = `<div class="view"><div class="mbar"><button class="homebtn tap">${ICON.home}Home</button></div><div class="mc"></div></div>`;
  $('.homebtn', v).onclick = () => goHome();
  $('.mc', v).dataset.tab = tab;
  MODS()[mod].views[tab]($('.mc', v));
}
function tHome(v) {
  const s = T.summary(), ps = P.summary(), unpaid = db.invoices.filter(x => !isQ(x) && x.status !== 'paid'), unpaidAmt = unpaid.reduce((a, x) => a + total(x), 0);
  const h = new Date().getHours(), greet = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const meP = db.people.find(p => p.id === db.settings.me), dt = new Date();
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  v.innerHTML = `<div class="hh"><div><small>${days[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]}</small><h1>${greet}${meP ? ', ' + esc(meP.name.split(' ')[0]) : ''}</h1></div>${pillHTML()}</div>
  <div class="stats">
    <button class="tap" data-g="today"><small>Tasks today</small><b>${s.today}</b></button>
    <button class="tap ${s.over ? 'bad' : ''}" data-g="over"><small>Overdue</small><b>${s.over}</b></button>
    <button class="tap ${unpaid.length ? 'bad' : ''}" data-g="unpaid"><small>Unpaid</small><b>${fmtComma(unpaidAmt)}<em> Tk</em></b></button>
  </div>
  <div class="secth"><span>Your apps</span></div>
  <div class="tiles">
    <button class="tile tap" data-m="invoice" style="animation-delay:40ms"><span class="ti" style="background:#fdeceb;color:#d22329">${ICON.receipt}</span><span class="tz"><b>Invoice Generator</b><small>${db.invoices.length} document${db.invoices.length === 1 ? '' : 's'}${unpaid.length ? ` · ${unpaid.length} unpaid` : ''}</small></span></button>
    <button class="tile tap" data-m="projects" style="animation-delay:65ms"><span class="ti" style="background:#e3f6f9;color:#0c8599">${ICON.calc}</span><span class="tz"><b>Projects</b><small>${ps.n} active${ps.n ? ` · ${fmtComma(ps.profit)} Tk expected profit` : ''}</small></span></button>
    <button class="tile tap" data-m="tasks" style="animation-delay:90ms"><span class="ti" style="background:#eaeefc;color:#3b5bdb">${ICON.tasks}</span><span class="tz"><b>Task Manager</b><small>${s.open} open task${s.open === 1 ? '' : 's'}${s.long ? ` · ${s.long} long term` : ''}</small></span></button>
    <button class="tile tap soon" data-m="finance" style="animation-delay:115ms"><span class="ti" style="background:#e6f4ea;color:#2b8a3e">${ICON.wallet}</span><span class="tz"><b>Finance Manager</b><small>Coming soon</small></span></button>
  </div>`;
  v.onclick = e => {
    if (e.target.closest('[data-acc]')) return openAccount();
    const m = e.target.closest('[data-m]'), g = e.target.closest('[data-g]');
    if (m) { if (m.dataset.m === 'finance') return toast('Finance Manager is coming soon'); return openMod(m.dataset.m); }
    if (!g) return;
    if (g.dataset.g === 'unpaid') { filter = 'invoice'; return openMod('invoice', 'invoices'); }
    T.setWho('all'); openMod('tasks', 'daily');
  };
}

/* ---------- documents tab ---------- */
function quoteSource() {
  const n = db.projects.filter(p => p.items.length).length;
  openSheet(`<h3>New quotation</h3><p>Where should the items come from?</p>
    <div class="pick tap" data-k="scratch"><div><b>From scratch</b><span>${db.drafts.quotation ? 'Continue your draft, or start fresh.' : 'Pick products and type the prices yourself.'}</span></div>${ICON.chev.replace('<svg', '<svg width="20" height="20"')}</div>
    <div class="pick tap" data-k="project"><div><b>From a recorded project</b><span>${n ? n + ' project' + (n === 1 ? '' : 's') + '. Cost plus your margin fills the prices.' : 'No projects yet. Cost a job in Projects first.'}</span></div>${ICON.chev.replace('<svg', '<svg width="20" height="20"')}</div>`,
    (s, e) => s.onclick = ev => {
      const k = ev.target.closest('[data-k]'); if (!k) return; e.close();
      if (k.dataset.k === 'scratch') return setTimeout(() => startNew('quotation'), 120);
      setTimeout(() => n ? pickProject() : openMod('projects', 'list'), 120);
    });
}
function pickProject() {
  const list = db.projects.filter(p => p.items.length).sort((a, b) => (b.created || '').localeCompare(a.created || ''));
  openSheet(`<h3>Choose a project</h3><div class="plist">${list.map(p => { const c = P.calc(p); return `<div class="pick tap" data-p="${p.id}"><div><b>${esc(p.name || 'Untitled project')}</b><span>${esc(p.client || 'No client')} · ${P.money(c.price)} Tk${p.quoted ? ' · quoted as ' + esc(p.quoted.no) : ''}</span></div></div>`; }).join('')}</div>`,
    (s, e) => s.onclick = ev => {
      const x = ev.target.closest('[data-p]'); if (!x) return; const p = db.projects.find(y => y.id === x.dataset.p);
      if (P.calc(p).rows.some(r => r.tot <= 0)) { e.close(); toast('That project has products without quantity or costs'); return setTimeout(() => P.openEditor(p), 300); }
      e.close(); setTimeout(() => quoteFrom(p.id), 150);
    });
}
function quoteFrom(id) {
  const p = db.projects.find(x => x.id === id); if (!p) return;
  const w = newDoc('quotation'); w.customer = p.client || p.name; w.items = P.toDocItems(p); w.projectId = p.id;
  S.syncNow(); openEditor(w, true);
}
function startNew(type) { S.syncNow(); openEditor(db.drafts[type] ? clone(db.drafts[type]) : newDoc(type), true); }
function tDocs(v) {
  const all = db.invoices, invs = all.filter(x => !isQ(x)), due = invs.filter(x => x.status !== 'paid');
  const list = filter === 'all' ? all : all.filter(x => isQ(x) === (filter === 'quotation'));
  v.innerHTML = `<div class="lt"><h1>Documents</h1></div>
  <div class="sum"><div><small>Total invoiced</small><b>${fmtComma(invs.reduce((s, x) => s + total(x), 0))} Tk</b></div><div class="due"><small>Unpaid</small><b>${fmtComma(due.reduce((s, x) => s + total(x), 0))} Tk</b></div></div>
  <div class="seg">${[['all', 'All'], ['invoice', 'Invoices'], ['quotation', 'Quotations']].map(([k, l]) => `<button class="${filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}</div>
  <div id="list">${list.map((x, i) => `
    <div class="card inv tap" data-id="${x.id}" style="animation-delay:${Math.min(i, 8) * 40}ms">
      <div class="top"><div><div class="nm">${esc(x.customer)}</div><div class="meta">${esc(x.no)} · ${longDate(x.date)} · ${x.items.length} item${x.items.length === 1 ? '' : 's'}</div></div>
      <div>${isQ(x) ? '<div style="text-align:right"><span class="pill quote">QUOTATION</span></div>' : `<div class="amt">${fmtComma(total(x))} Tk</div><div style="text-align:right"><button class="pill tap ${x.status}" data-a="st">${x.status === 'paid' ? 'PAID' : 'DUE'}</button></div>`}</div></div>
      <div class="acts"><button class="btn sec sm tap" data-a="pdf">${ICON.eye}PDF</button><button class="btn sec sm tap" data-a="dup">${ICON.copy}Copy</button><button class="btn sec sm tap" data-a="del">${ICON.trash}Delete</button></div>
    </div>`).join('') || `<div class="empty">${all.length ? 'Nothing here.' : 'No documents yet.<br>Tap + to create an invoice or a quotation.'}</div>`}</div>`;
  v.onclick = e => {
    const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; return renderTab(); }
    const c = e.target.closest('[data-id]'); if (!c) return;
    const x = db.invoices.find(y => y.id === c.dataset.id), a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'st') { x.status = x.status === 'paid' ? 'due' : 'paid'; persist(); renderTab(); toast(`${x.no} marked ${x.status === 'paid' ? 'paid' : 'due'}`); }
    else if (a === 'pdf') openPreview(x);
    else if (a === 'dup') { const d = clone(x); d.id = uid(); d.no = docNo(d.type); d.date = todayISO(); d.status = 'due'; openEditor(d, true); }
    else if (a === 'del') ask('Delete ' + (isQ(x) ? 'quotation' : 'invoice') + '?', `${x.no} for ${x.customer} will be removed.`, 'Delete', () => { db.invoices = db.invoices.filter(y => y !== x); persist(); renderTab(); toast('Deleted'); });
    else openEditor(clone(x), false);
  };
  const fab = document.createElement('button'); fab.className = 'fab tap'; fab.innerHTML = ICON.plus; fab.setAttribute('aria-label', 'New document');
  fab.onclick = () => openSheet(`<h3>Create new</h3><p>What do you want to make?</p>
    <div class="pick tap" data-k="invoice"><div><b>Invoice</b><span>With totals. ${db.drafts.invoice ? 'Continue your draft.' : 'Next: ' + docNo('invoice')}</span></div>${ICON.chev.replace('<svg', '<svg width="20" height="20"')}</div>
    <div class="pick tap" data-k="quotation"><div><b>Quotation</b><span>Prices for a client, with optional product gallery. ${db.drafts.quotation ? 'Continue your draft.' : 'Next: ' + docNo('quotation')}</span></div>${ICON.chev.replace('<svg', '<svg width="20" height="20"')}</div>`,
    (s, e) => s.onclick = ev => { const k = ev.target.closest('[data-k]'); if (k) { e.close(); setTimeout(() => k.dataset.k === 'quotation' ? quoteSource() : startNew(k.dataset.k), 120); } });
  $('#app').appendChild(fab);
}

/* ---------- editor ---------- */
function recalc(it) {
  if (!it.flat && it.qty !== '' && it.price !== '') { it.total = fmt(num(it.qty) * num(it.price)); return true; }
  return false;
}
function itemHTML(it, i, q) {
  return `<div class="card it ${it.flat ? 'flat' : ''}" data-id="${it.id}">
    <div class="ih"><b>Item <span class="n">${i + 1}</span></b><span><button class="ib gray tap" data-a="up">${ICON.up}</button><button class="ib gray tap" data-a="dn">${ICON.down}</button><button class="ib danger tap" data-a="del">${ICON.trash}</button></span></div>
    <label class="l">Product name (bold)</label><input data-f="name" value="${esc(it.name)}" placeholder="e.g. Coupon">
    <label class="l" style="margin-top:10px">Description (optional)</label><textarea data-f="desc" rows="1">${esc(it.desc)}</textarea>
    <div class="row qrow" style="margin-top:10px">
      <div><label class="l">Qty</label><input data-f="qty" inputmode="decimal" value="${esc(it.qty)}"></div>
      <div><label class="l">Unit</label><input data-f="unit" value="${esc(it.unit)}" placeholder="Pcs"></div>
      <div><label class="l">Price</label><div class="sfx"><input data-f="price" inputmode="decimal" value="${esc(it.price)}"><i>Tk</i></div></div>
    </div>
    <div class="totrow" style="margin-top:10px"><label class="l">${q ? 'Amount (Tk)' : 'Total (Tk)'}</label><input data-f="total" inputmode="decimal" value="${esc(it.total)}"></div>
    <label class="sw"><input type="checkbox" data-f="flat" ${it.flat ? 'checked' : ''}>Flat amount (no qty or price)</label>
  </div>`;
}
const autosize = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 4 + 'px'; };
const galleryProducts = () => db.products.filter(p => p.hasImg && imgs[p.id]);

function openEditor(w, isNew) {
  const q = isQ(w), word = q ? 'quotation' : 'invoice';
  if (!w.gallery) w.gallery = { on: false, ids: [] };
  const snap = JSON.stringify(w);
  const hasContent = () => w.customer.trim() || w.items.length;
  const keepDraft = () => { if (isNew) { if (hasContent()) db.drafts[w.type] = w; else delete db.drafts[w.type]; persist(); } };
  pushPage({
    cls: q ? 'quote' : '',
    title: isNew ? 'New ' + word : 'Edit ' + w.no,
    beforeClose(entry) {
      if (!isNew && JSON.stringify(w) !== snap) { ask('Discard changes?', `Your edits to this ${word} have not been saved.`, 'Discard', () => closePage(entry)); return false; }
      keepDraft(); return true;
    },
    build(entry) {
      const b = entry.body;
      b.innerHTML = `
      <div class="card"><label class="l">${q ? 'Quotation for' : 'Billing to'}</label><input id="cust" placeholder="Customer name" value="${esc(w.customer)}">
        <div class="row" style="margin-top:12px"><div><label class="l">${q ? 'Quotation no' : 'Invoice no'}</label><input id="no" value="${esc(w.no)}"></div><div><label class="l">Date</label><input id="date" type="date" value="${w.date}"></div></div></div>
      <div class="secth"><span>Items</span></div><div id="items"></div>
      <div class="row"><div><button class="btn sec full tap" id="addp">${ICON.box}From products</button></div><div><button class="btn sec full tap" id="addc">${ICON.plus}Custom line</button></div></div>
      ${q ? `<div class="secth" style="margin-top:20px"><span>Product gallery</span></div>
      <div class="card"><label class="sw" style="margin:0"><input type="checkbox" id="gon" ${w.gallery.on ? 'checked' : ''}>Add a product gallery page after the quotation</label>
        <div id="gbody" class="${w.gallery.on ? '' : 'hid'}"><div class="thumbs" id="thumbs"></div><button class="btn sec full tap" id="gpick">${ICON.image}Choose products</button></div></div>` : ''}`;
      entry.foot.classList.remove('hid');
      entry.foot.innerHTML = `<div class="tot"><span>${q ? 'Items' : 'Total'}</span><b id="gt"></b></div><div class="row"><div><button class="btn line full tap" id="save">${ICON.check}Save</button></div><div><button class="btn full tap" id="prev">${ICON.eye}Preview PDF</button></div></div>`;
      const list = $('#items', b);
      const upd = () => { $('#gt', entry.foot).textContent = q ? String(w.items.length) : fmtComma(total(w)) + ' Tk'; keepDraft(); };
      const renumber = () => list.querySelectorAll('.it .n').forEach((n, i) => n.textContent = i + 1);
      const draw = () => { list.innerHTML = w.items.map((it, i) => itemHTML(it, i, q)).join(''); list.querySelectorAll('textarea').forEach(autosize); };
      const addItem = it => {
        w.items.push(it); const t = document.createElement('div'); t.innerHTML = itemHTML(it, w.items.length - 1, q);
        const card = t.firstElementChild; list.appendChild(card); autosize($('textarea', card)); upd();
        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
      };
      draw(); upd();
      $('#cust', b).oninput = e => { w.customer = e.target.value; keepDraft(); };
      $('#no', b).oninput = e => { w.no = e.target.value; keepDraft(); };
      $('#date', b).oninput = e => { w.date = e.target.value || todayISO(); keepDraft(); };
      $('#addc', b).onclick = () => addItem({ id: uid(), name: '', desc: '', qty: '', unit: '', price: '', total: '', flat: false });
      $('#addp', b).onclick = () => openSheet(`<h3>Add product</h3><p>Tap a product to add it. You can edit everything afterwards.</p>` +
        (db.products.map(p => `<div class="pick tap" data-p="${p.id}"><div><b>${esc(p.name)}</b><span>${p.flat ? 'Flat ' : ''}${p.price !== '' ? fmt(p.price) + ' Tk' : ''}${p.unit && !p.flat ? ' / ' + esc(p.unit) : ''}</span></div>${ICON.plus.replace('<svg', '<svg width="22" height="22"')}</div>`).join('') || '<p>No products yet. Add some in the Products tab.</p>'),
        (s, e) => s.onclick = ev => {
          const p = ev.target.closest('[data-p]'); if (!p) return;
          const pr = db.products.find(x => x.id === p.dataset.p);
          e.close();
          addItem(pr.flat ? { id: uid(), name: pr.name, desc: pr.desc || '', qty: '', unit: '', price: '', total: pr.price === '' ? '' : fmt(pr.price), flat: true }
            : { id: uid(), name: pr.name, desc: pr.desc || '', qty: '1', unit: pr.unit, price: pr.price === '' ? '' : fmt(pr.price), total: pr.price === '' ? '' : fmt(pr.price), flat: false });
        });
      const find = el => { const c = el.closest('[data-id]'); return c && { c, it: w.items.find(x => x.id === c.dataset.id) }; };
      list.addEventListener('input', e => {
        const r = find(e.target), f = e.target.dataset.f; if (!r || !f || f === 'flat') return;
        r.it[f] = e.target.value;
        if (f === 'desc') autosize(e.target);
        if ((f === 'qty' || f === 'price') && recalc(r.it)) $('[data-f=total]', r.c).value = r.it.total;
        upd();
      });
      list.addEventListener('change', e => {
        const r = find(e.target); if (!r || e.target.dataset.f !== 'flat') return;
        r.it.flat = e.target.checked; r.c.classList.toggle('flat', r.it.flat);
        if (r.it.flat) { r.it.qty = ''; r.it.price = ''; $('[data-f=qty]', r.c).value = ''; $('[data-f=price]', r.c).value = ''; }
        else { recalc(r.it); $('[data-f=total]', r.c).value = r.it.total; }
        upd();
      });
      list.addEventListener('click', e => {
        const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
        const r = find(e.target), i = w.items.indexOf(r.it);
        if (a === 'del') {
          r.c.style.maxHeight = r.c.offsetHeight + 'px'; void r.c.offsetHeight; r.c.classList.add('removing');
          w.items.splice(i, 1); upd(); setTimeout(() => { r.c.remove(); renumber(); }, 280);
        } else {
          const j = a === 'up' ? i - 1 : i + 1; if (j < 0 || j >= w.items.length) return;
          [w.items[i], w.items[j]] = [w.items[j], w.items[i]]; draw(); upd();
        }
      });
      if (q) {
        const thumbs = () => {
          const ps = w.gallery.ids.map(id => db.products.find(p => p.id === id)).filter(p => p && imgs[p.id]);
          $('#thumbs', b).innerHTML = ps.map(p => `<img src="${imgs[p.id]}" alt="${esc(p.name)}">`).join('') || '<span class="hint" style="margin:0">No products selected yet.</span>';
        };
        thumbs();
        $('#gon', b).onchange = e => { w.gallery.on = e.target.checked; $('#gbody', b).classList.toggle('hid', !w.gallery.on); keepDraft(); };
        $('#gpick', b).onclick = () => {
          const ps = galleryProducts(), sel = new Set(w.gallery.ids);
          openSheet(`<h3>Gallery products</h3><p>Tick the products to show on the gallery page.</p>` +
            (ps.map(p => `<div class="pick tap ${sel.has(p.id) ? 'sel' : ''}" data-p="${p.id}"><div class="pk"><img src="${imgs[p.id]}" alt=""><b>${esc(p.name)}</b></div><span class="ck">${ICON.check}</span></div>`).join('') || '<p>No product photos yet. Open the Products tab, edit a product and add a photo.</p>') +
            `<button class="btn full tap" id="gdone" style="margin-top:6px">Done</button>`,
            (s, e) => {
              s.onclick = ev => { const p = ev.target.closest('[data-p]'); if (!p) return; const id = p.dataset.p; sel.has(id) ? sel.delete(id) : sel.add(id); p.classList.toggle('sel', sel.has(id)); };
              $('#gdone', s).onclick = () => { w.gallery.ids = db.products.filter(p => sel.has(p.id)).map(p => p.id); thumbs(); keepDraft(); e.close(); };
            });
        };
      }
      const valid = () => {
        if (!w.customer.trim()) { toast('Enter the customer name'); $('#cust', b).focus(); return false; }
        if (!w.items.length) { toast('Add at least one item'); return false; }
        return true;
      };
      $('#prev', entry.foot).onclick = () => { if (valid()) openPreview(w); };
      $('#save', entry.foot).onclick = () => {
        if (!valid()) return;
        const i = db.invoices.findIndex(x => x.id === w.id);
        let note = '';
        if (i >= 0) db.invoices[i] = clone(w); else {
          const clash = x => x.no === w.no && isQ(x) === q;
          if (db.invoices.some(clash)) {   // a partner already used this number: take the next free one
            const mm = w.no.match(/^(.*?)(\d+)$/);
            if (mm) { let k = parseInt(mm[2]); const old = w.no; do { k++; w.no = mm[1] + String(k).padStart(mm[2].length, '0'); } while (db.invoices.some(clash)); note = `${old} was already used, saved as ${w.no}`; }
          }
          db.invoices.unshift(clone(w));
          const m = w.no.match(/^(.*?)(\d+)$/), pre = q ? db.settings.qprefix : db.settings.prefix, key = q ? 'qnext' : 'next';
          if (m && m[1] === pre && parseInt(m[2]) >= db.settings[key]) db.settings[key] = parseInt(m[2]) + 1;
        }
        if (isNew) delete db.drafts[w.type];
        if (i < 0 && w.projectId) P.markQuoted(w);
        persist(); closePage(entry); tab = 'invoices'; drawNav(); renderTab(); toast(note || (q ? 'Quotation saved' : 'Invoice saved'));
      };
    }
  });
}

/* ---------- drawing (sample layout, coordinates 1313 x 1857) ---------- */
const RED = '#d22329', BW = 1313, BH = 1857;
const FONT = 'Inter, Arial, sans-serif';
const within = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);
const loadFonts = () => within(Promise.all(['400', '600', '700'].map(w => document.fonts.load(`${w} 30px Inter`).catch(() => {}))), 3000);
const imgEls = {};
async function loadGalleryImgs(inv) {
  if (!isQ(inv) || !inv.gallery?.on) return;
  await Promise.all(inv.gallery.ids.map(id => new Promise(res => {
    if (!imgs[id] || imgEls[id]?.src === imgs[id]) return res();
    const im = new Image(); im.onload = () => { imgEls[id] = im; res(); }; im.onerror = res; setTimeout(res, 4000); im.src = imgs[id];
  })));
}
function wrap(ctx, text, maxW) {
  const out = [];
  String(text).split('\n').forEach(par => {
    let line = '';
    par.split(' ').forEach(wd => {
      const t = line ? line + ' ' + wd : wd;
      if (ctx.measureText(t).width > maxW && line) { out.push(line); line = wd; } else line = t;
    });
    out.push(line);
  });
  return out;
}
const NAME_PX = 34, NAME_LH = 46, DESC_PX = 28, DESC_LH = 39;
function paginate(inv) {
  const q = isQ(inv), ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `400 30px ${FONT}`;
  const rows = inv.items.map((it, i) => {
    const w = it.flat ? 860 : 445;
    ctx.font = `700 ${NAME_PX}px ${FONT}`; const nl = it.name ? wrap(ctx, it.name, w) : [];
    ctx.font = `400 ${DESC_PX}px ${FONT}`; const dl = it.desc ? wrap(ctx, it.desc, w) : [];
    const bh = nl.length * NAME_LH + dl.length * DESC_LH + (nl.length && dl.length ? 4 : 0);
    return { it, i, nl, dl, bh, h: Math.max(80, bh + 40) };
  });
  const pages = [{ kind: 'doc', rows: [] }]; let y = 592;
  rows.forEach(r => { if (y + r.h > 1640) { pages.push({ kind: 'doc', rows: [] }); y = 180; } pages[pages.length - 1].rows.push(r); y += r.h; });
  if (!q && y + 78 > 1640) pages.push({ kind: 'doc', rows: [] });
  if (q && inv.gallery?.on) {
    const items = inv.gallery.ids.map(id => db.products.find(p => p.id === id)).filter(p => p && imgs[p.id]);
    for (let i = 0; i < items.length; i += 6) pages.push({ kind: 'gallery', items: items.slice(i, i + 6) });
  }
  return pages;
}
function drawFooter(c) {
  c.fillStyle = RED; c.fillRect(0, 1697, BW, 160);
  c.fillStyle = '#fff'; c.font = `400 28px ${FONT}`;
  c.fillText(db.settings.email, 110, 1762); c.fillText(db.settings.phone, 110, 1806);
  db.settings.address.split('\n').slice(0, 2).forEach((l, k) => c.fillText(l, 631, 1762 + k * 40));
}
function drawGallery(c, pg) {
  c.textAlign = 'center'; c.fillStyle = RED; c.font = `700 70px ${FONT}`; c.fillText('CorpoMerch', BW / 2, 160);
  c.textAlign = 'left'; c.fillStyle = '#000';
  c.beginPath(); c.arc(160, 316, 9, 0, 7); c.fill();
  c.font = `400 52px ${FONT}`; c.fillText('Product Gallery', 190, 332);
  const cw = (1223 - 87) / 3;
  pg.items.forEach((p, k) => {
    const col = k % 3, row = Math.floor(k / 3), cx = 87 + cw * col + cw / 2, top = 470 + row * 480;
    const im = imgEls[p.id];
    if (im) {
      const s = Math.min(340 / im.width, 300 / im.height), w = im.width * s, h = im.height * s;
      c.imageSmoothingQuality = 'high'; c.drawImage(im, cx - w / 2, top + (300 - h) / 2, w, h);
    }
    c.textAlign = 'center'; c.fillStyle = '#000'; c.font = `400 36px ${FONT}`;
    wrap(c, p.name, 340).slice(0, 2).forEach((l, i) => c.fillText(l, cx, top + 365 + i * 46));
    c.textAlign = 'left';
  });
  drawFooter(c);
}
function drawPage(inv, pages, pi, widthPx) {
  const sc = widthPx / BW, cv = document.createElement('canvas');
  cv.width = widthPx; cv.height = Math.round(BH * sc);
  const c = cv.getContext('2d');
  c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height);
  c.scale(sc, sc); c.textBaseline = 'alphabetic';
  const pg = pages[pi];
  if (pg.kind === 'gallery') { drawGallery(c, pg); return cv; }
  const q = isQ(inv), docCount = pages.filter(p => p.kind === 'doc').length;
  const lastDoc = pages.map(p => p.kind).lastIndexOf('doc');
  const rows = pg.rows; let y;
  if (pi === 0) {
    c.fillStyle = RED; c.font = `700 62px ${FONT}`; c.fillText('CorpoMerch', 90, 145);
    c.fillStyle = '#000'; c.font = `400 32px ${FONT}`; c.fillText(q ? 'Quotation For' : 'Billing To', 97, 262);
    c.font = `700 38px ${FONT}`; c.fillText(inv.customer, 97, 322, 540);
    c.strokeStyle = RED; c.lineWidth = 2.5; c.setLineDash([8, 6]);
    c.beginPath(); if (c.roundRect) c.roundRect(684, 211, 497, 200, 22); else c.rect(684, 211, 497, 200); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#000'; c.font = `700 33px ${FONT}`; c.fillText(q ? 'Quotation' : 'Invoice', 722, 262);
    c.font = `400 32px ${FONT}`; c.fillText((q ? 'Quotation No: ' : 'Invoice No: ') + inv.no, 722, 316); c.fillText('Date: ' + longDate(inv.date), 722, 369);
    y = 512;
  } else y = 100;
  const cols = [87, 148, 617, 811, 1035, 1223];
  c.fillStyle = RED; c.fillRect(87, y, 1136, 80);
  c.fillStyle = '#fff'; c.font = `400 32px ${FONT}`; c.fillText('Sl', 101, y + 51);
  c.font = `600 32px ${FONT}`;
  const heads = ['Item Description', 'Qty', 'Price', 'Total'];
  heads.forEach((h, k) => c.fillText(h, cols[k + 1] + 13, y + 51));
  c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(87, y, 1136, 80);
  cols.slice(1, -1).forEach(x => { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 80); c.stroke(); });
  y += 80;
  rows.forEach(r => {
    const it = r.it;
    c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(87, y, 1136, r.h);
    const lines = it.flat ? [148, 1035] : [148, 617, 811, 1035];
    lines.forEach(x => { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + r.h); c.stroke(); });
    c.fillStyle = '#000'; c.font = `400 30px ${FONT}`;
    const cy = y + r.h / 2;
    c.fillText((r.i + 1) + '.', 101, cy + 10);
    let ty = cy - r.bh / 2;
    c.font = `700 ${NAME_PX}px ${FONT}`;
    r.nl.forEach(l => { c.fillText(l, 161, ty + NAME_LH * 0.74); ty += NAME_LH; });
    if (r.nl.length && r.dl.length) ty += 4;
    c.font = `400 ${DESC_PX}px ${FONT}`;
    r.dl.forEach(l => { c.fillText(l, 161, ty + DESC_LH * 0.74); ty += DESC_LH; });
    c.font = `400 30px ${FONT}`;
    if (!it.flat) {
      if (it.qty !== '') c.fillText(fmt(num(it.qty)) + (it.unit ? ' ' + it.unit : ''), 631, cy + 10, 170);
      if (it.price !== '') c.fillText(fmt(num(it.price)) + ' Tk', 825, cy + 10, 200);
    }
    if (!q || (it.total !== '' && it.total != null)) c.fillText(fmt(num(it.total)) + ' Tk', 1049, cy + 10, 170);
    y += r.h;
  });
  if (!q && pi === lastDoc) {
    c.strokeStyle = '#000'; c.lineWidth = 2; c.strokeRect(87, y, 1136, 78);
    c.beginPath(); c.moveTo(1035, y); c.lineTo(1035, y + 78); c.stroke();
    c.fillStyle = '#000'; c.font = `400 30px ${FONT}`; c.fillText('Total', 101, y + 50); c.fillText(fmtComma(total(inv)) + ' Tk', 1049, y + 50, 170);
  }
  drawFooter(c);
  if (docCount > 1) { c.fillStyle = '#fff'; c.font = `400 22px ${FONT}`; c.fillText(`Page ${pi + 1} of ${docCount}`, 1100, 1840); }
  return cv;
}

/* ---------- PDF: 300 dpi A4 pages (2480 x 3508) inside a hand-built PDF ---------- */
async function buildPDF(inv) {
  await loadFonts(); await loadGalleryImgs(inv);
  const pages = paginate(inv), enc = new TextEncoder(), parts = [], offs = []; let len = 0;
  const push = b => { if (typeof b === 'string') b = enc.encode(b); parts.push(b); len += b.length; };
  const W = 595.28, H = 841.89, n = pages.length;
  push('%PDF-1.4\n');
  const obj = (id, body, stream) => { offs[id] = len; push(`${id} 0 obj\n${body}`); if (stream) { push('\nstream\n'); push(stream); push('\nendstream'); } push('\nendobj\n'); };
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  const objs = [];
  for (let i = 0; i < n; i++) {
    const cv = drawPage(inv, pages, i, 2480);
    let blob = await within(new Promise(r => cv.toBlob(r, 'image/jpeg', 0.95)), 15000), bytes;
    if (blob) bytes = new Uint8Array(await blob.arrayBuffer());
    else { const bin = atob(cv.toDataURL('image/jpeg', 0.92).split(',')[1]); bytes = Uint8Array.from(bin, ch => ch.charCodeAt(0)); }
    objs.push({ bytes, w: cv.width, h: cv.height });
    cv.width = cv.height = 1;
  }
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Kids [${kids}] /Count ${n} >>`);
  objs.forEach((o, i) => {
    const p = 3 + i * 3, content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
    obj(p, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${p + 1} 0 R >> >> /Contents ${p + 2} 0 R >>`);
    obj(p + 1, `<< /Type /XObject /Subtype /Image /Width ${o.w} /Height ${o.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${o.bytes.length} >>`, o.bytes);
    obj(p + 2, `<< /Length ${content.length} >>`, content);
  });
  const cnt = 3 + n * 3, xref = len;
  push(`xref\n0 ${cnt}\n0000000000 65535 f \n`);
  for (let i = 1; i < cnt; i++) push(String(offs[i]).padStart(10, '0') + ' 00000 n \n');
  push(`trailer\n<< /Size ${cnt} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len); let p = 0;
  parts.forEach(a => { out.set(a, p); p += a.length; });
  return out;
}
const fileName = inv => `${isQ(inv) ? 'Quotation' : 'Invoice'}_${inv.customer.trim().replace(/[^\w]+/g, '_') || 'Customer'}_CorpoMerch_${inv.no}.pdf`;

function openPreview(inv) {
  const snap = clone(inv);
  pushPage({
    title: 'Preview ' + snap.no,
    build(entry) {
      entry.body.innerHTML = '<div class="spin"></div>';
      entry.foot.classList.remove('hid');
      entry.foot.innerHTML = `<button class="btn full tap" id="sh">${ICON.share}Share / Save PDF</button>`;
      const fail = m => {
        if (!entry.el.isConnected || entry.body.querySelector('.pv')) return;
        entry.body.innerHTML = `<div class="empty">Could not draw the preview.<br><small>${esc(m)}</small><br><button class="btn sm tap" id="rt" style="margin-top:12px">Try again</button></div>`;
        $('#rt', entry.body).onclick = () => { entry.body.innerHTML = '<div class="spin"></div>'; show(); };
      };
      const stage = t => { if (entry.el.isConnected && !entry.body.querySelector('.pv')) entry.body.innerHTML = `<div class="spin"></div><p style="text-align:center;color:#8a8a8f;font-size:12px;margin-top:14px">v1.8 · ${esc(t)}</p>`; };
      const tick = () => new Promise(r => setTimeout(r, 30));
      const show = async () => {
        const timer = setTimeout(() => fail('This is taking too long.'), 20000);
        try {
          stage('loading fonts'); await tick(); await loadFonts();
          stage('loading photos'); await tick(); await loadGalleryImgs(snap);
          if (!entry.el.isConnected) return;
          stage('laying out'); await tick(); const pages = paginate(snap), urls = [];
          for (let i = 0; i < pages.length; i++) { stage(`drawing page ${i + 1} of ${pages.length}`); await tick(); urls.push(drawPage(snap, pages, i, 1100).toDataURL('image/jpeg', 0.9)); }
          if (!entry.el.isConnected) return;
          entry.body.innerHTML = urls.map((u, i) => `<div class="pv" style="animation-delay:${i * 80}ms"><img alt="Page ${i + 1}" src="${u}"></div>`).join('');
        } catch (e) { fail(String(e && e.message || e)); }
        clearTimeout(timer);
      };
      show();
      let busy = false;
      $('#sh', entry.foot).onclick = async () => {
        if (busy) return; busy = true;
        const btn = $('#sh', entry.foot); btn.style.opacity = .6; toast('Creating PDF...');
        try { await sharePDF(await buildPDF(snap), fileName(snap)); }
        catch (e) { if (!/cancel|abort/i.test(String(e && (e.message || e)))) toast('Could not make the PDF: ' + String(e && (e.message || e)).slice(0, 80)); }
        busy = false; btn.style.opacity = 1;
      };
    }
  });
}

/* ---------- products ---------- */
function resizeImage(file, max = 900) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      const s = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
      c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height);
      URL.revokeObjectURL(u); res(c.toDataURL('image/jpeg', 0.85));
    };
    im.onerror = () => { URL.revokeObjectURL(u); rej(new Error('bad image')); };
    im.src = u;
  });
}
function tProducts(v) {
  v.innerHTML = `<div class="lt"><h1>Products</h1><button class="btn sm tap" id="np">${ICON.plus}New</button></div>` +
    (db.products.map((p, i) => `<div class="card prod tap" data-id="${p.id}" style="animation-delay:${Math.min(i, 8) * 40}ms">${imgs[p.id] ? `<img class="th" src="${imgs[p.id]}" alt="">` : `<span class="th ph">${ICON.image}</span>`}<div class="t"><b>${esc(p.name)}</b><small>${esc(p.desc)}</small><small>${p.flat ? 'Flat ' : ''}${p.price !== '' ? fmt(p.price) + ' Tk' : 'No price'}${p.unit && !p.flat ? ' / ' + esc(p.unit) : ''}</small></div>${ICON.chev}</div>`).join('') || '<div class="empty">No products yet.</div>');
  $('#np', v).onclick = () => editProduct();
  v.onclick = e => { const c = e.target.closest('[data-id]'); if (c) editProduct(db.products.find(x => x.id === c.dataset.id)); };
}
function editProduct(p) {
  const n = p ? clone(p) : { id: uid(), name: '', desc: '', price: '', unit: 'Pcs', flat: false };
  let pending;  // undefined = unchanged, string = new photo, null = removed
  pushPage({
    title: p ? 'Edit product' : 'New product',
    build(entry) {
      const b = entry.body;
      b.innerHTML = `<div class="card"><label class="l">Photo (used in quotation galleries)</label>
        <div class="imgbox" id="ib"></div>
        <div class="row" style="margin-top:10px"><div><label class="btn sec full tap" for="pfile" style="margin:0">${ICON.image}<span id="pl">Choose photo</span></label></div><div id="prm" class="hid"><button class="btn sec full tap" id="pr">${ICON.trash}Remove</button></div></div>
        <input type="file" id="pfile" accept="image/*" class="hid"></div>
      <div class="card"><label class="l">Name (shown under the photo)</label><input id="pn" value="${esc(n.name)}" placeholder="e.g. Business Card Holder">
      <div class="gap"></div><label class="l">Description (optional, printed under the name)</label><textarea id="pd">${esc(n.desc)}</textarea>
      <div class="row" style="margin-top:10px"><div><label class="l">Default price (Tk)</label><input id="pp" inputmode="decimal" value="${esc(n.price)}"></div><div><label class="l">Unit</label><input id="pu" value="${esc(n.unit)}" placeholder="Pcs"></div></div>
      <label class="sw"><input type="checkbox" id="pf" ${n.flat ? 'checked' : ''}>Flat amount (like a charge)</label></div>
      ${p ? `<button class="btn sec full tap" id="pdl">${ICON.trash}Delete product</button>` : ''}`;
      const cur = () => pending === undefined ? imgs[n.id] : pending;
      const showImg = () => {
        const s = cur();
        $('#ib', b).innerHTML = s ? `<img src="${s}" alt="">` : `<div class="noimg">${ICON.image}<span>No photo yet</span></div>`;
        $('#prm', b).classList.toggle('hid', !s); $('#pl', b).textContent = s ? 'Change photo' : 'Choose photo';
      };
      showImg();
      $('#pfile', b).onchange = async e => {
        const f = e.target.files[0]; if (!f) return;
        try { pending = await resizeImage(f); showImg(); } catch (err) { toast('Could not read that photo'); }
        e.target.value = '';
      };
      $('#pr', b).onclick = () => { pending = null; showImg(); };
      autosize($('#pd', b)); $('#pd', b).oninput = e => autosize(e.target);
      entry.foot.classList.remove('hid');
      entry.foot.innerHTML = `<button class="btn full tap" id="ps">${ICON.check}Save product</button>`;
      $('#ps', entry.foot).onclick = async () => {
        n.name = $('#pn', b).value.trim(); n.desc = $('#pd', b).value.trim(); n.price = $('#pp', b).value.trim() === '' ? '' : num($('#pp', b).value); n.unit = $('#pu', b).value.trim(); n.flat = $('#pf', b).checked;
        if (!n.name) return toast('Enter a name');
        if (typeof pending === 'string') { imgs[n.id] = pending; n.hasImg = true; n.imgV = Date.now(); await saveImg(n.id, pending); }
        else if (pending === null) { delete imgs[n.id]; n.hasImg = false; n.imgV = Date.now(); await delImg(n.id); }
        if (p) Object.assign(p, n); else db.products.push(n);
        persist(); closePage(entry); renderTab(); toast('Product saved');
      };
      if (p) $('#pdl', b).onclick = () => ask('Delete product?', 'Existing documents are not affected.', 'Delete', () => { db.products = db.products.filter(x => x !== p); delete imgs[p.id]; delImg(p.id); persist(); closePage(entry); renderTab(); });
    }
  });
}

/* ---------- settings ---------- */
function tSettings(v) {
  const s = db.settings;
  v.innerHTML = `<div class="lt"><h1>Settings</h1></div>
  <div class="card"><div class="row"><div><label class="l">Invoice prefix</label><input id="sp" value="${esc(s.prefix)}"></div><div><label class="l">Next invoice no</label><input id="sn" inputmode="numeric" value="${s.next}"></div></div>
  <div class="gap"></div><div class="row"><div><label class="l">Quotation prefix</label><input id="sqp" value="${esc(s.qprefix)}"></div><div><label class="l">Next quotation no</label><input id="sqn" inputmode="numeric" value="${s.qnext}"></div></div>
  <div class="gap"></div><label class="l">Footer email</label><input id="se" value="${esc(s.email)}">
  <div class="gap"></div><label class="l">Footer phone</label><input id="sh" value="${esc(s.phone)}">
  <div class="gap"></div><label class="l">Footer address (2 lines max)</label><textarea id="sa">${esc(s.address)}</textarea></div>
  <button class="btn full tap" id="ss">${ICON.check}Save settings</button>
  <div class="secth" style="margin-top:22px"><span>Backup</span></div>
  <div class="card"><button class="btn sec full tap" id="ex">${ICON.share}${isNative ? 'Share backup' : 'Copy backup'}</button>
  <div class="gap"></div><textarea id="bk" placeholder="Paste a backup here to restore" style="min-height:70px"></textarea>
  <div class="gap"></div><button class="btn line full tap" id="im">Restore from pasted backup</button>
  <p class="hint">Your documents, products and settings are stored inside this app on your phone. Uninstalling the app erases them, so keep a backup (send it to yourself on WhatsApp or save it to a note). Product photos are not included in the backup text because they are too large, so keep the originals.</p></div>`;
  autosize($('#sa', v));
  $('#ss', v).onclick = () => {
    s.prefix = $('#sp', v).value.trim(); s.next = parseInt($('#sn', v).value) || 1; s.qprefix = $('#sqp', v).value.trim(); s.qnext = parseInt($('#sqn', v).value) || 1;
    s.email = $('#se', v).value.trim(); s.phone = $('#sh', v).value.trim(); s.address = $('#sa', v).value.trim();
    persist(); toast('Settings saved');
  };
  $('#ex', v).onclick = async () => { const ok = await shareText(JSON.stringify(db), 'CorpoMerch backup'); if (!isNative) toast(ok ? 'Backup copied' : 'Could not copy'); };
  $('#im', v).onclick = () => {
    let d; try { d = JSON.parse($('#bk', v).value); if (!d.settings || !d.products || !d.invoices) throw 0; } catch (e) { return toast('That is not a valid backup'); }
    ask('Restore backup?', 'This replaces all current documents, products and settings.', 'Restore', () => { db = normalize(d); persist(); renderTab(); toast('Backup restored'); });
  };
}

/* ---------- projects ---------- */
const P = projectsModule({ $, uid, esc, ICON, db: () => db, persist, pushPage, closePage, openSheet, ask, toast, todayISO,
  renderTab: () => renderTab(), quoteFrom: id => quoteFrom(id) });

/* ---------- task manager ---------- */
const T = tasksModule({ $, uid, esc, ICON, I, db: () => db, persist, pushPage, closePage, openSheet, ask, toast, todayISO, shareText, saveImg, loadImg, delImg, resizeImage, autosize, isNative,
  renderTab: () => renderTab(), switchTab: t => switchTab(t), openDoc: id => { const x = db.invoices.find(y => y.id === id); if (x) openEditor(clone(x), false); } });

/* ---------- account, sign in and sync status ---------- */
let skipMem = false;
const skipped = () => { try { return localStorage.getItem('cm_skip') === '1'; } catch (e) { return skipMem; } };
const setSkip = v => { skipMem = v; try { v ? localStorage.setItem('cm_skip', '1') : localStorage.removeItem('cm_skip'); } catch (e) {} };
const PILL = { off: 'Not signed in', offline: 'Offline', syncing: 'Syncing', synced: 'Synced', error: 'Sync problem' };
const pillHTML = () => `<button class="syncpill tap s-${S.getStatus()}" data-acc><i></i><span>${PILL[S.getStatus()]}</span></button>`;
S.onStatus(st => document.querySelectorAll('.syncpill').forEach(p => { p.className = 'syncpill tap s-' + st; p.lastElementChild.textContent = PILL[st]; }));

function showLogin(msg) {
  let el = $('#login'); if (!el) { el = document.createElement('div'); el.id = 'login'; $('#app').appendChild(el); }
  el.className = '';
  el.innerHTML = `<div class="lg"><span class="logo big">C</span><h1>CorpoMerch</h1><p>Sign in to use the shared invoices, products and tasks.</p>
    <label class="l">Email</label><input id="le" type="email" autocomplete="username" inputmode="email" autocapitalize="off">
    <div class="gap"></div><label class="l">Password</label><input id="lp" type="password" autocomplete="current-password">
    <div class="err" id="lerr">${esc(msg || '')}</div>
    <button class="btn full tap" id="lgo">Sign in</button>
    <button class="link tap" id="lskip">Use on this device only</button></div>`;
  const go = async () => {
    const em = $('#le', el).value.trim(), pw = $('#lp', el).value; if (!em || !pw) { $('#lerr', el).textContent = 'Enter your email and password'; return; }
    const b = $('#lgo', el); b.disabled = true; b.textContent = 'Signing in...'; $('#lerr', el).textContent = '';
    try { await S.signIn(em, pw); }
    catch (e) {
      b.disabled = false; b.textContent = 'Sign in';
      const m = String(e.message || e);
      $('#lerr', el).textContent = /invalid login|credentials/i.test(m) ? 'Wrong email or password' : /fetch|network/i.test(m) || !navigator.onLine ? 'No internet connection' : m;
      return;
    }
    setSkip(false); b.textContent = 'Syncing your data...';
    await S.start();
    el.classList.add('hid'); renderTab();
    if (!meDone()) pickMe();
  };
  $('#lgo', el).onclick = go;
  $('#lp', el).onkeydown = e => { if (e.key === 'Enter') go(); };
  $('#lskip', el).onclick = () => { setSkip(true); el.classList.add('hid'); };
}
const meKey = () => 'cm_me_' + (S.getUser() ? S.getUser().id : '');
const meDone = () => { try { return localStorage.getItem(meKey()) === '1'; } catch (e) { return true; } };
function pickMe() {
  openSheet(`<h3>Who are you?</h3><p>So tasks marked "Mine" and your comments show your name.</p>
    <div class="chips" id="mw">${db.people.map(p => `<button type="button" class="chip tap " data-v="${p.id}"><span class="av" style="background:#3b5bdb">${esc(p.name.trim()[0] || '?').toUpperCase()}</span>${esc(p.name)}</button>`).join('')}</div>
    <div class="gap"></div><label class="l">Not in the list? Type your name</label><input id="mn" placeholder="Your name">
    <div class="gap"></div><button class="btn full tap" id="mok">Continue</button>`, (sh, e) => {
    let pick = '';
    $('#mw', sh).onclick = ev => { const c = ev.target.closest('[data-v]'); if (!c) return; pick = c.dataset.v; $('#mn', sh).value = ''; sh.querySelectorAll('.chip').forEach(x => x.classList.toggle('on', x === c)); };
    $('#mn', sh).oninput = () => sh.querySelectorAll('.chip').forEach(x => x.classList.remove('on'));
    $('#mok', sh).onclick = () => {
      const nm = $('#mn', sh).value.trim();
      if (!nm && !pick) return toast('Choose your name or type it');
      if (nm) { const np = { id: uid(), name: nm, phone: '' }; db.people.push(np); pick = np.id; }
      db.settings.me = pick; try { localStorage.setItem(meKey(), '1'); } catch (er) {}
      persist(); e.close(); renderTab();
    };
  });
}
function openAccount() {
  const u = S.getUser();
  openSheet(`<h3>Account</h3>
    <p>${u ? `Signed in as <b>${esc(u.email || '')}</b>. Your invoices, products and tasks are shared with your team and kept in sync.` : 'You are not signed in. Everything is saved on this device only.'}</p>
    <div class="pick"><div><b>Status</b><span>${PILL[S.getStatus()]}${S.getStatus() === 'offline' && !S.getError() ? ' (changes upload when you are back online)' : ''}</span></div></div>
    <p style="margin:10px 2px;color:#8a8a8f;font-size:12px">App version 1.8</p>
    ${S.getError() && S.getStatus() !== 'synced' ? `<p class="err" style="margin:10px 2px">${esc(S.getError())}</p>` : ''}
    ${u ? `<button class="btn sec full tap" id="ac1">Sync now</button><div class="gap"></div><button class="btn sec full tap" id="ac2">Change who I am</button><div class="gap"></div><button class="btn line full tap" id="ac3">Sign out</button>`
        : `<button class="btn full tap" id="ac4">Sign in</button>`}`, (sh, e) => {
    const on = (id, fn) => { const b = $('#' + id, sh); if (b) b.onclick = fn; };
    on('ac1', async () => { e.close(); toast('Syncing...'); await S.syncNow(); toast(S.getStatus() === 'synced' ? 'Everything is up to date' : S.getError() ? S.getError() : 'Could not sync'); });
    on('ac2', () => { e.close(); setTimeout(pickMe, 200); });
    on('ac4', () => { e.close(); showLogin(); });
    on('ac3', async () => {
      e.close(); await S.syncNow();
      const doOut = async () => { await S.signOut(); await wipeLocal(); showLogin(); };
      setTimeout(() => ask('Sign out?', S.getStatus() === 'synced' ? 'Your data stays safe online. It is removed from this device and comes back when you sign in.' : 'Some changes have not been uploaded yet and will be lost if you sign out now.', 'Sign out', doOut), 200);
    });
  });
}
async function wipeLocal() {
  for (const p of db.products) if (p.hasImg) await nDelImg(p.id);
  for (const t of db.tasks) for (const f of t.files || []) await nDelImg('att_' + f.id);
  Object.keys(imgs).forEach(k => delete imgs[k]);
  db = clone(DEFAULT); await saveData(db); stack.length = 0; $('#pages').innerHTML = ''; $('#overlay').innerHTML = ''; mod = 'home'; setShell(); drawNav(); renderTab();
}

/* ---------- start ---------- */
function normalize(d) {
  const needCat = !(d.settings && d.settings.catalogV);
  d.settings = { ...DEFAULT.settings, ...d.settings };
  d.invoices.forEach(x => { x.type = x.type || 'invoice'; x.items.forEach(it => { if (it.name === undefined) it.name = ''; }); });
  d.products.forEach(p => {
    if (p.desc === p.name) p.desc = '';
    else if (p.desc && p.desc.startsWith(p.name + ' (') && p.desc.endsWith(')')) p.desc = p.desc.slice(p.name.length + 2, -1);
  });
  if (needCat) {   // one-time: add the website catalog to existing data without duplicating names
    const have = new Set(d.products.map(p => p.name.trim().toLowerCase()));
    CATALOG.forEach(p => { if (!have.has(p.name.toLowerCase())) d.products.push({ ...p }); });
    d.settings.catalogV = 1;
  }
  d.projects = (d.projects || []).map(p => ({ shared: [], items: [], notes: '', margin: '25', status: 'costing', quoted: null, ...p }));
  d.people = d.people && d.people.length ? d.people : clone(DEFAULT.people);
  d.tasks = (d.tasks || []).map(t => ({ comments: [], files: [], steps: [], link: null, client: '', notes: '', priority: 'med', assignee: '', due: '', ...t }));
  if (!d.people.some(p => p.id === d.settings.me)) d.settings.me = d.people[0].id;
  d.drafts = d.drafts || (d.draft ? { invoice: d.draft } : {}); delete d.draft;
  return d;
}
(async () => {
  const saved = await loadData();
  if (saved && saved.settings && saved.products) db = normalize(saved);
  const user = await S.init({ db: () => db, saveLocal: () => saveData(db), refresh, localImg: k => nLoadImg(k),
    onProduct: async p => { if (!p) return; if (p.hasImg) { const d = await S.downImg(p.id); if (d) { imgs[p.id] = d; await nSaveImg(p.id, d); refresh(); } } else if (imgs[p.id]) { delete imgs[p.id]; await nDelImg(p.id); } } });
  await Promise.all(db.products.filter(p => p.hasImg).map(async p => { const s = await loadImg(p.id); if (s) imgs[p.id] = s; }));
  onBack(goBack);
  let base = window.innerHeight;
  window.addEventListener('resize', () => {
    if (window.innerHeight > base) base = window.innerHeight;
    const kb = window.innerHeight < base - 150;
    document.body.classList.toggle('kb', kb);
    const a = document.activeElement;
    if (kb && a && /INPUT|TEXTAREA/.test(a.tagName)) setTimeout(() => a.scrollIntoView({ block: 'center', behavior: 'smooth' }), 120);
  });
  setShell(); drawNav(); renderTab();
  if (user) S.start(); else if (S.configured() && !skipped()) showLogin();
})();
