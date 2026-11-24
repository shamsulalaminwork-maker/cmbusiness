/* Online sync with Supabase. The app stays local-first: everything works offline and
   changes are pushed/pulled as small records (invoice, product, task, person, settings). */
import { createClient } from '@supabase/supabase-js';

export const SB_URL = 'https://rfztthrifttuucvfkfkw.supabase.co';
const SB_KEY = 'sb_publishable_VFxJXURTQZBkl3rrr5pz1A_e9lR9wcP';
const STKEY = 'cm_sync_v1';
const COLL = { inv: 'invoices', prod: 'products', task: 'tasks', ppl: 'people', proj: 'projects' };

let sb = null, ctx = null, user = null, status = 'off', statusCb = () => {}, busy = false, again = false, timer = null, poll = null, chan = null;
try { sb = createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } }); } catch (e) { sb = null; }

/* ---------- local sync state (what the server is known to hold) ---------- */
let st = { known: {}, lastPull: '', pendingUp: [] };
const loadSt = () => { try { const s = JSON.parse(localStorage.getItem(STKEY)); if (s && s.known) st = { pendingUp: [], ...s }; } catch (e) {} };
const saveSt = () => { try { localStorage.setItem(STKEY, JSON.stringify(st)); } catch (e) {} };
export const resetState = () => { st = { known: {}, lastPull: '', pendingUp: [] }; try { localStorage.removeItem(STKEY); } catch (e) {} };

/* ---------- hashing of records (key order independent) ---------- */
const canon = v => v === undefined ? 'null' : v === null || typeof v !== 'object' ? JSON.stringify(v) :
  Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' :
  '{' + Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
const hash = o => { const s = canon(o); let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16) + ':' + s.length; };
const stripMe = s => { const { me, ...rest } = s; return rest; };

function flatten(d) {
  const m = new Map();
  Object.entries(COLL).forEach(([k, c]) => (d[c] || []).forEach(x => m.set(k + ':' + x.id, x)));
  m.set('set:main', stripMe(d.settings));
  return m;
}

/* ---------- status ---------- */
let lastError = '';
function explain(e) {
  const m = String((e && (e.message || e.error_description)) || e || '');
  if (/records/i.test(m) && /(schema cache|does not exist|could not find)/i.test(m)) return 'The shared table is missing. Run supabase-setup.sql in Supabase, SQL Editor.';
  if (/row-level security|permission denied|not authorized|jwt/i.test(m) || (e && (e.code === '42501' || e.status === 401 || e.status === 403))) return 'Permission problem. Run supabase-setup.sql again, or sign out and in. (' + m + ')';
  if (/failed to fetch|network|load failed/i.test(m)) return 'Cannot reach the server. Check the internet connection.';
  if (/bucket/i.test(m)) return 'Photo storage is not set up. Run supabase-setup.sql in Supabase.';
  return m || 'Unknown error';
}
export const getError = () => lastError;
const fail = e => { lastError = explain(e); setStatus(isNet(e) ? 'offline' : 'error'); };
function setStatus(s) { if (s === 'synced') lastError = ''; status = s; try { statusCb(s); } catch (e) {} }
export const getStatus = () => status;
export const onStatus = cb => { statusCb = cb; };
export const getUser = () => user;
export const configured = () => !!sb;
const isNet = e => !navigator.onLine || /fetch|network|load failed|timeout/i.test(String(e && (e.message || e)));

/* ---------- auth ---------- */
export async function init(c) {
  ctx = c; loadSt();
  if (!sb) return null;
  try { const { data } = await sb.auth.getSession(); user = data.session ? data.session.user : null; } catch (e) { user = null; }
  sb.auth.onAuthStateChange((ev, session) => { user = session ? session.user : null; });
  setStatus(user ? 'synced' : 'off');
  return user;
}
export async function signIn(email, password) {
  if (!sb) throw new Error('Online sync is not available here');
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
  user = data.user; return user;
}
export async function signOut() {
  stop();
  try { if (sb) await sb.auth.signOut(); } catch (e) {}
  user = null; resetState(); setStatus('off');
}
export function stop() {
  clearTimeout(timer); clearInterval(poll); poll = null;
  if (chan && sb) { try { sb.removeChannel(chan); } catch (e) {} } chan = null;
}

/* ---------- pushing local changes ---------- */
export function changed() { if (!user) return; clearTimeout(timer); timer = setTimeout(flush, 700); }

async function flush() {
  if (!sb || !user) return true;
  if (busy) { again = true; return true; }
  busy = true;
  try {
    const cur = flatten(ctx.db()), rows = [];
    for (const [k, o] of cur) { const h = hash(o); if (st.known[k] !== h) rows.push({ k, h, kind: k.split(':')[0], id: k.slice(k.indexOf(':') + 1), data: o, deleted: false }); }
    for (const k of Object.keys(st.known)) if (!cur.has(k)) rows.push({ k, kind: k.split(':')[0], id: k.slice(k.indexOf(':') + 1), data: {}, deleted: true });
    await retryUploads();
    if (!rows.length) { setStatus('synced'); return true; }
    setStatus('syncing');
    for (let i = 0; i < rows.length; i += 100) {
      const part = rows.slice(i, i + 100);
      const { error } = await sb.from('records').upsert(part.map(r => ({ kind: r.kind, id: r.id, data: r.data, deleted: r.deleted })), { onConflict: 'kind,id' });
      if (error) throw error;
      part.forEach(r => { if (r.deleted) delete st.known[r.k]; else st.known[r.k] = r.h; });
      saveSt();
    }
    setStatus('synced'); return true;
  } catch (e) { fail(e); return false; }
  finally { busy = false; if (again) { again = false; changed(); } }
}

/* ---------- pulling remote changes ---------- */
function applyRec(r) {
  const d = ctx.db(), k = r.kind + ':' + r.id, coll = COLL[r.kind];
  if (!coll && r.kind !== 'set') return false;
  const local = r.kind === 'set' ? d.settings : d[coll].find(x => x.id === r.id);
  const lh = local ? hash(r.kind === 'set' ? stripMe(local) : local) : null;
  if (st.known[k] !== undefined && lh !== st.known[k]) return false;          // local edit not pushed yet: it wins
  if (r.deleted) { if (local && coll) { d[coll] = d[coll].filter(x => x.id !== r.id); } delete st.known[k]; return !!(local && coll); }
  const rh = hash(r.data);
  if (local && lh === rh) { st.known[k] = rh; return false; }
  if (r.kind === 'set') { const me = d.settings.me; Object.keys(d.settings).forEach(x => delete d.settings[x]); Object.assign(d.settings, r.data, { me }); }
  else if (local) { Object.keys(local).forEach(x => delete local[x]); Object.assign(local, JSON.parse(JSON.stringify(r.data))); }
  else if (r.kind === 'inv') d.invoices.unshift(JSON.parse(JSON.stringify(r.data)));
  else d[coll].push(JSON.parse(JSON.stringify(r.data)));
  st.known[k] = rh;
  if (r.kind === 'prod') ctx.onProduct(d.products.find(x => x.id === r.id));
  return true;
}
const afterApply = () => { ctx.saveLocal(); ctx.refresh(); };

export async function pull() {
  if (!sb || !user) return true;
  try {
    let any = false, since = st.lastPull ? new Date(Date.parse(st.lastPull) - 10000).toISOString() : null;
    for (let guard = 0; guard < 50; guard++) {
      let q = sb.from('records').select('kind,id,data,deleted,updated_at').order('updated_at', { ascending: true }).limit(1000);
      if (since) q = q.gt('updated_at', since);
      const { data, error } = await q;
      if (error) throw error;
      if (!data.length) break;
      data.forEach(r => { if (applyRec(r)) any = true; });
      since = data[data.length - 1].updated_at;
      if (!st.lastPull || since > st.lastPull) st.lastPull = since;
      if (data.length < 1000) break;
    }
    if (!st.lastPull) st.lastPull = new Date(0).toISOString();
    saveSt(); if (any) afterApply();
    return true;
  } catch (e) { fail(e); return false; }
}

export async function syncNow() {
  if (!sb || !user) return;
  setStatus('syncing');
  if (!st.lastPull) { await pull(); await flush(); } else { await flush(); await pull(); }
  if (status === 'syncing') setStatus('synced');
}

export async function start() {
  if (!sb || !user) return;
  stop();
  try {
    chan = sb.channel('records-live').on('postgres_changes', { event: '*', schema: 'public', table: 'records' }, p => {
      const r = p.new; if (!r || !r.kind) return;
      if (applyRec(r)) afterApply();
      if (r.updated_at && (!st.lastPull || r.updated_at > st.lastPull)) { st.lastPull = r.updated_at; saveSt(); }
    }).subscribe();
  } catch (e) {}
  poll = setInterval(() => { if (!document.hidden) syncNow(); }, 20000);
  await syncNow();
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { if (user) syncNow(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && user) syncNow(); });
}

/* ---------- photos (stored as small text files in the "media" bucket) ---------- */
export async function upImg(key, data) {
  if (!sb || !user) { if (!st.pendingUp.includes(key)) { st.pendingUp.push(key); saveSt(); } return; }
  try {
    const { error } = await sb.storage.from('media').upload(key + '.txt', new Blob([data], { type: 'text/plain' }), { upsert: true, contentType: 'text/plain' });
    if (error) throw error;
  } catch (e) { if (!st.pendingUp.includes(key)) { st.pendingUp.push(key); saveSt(); } }
}
async function retryUploads() {
  const list = [...st.pendingUp]; if (!list.length) return;
  for (const key of list) {
    const d = await ctx.localImg(key);
    if (!d) { st.pendingUp = st.pendingUp.filter(x => x !== key); continue; }
    try {
      const { error } = await sb.storage.from('media').upload(key + '.txt', new Blob([d], { type: 'text/plain' }), { upsert: true, contentType: 'text/plain' });
      if (!error) st.pendingUp = st.pendingUp.filter(x => x !== key);
    } catch (e) {}
  }
  saveSt();
}
export async function downImg(key) {
  if (!sb || !user) return null;
  try { const { data, error } = await sb.storage.from('media').download(key + '.txt'); if (error || !data) return null; return await data.text(); } catch (e) { return null; }
}
export async function rmImg(key) { if (!sb || !user) return; try { await sb.storage.from('media').remove([key + '.txt']); } catch (e) {} }
