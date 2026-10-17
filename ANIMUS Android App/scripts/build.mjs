import { readFile, writeFile, mkdir, copyFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { createRequire } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = process.env.ANIMUS_SOURCE_DIR || path.resolve(root, '..');
const out = path.join(root, 'www');
const live = process.env.ANIMUS_LIVE_CLOUD === '1';
// A developer cannot accidentally ship a customer-data app by running the default build.
if (live) {
  // ANIMUS_SECURITY_REVIEWED is not evidence that the existing APIs enforce identity.
  throw new Error('Live builds remain disabled until desktop and mobile cloud endpoints enforce authentication and device tests pass.');
}
const authUrl = process.env.ANIMUS_AUTH_URL ?? 'https://animus-app-auth.d2carpentryanddesign.workers.dev';
if (authUrl && (new URL(authUrl).protocol !== 'https:' || new URL(authUrl).username || new URL(authUrl).password || new URL(authUrl).search || new URL(authUrl).hash)) throw new Error('Authentication service must use a plain HTTPS URL.');
const pushUrl = process.env.ANIMUS_PUSH_URL || '';
if (pushUrl && new URL(pushUrl).protocol !== 'https:') throw new Error('Push service must use HTTPS.');
await mkdir(path.join(out, 'assets'), { recursive: true });
for (const name of ['mobile-cloud.css', 'assets/animus-logo.svg', 'assets/animus-sidebar-logo.png', 'icon.svg']) {
  await access(path.join(source, name));
  await copyFile(path.join(source, name), path.join(out, name));
}
await copyFile(path.join(root, 'src/native.css'), path.join(out, 'native.css'));
await copyFile(path.join(root, 'src/calendar.css'), path.join(out, 'calendar.css'));
if (!live) {
  const {jsPDF}=createRequire(import.meta.url)(path.join(source,'vendor/jspdf.umd.min.js'));
  for (const type of ['estimate','invoice','supplement','workorder']) {
    const pdf=new jsPDF();
    pdf.setFontSize(22);pdf.text('ANIMUS PREVIEW',20,25);
    pdf.setFontSize(16);pdf.text(type==='workorder'?'Work Order':type[0].toUpperCase()+type.slice(1),20,40);
    pdf.setFontSize(12);
    pdf.text(['TEST DOCUMENT - NOT A CUSTOMER RECORD','File: DEMO-0001','Customer: Preview Customer','','Sample cabinet refacing scope','Estimate total: $8,450.00','','Use this sample to test Android PDF opening and sharing.'],20,55);
    await writeFile(path.join(out,`assets/demo-${type}.pdf`),new Uint8Array(pdf.output('arraybuffer')));
  }
}
const html = await readFile(path.join(source, 'mobile-cloud.html'), 'utf8');
const scripts = '<script src="mobile-cloud.js?v=20261015-completed-pending-payment"></script>';
if (!html.includes(scripts)) throw new Error('Mobile entry changed; review app packaging before building.');
const config = { demo: !live, pushUrl, authUrl, firebaseConfigured: false, googleSignInConfigured:false, version:JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version };
try {
  const firebase = JSON.parse(await readFile(path.join(root, 'android/app/google-services.json'), 'utf8'));
  config.firebaseConfigured = firebase.client?.some(client => client.client_info?.android_client_info?.package_name === 'com.animuscrm.app') || false;
  config.googleSignInConfigured = firebase.project_info?.project_id === 'animus-b5c5d' && firebase.client?.some(client => client.client_info?.android_client_info?.package_name === 'com.animuscrm.app' && client.oauth_client?.some(o => o.client_type === 1) && client.oauth_client?.some(o => o.client_type === 3)) || false;
} catch { /* Notification setup remains visibly unavailable until Firebase is configured. */ }
await writeFile(path.join(out, 'index.html'), html.replace('</head>', '<link rel="stylesheet" href="native.css"><link rel="stylesheet" href="calendar.css"></head>')
  .replace(scripts, `<script>window.ANIMUS_APP_CONFIG=${JSON.stringify(config).replace(/</g, '\\u003c')};</script><script src="native.js"></script><script src="mobile-cloud.js"></script>`));
const adapter = `
// Packaging adapter: call the existing mobile operations, never a second persistence layer.
window.AnimusMobile = {
  get view() { return activeView; },
  get hasDraft() { return Boolean(window.AnimusCalendar?.hasDraft() || receiptDraft || workPhotoDrafts.length || (!$("sheet").hidden && $("sheet").querySelector("input,textarea"))); },
  get calendarData() { return structuredClone({files:state.files,events:[...(state.calendarEvents||[]),...(state.externalCalendarEvents||[]),...(state.calendar||[])]}); },
  closeSheet,
  openView,
  refresh: loadCloud,
  openFile(id) { const file = state.files.find(f => f.id === id); if (!file) return false; activeFileId = file.id; openView("detail"); return true; },
  async acceptCapture(file, workPhoto) {
    if (workPhoto) { await reviewWorkPhotos([file]); if (!workPhotoDrafts.length) throw new Error("The photo could not be prepared. Please retry."); return; }
    armReceiptCapture(); openView("expenses"); await receiveReceipt(file);
    if (!receiptDraft) throw new Error("The receipt could not be prepared. Please retry.");
  },
  get selectedFileId() { return activeFileId; }
};
const canonicalNotify = notify;
const canonicalCalendarRender = renderCalendar;
renderCalendar = function() { return window.AnimusCalendar ? window.AnimusCalendar.render() : canonicalCalendarRender(); };
notify = function(text, error) { return canonicalNotify(window.ANIMUS_APP_CONFIG.demo ? String(text).replace(/cloud/gi, "preview") : text, error); };
openDesktop = function(route) {
  if (route === "googleCalendar" || route === "calendar") { openView("calendar"); return; }
  if (window.ANIMUS_APP_CONFIG.demo && route !== "googleCalendar") { window.alert("Desktop tools are not connected in this isolated preview. Your live CRM has not been changed."); return; }
  const url = new URL("https://animus-v-1.pages.dev/crm");
  if (route === "googleCalendar") return window.AnimusNative.openExternal("https://calendar.google.com/calendar/u/0/r?authuser=" + encodeURIComponent(D2_GOOGLE_CALENDAR_ACCOUNT));
  url.searchParams.set("view", ({estimate:"estimator",workorder:"estimator",crm:"dashboard"})[route] || route);
  return window.AnimusNative.openExternal(url.href);
};
window.dispatchEvent(new Event("animus-mobile-ready"));
`;
await writeFile(path.join(out, 'mobile-cloud.js'), (await readFile(path.join(source, 'mobile-cloud.js'), 'utf8')) + adapter);
await copyFile(path.join(source, 'mobile-document.html'), path.join(out, 'mobile-document.html'));
await build({ entryPoints: [path.join(root, 'src/native.js')], bundle: true, format: 'iife', platform: 'browser', outfile: path.join(out, 'native.js'), target: 'chrome120' });
console.log(`Built ANIMUS ${live ? 'LIVE (security review asserted)' : 'ISOLATED PREVIEW'} in ${out}`);
