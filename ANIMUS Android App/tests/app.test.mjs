import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createDemoTransport} from '../src/demo.js';
import {safeExternalUrl,routeFromNotification,safeFilename,nextReminder} from '../src/policy.js';

test('preview reads dummy data, never live customers',async()=>{
  const fetch=createDemoTransport();
  const data=await (await fetch('https://animus-v-1.pages.dev/api/dashboard')).json();
  assert.deepEqual(data.dashboard.dashboardFiles.map(f=>f.id),['demo-work-1','demo-work-2']);
  await assert.rejects(fetch('https://untrusted.example/api/dashboard'));
});
test('preview notes and finances use targeted patch and do not create records',async()=>{
  const fetch=createDemoTransport();
  const response=await fetch('https://animus-v-1.pages.dev/api/dashboard',{method:'POST',body:JSON.stringify({action:'mobileFilePatch',fileId:'demo-work-1',changes:{notes:[{id:'note-1',text:'Testing'}],totalPaidOverride:3000}})});
  const data=await response.json();
  assert.equal(data.dashboard.dashboardFiles.length,2);
  assert.equal(data.dashboard.dashboardFiles[0].totalPaidOverride,3000);
  assert.equal(data.dashboard.dashboardFiles[0].notes[0].text,'Testing');
  assert.equal(data.dashboard.dashboardFiles[0].estimateTotal,8450);
  const rejected=await fetch('https://animus-v-1.pages.dev/api/dashboard',{method:'POST',body:JSON.stringify({dashboardFiles:[]})});
  assert.equal(rejected.status,400);
});
test('preview receipts stay bound to the selected file and survive refresh in the session',async()=>{
  const fetch=createDemoTransport();
  const record={id:'demo-receipt',amount:89.10,title:'Supplies'};
  assert.equal((await fetch('https://animus-v-1.pages.dev/api/expenses',{method:'POST',body:JSON.stringify({fileId:'DEMO-0001',expense:record})})).status,200);
  const owned=await (await fetch('https://animus-v-1.pages.dev/api/expenses?fileId=DEMO-0001')).json();
  const other=await (await fetch('https://animus-v-1.pages.dev/api/expenses?fileId=DEMO-0002')).json();
  assert.equal(owned.expenses[0].amount,89.10);assert.equal(other.expenses.length,0);
});
test('untrusted URL protocols, notification URLs and path traversal are rejected',()=>{
  for(const url of ['javascript:alert(1)','file:///secret','http://insecure.example','https://user:password@example.com','intent://untrusted.example/#Intent;end']) assert.throws(()=>safeExternalUrl(url));
  assert.equal(safeExternalUrl('tel:+12395550100'),'tel:+12395550100');
  assert.deepEqual(routeFromNotification({fileId:'file-123'}),{fileId:'file-123'});
  assert.equal(routeFromNotification({url:'javascript:evil()',fileId:'../../admin'}),null);
  assert.ok(!safeFilename('../../private.pdf').includes('/'));
});
test('reminders require a valid future local date',()=>{
  assert.throws(()=>nextReminder('2020-01-01','12:00'));
  assert.throws(()=>nextReminder('invalid','99:00'));
  assert.equal(nextReminder('2030-05-01','09:00',0).getHours(),9);
});
test('packaging keeps desktop untouched and defaults to isolated mode',async()=>{
  const build=await readFile(new URL('../scripts/build.mjs',import.meta.url),'utf8');
  assert.match(build,/ANIMUS_SECURITY_REVIEWED/);
  const html=await readFile(new URL('../www/index.html',import.meta.url),'utf8');
  assert.match(html,/"demo":true/);
  assert.match(html,/"firebaseConfigured":false/);
  const config=JSON.parse(await readFile(new URL('../capacitor.config.json',import.meta.url),'utf8'));
  assert.equal(config.server.url,undefined);assert.equal(config.server.allowNavigation,undefined);
});
test('native secrets use Android Keystore, backups disabled and no admin secret in app',async()=>{
  const java=await readFile(new URL('../android/app/src/main/java/com/animuscrm/app/AnimusSecureStoragePlugin.java',import.meta.url),'utf8');
  assert.match(java,/AndroidKeyStore/);assert.match(java,/AES\/GCM\/NoPadding/);
  const manifest=await readFile(new URL('../android/app/src/main/AndroidManifest.xml',import.meta.url),'utf8');
  assert.match(manifest,/allowBackup="false"/);assert.match(manifest,/usesCleartextTraffic="false"/);
  const bundle=await readFile(new URL('../www/native.js',import.meta.url),'utf8');
  assert.ok(!bundle.includes('FCM_SERVICE_ACCOUNT'));assert.ok(!bundle.includes('ADMIN_KEY'));
});
