import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';

export const isNative = Capacitor.isNativePlatform();
const KEY = 'cm_invoice_v2';

export async function loadData() {
  try {
    if (isNative) { const { value } = await Preferences.get({ key: KEY }); return value ? JSON.parse(value) : null; }
    const v = localStorage.getItem(KEY); return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}
export async function saveData(obj) {
  const s = JSON.stringify(obj);
  try { if (isNative) await Preferences.set({ key: KEY, value: s }); else localStorage.setItem(KEY, s); } catch (e) {}
}
export function onBack(fn) {
  if (isNative) App.addListener('backButton', fn);
  else window.addEventListener('keydown', e => { if (e.key === 'Escape') fn(); });
}
export function exitApp() { if (isNative) App.exitApp(); }

function b64(bytes) {
  let s = ''; const n = 0x8000;
  for (let i = 0; i < bytes.length; i += n) s += String.fromCharCode.apply(null, bytes.subarray(i, i + n));
  return btoa(s);
}
// Share or save a PDF. On the phone this opens the Android share sheet (WhatsApp, Drive, Files > Save).
export async function sharePDF(bytes, name) {
  if (isNative) {
    const w = await Filesystem.writeFile({ path: name, data: b64(bytes), directory: Directory.Cache });
    await Share.share({ title: name, url: w.uri, dialogTitle: 'Share or save invoice' });
    return;
  }
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const f = new File([blob], name, { type: 'application/pdf' });
  if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); return; }
  const u = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 10000);
}
export async function shareText(text, title) {
  if (isNative) { await Share.share({ title, text, dialogTitle: title }); return true; }
  try { await navigator.clipboard.writeText(text); } catch (e) { return false; }
  return true;
}

// Product images are stored one per key so the main data stays small.
export async function saveImg(id, data) {
  try { if (isNative) await Preferences.set({ key: 'cm_img_' + id, value: data }); else localStorage.setItem('cm_img_' + id, data); } catch (e) {}
}
export async function loadImg(id) {
  try { if (isNative) return (await Preferences.get({ key: 'cm_img_' + id })).value || null; return localStorage.getItem('cm_img_' + id); } catch (e) { return null; }
}
export async function delImg(id) {
  try { if (isNative) await Preferences.remove({ key: 'cm_img_' + id }); else localStorage.removeItem('cm_img_' + id); } catch (e) {}
}
