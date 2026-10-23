import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {createPagesAccess,publicAsset} from '../security/pages-html.mjs';
const root=new URL('../../',import.meta.url);
const read=name=>readFile(new URL(name,root),'utf8');
test('desktop and mobile workfiles open the same manager with the exact selected ID',async()=>{
  const desktop=await read('customer-portal-admin.js');
  assert.match(desktop,/window\.AnimusPortalManagement\?\.open\|\|open/);
  const mobile=await read('mobile-workspace.js'),start=mobile.indexOf('const renderDetailMobileBase='),end=mobile.indexOf('function openMobileEstimator(');
  const elements=new Map(),file={id:'one',clientName:'Same Name'},opened=[];
  const context={renderDetail(){},activeFile:()=>file,$:id=>{if(!elements.has(id))elements.set(id,{insertAdjacentHTML(_where,html){this.html=html;}});return elements.get(id);},window:{AnimusPortalManagement:{open:async id=>opened.push(id)}},editMobileFile(){},notify(){}};
  vm.runInNewContext(mobile.slice(start,end),context);context.renderDetail();
  assert.match(elements.get('fileDetail').html,/Customer Portal/);await elements.get('mobileCustomerPortal').onclick();assert.deepEqual(opened,['one']);
  file.id='two';context.renderDetail();await elements.get('mobileCustomerPortal').onclick();assert.deepEqual(opened,['one','two']);
});
test('mobile entry and Android packaging include the manager and saved-PDF renderer',async()=>{
  const html=await read('mobile-cloud.html'),build=await read('ANIMUS Android App/scripts/build.mjs');
  for(const asset of ['customer-portal-admin.js','customer-portal-admin.css','portal-management.bundle.js','portal-management.css','portal-pdf-renderer-client.js']){assert.ok(html.includes(asset));assert.ok(build.includes(asset));}
  assert.ok(build.includes('portal-estimate-renderer.html'));
  const manager=await read('portal-management.js');assert.ok(manager.includes('data-preview-link'));assert.ok(manager.includes('data-copy-link'));assert.ok(manager.includes('data-share-link'));assert.ok(manager.includes('window.AnimusMobilePortalWorkflow(flow,fileId)'));
});
test('packaged portal requests use the authenticated canonical origin, not localhost',async()=>{
  const source=await read('portal-session.js'),{createPortalTransport}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const previous=globalThis.window;try{globalThis.window={ANIMUS_APP_CONFIG:{demo:false}};let requested;
    const api=createPortalTransport(()=>({fileId:'one',revision:3,generation:1}),async url=>{requested=url;return Response.json({ok:true});});
    await api('workspace');assert.equal(requested,'https://animus-v-1.pages.dev/api/customer-portal');
  }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}
});
test('customer UI assets are public without making staff controls or records public',async()=>{
  for(const path of ['/client/project.css','/client/project-layout.css','/client/model-viewer.bundle.js','/client/stream-player.js'])assert.equal(publicAsset(path),true);
  for(const path of ['/portal-management.bundle.js','/portal-estimate-renderer.html','/portal-admin-preview.html','/dashboard/latest.json'])assert.equal(publicAsset(path),false);
  const access=createPagesAccess({verify:()=>assert.fail('Customer assets must not require a staff account')});
  const response=await access({request:new Request('https://animus-v-1.pages.dev/client/'),next:()=>new Response('Customer shell'),env:{}});
  assert.match(response.headers.get('Content-Security-Policy'),/media-src 'self' blob:/);assert.equal(response.headers.get('X-Frame-Options'),'DENY');
});
