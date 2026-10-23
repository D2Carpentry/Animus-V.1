import { readFile, writeFile, mkdir, copyFile, access, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import {verifyLiveAccess} from './live-preflight.mjs';
import '../../scripts/build-mobile-estimator.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = process.env.ANIMUS_SOURCE_DIR || path.resolve(root, '..');
const out = path.join(root, 'www');
const live = process.env.ANIMUS_LIVE_CLOUD === '1';
// A developer cannot accidentally ship a customer-data app by running the default build.
if (live) {
  // ANIMUS_SECURITY_REVIEWED alone is never evidence of deployed enforcement.
  if(process.env.ANIMUS_INTERNAL_LIVE_TEST!=='1')throw Error('Live builds require explicit internal-device testing mode.');
  const verification=await verifyLiveAccess();
  await mkdir(path.join(root,'build'),{recursive:true});
  await writeFile(path.join(root,'build/live-preflight.json'),JSON.stringify(verification,null,2));
}
const authUrl = process.env.ANIMUS_AUTH_URL ?? 'https://animus-app-auth.d2carpentryanddesign.workers.dev';
if (authUrl && (new URL(authUrl).protocol !== 'https:' || new URL(authUrl).username || new URL(authUrl).password || new URL(authUrl).search || new URL(authUrl).hash)) throw new Error('Authentication service must use a plain HTTPS URL.');
const pushUrl = process.env.ANIMUS_PUSH_URL || '';
if (pushUrl && new URL(pushUrl).protocol !== 'https:') throw new Error('Push service must use HTTPS.');
await mkdir(path.join(out, 'assets'), { recursive: true });
await mkdir(path.join(out,'vendor'),{recursive:true});
for (const name of ['mobile-cloud.css','mobile-workspace.js','mobile-workspace.css','mobile-estimator.html','mobile-estimator.css','materials-database.js','animus-document-export.js','vendor/jspdf.umd.min.js','vendor/html2canvas.min.js','assets/d2-logo.png', 'assets/animus-logo.svg', 'assets/animus-sidebar-logo.png', 'icon.svg','customer-portal-admin.js','customer-portal-admin.css','portal-management.bundle.js','portal-management.css','portal-pdf-renderer-client.js','portal-estimate-renderer.html']) {
  await access(path.join(source, name));
  await copyFile(path.join(source, name), path.join(out, name));
}
await copyFile(path.join(root, 'src/native.css'), path.join(out, 'native.css'));
await copyFile(path.join(root, 'src/calendar.css'), path.join(out, 'calendar.css'));
if(live)for(const type of ['estimate','invoice','supplement','workorder'])await unlink(path.join(out,`assets/demo-${type}.pdf`)).catch(error=>{if(error.code!=='ENOENT')throw error;});
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
  get hasDraft() { return Boolean(window.AnimusMobileEditor?.hasDraft || window.AnimusCalendar?.hasDraft() || receiptDraft || workPhotoDrafts.length || (!$("sheet").hidden && $("sheet").querySelector("input,textarea"))); },
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
  ,documentData(id) { const file=state.files.find(file=>file.id===id); return file?structuredClone(file):null; }
  ,clearCloud() { window.AnimusMobileEditor?.clear(); state={files:[],revenue:[],prices:[],payroll:[],deletedFileKeys:[],deletedPriceIds:[]}; activeFileId=""; receipts=[]; receiptDraft=null; workPhotoDrafts=[]; closeSheet(); renderAll(); }
};
const canonicalNotify = notify;
const canonicalCalendarRender = renderCalendar;
renderCalendar = function() { return window.AnimusCalendar ? window.AnimusCalendar.render() : canonicalCalendarRender(); };
notify = function(text, error) { return canonicalNotify(window.ANIMUS_APP_CONFIG.demo ? String(text).replace(/cloud/gi, "preview") : text, error); };
window.dispatchEvent(new Event("animus-mobile-ready"));
`;
await writeFile(path.join(out, 'mobile-cloud.js'), (await readFile(path.join(source, 'mobile-cloud.js'), 'utf8')) + adapter);
await copyFile(path.join(source, 'mobile-document.html'), path.join(out, 'mobile-document.html'));
await build({ entryPoints: [path.join(root, 'src/native.js')], bundle: true, format: 'iife', platform: 'browser', outfile: path.join(out, 'native.js'), target: 'chrome120' });
console.log(`Built ANIMUS ${live ? 'LIVE INTERNAL TEST (deployed access checks passed; device verification required)' : 'ISOLATED PREVIEW'} in ${out}`);
