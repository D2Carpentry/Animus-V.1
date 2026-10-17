import test from 'node:test';
import assert from 'node:assert/strict';
import {createPagesAccess,publicAsset} from '../security/pages-html.mjs';
test('only the explicit sign-in assets and installable app binaries are public',()=>{
  for(const path of ['/signin/','/signin/sign-in.js','/crm-access.js','/assets/animus-sidebar-logo.png','/downloads/animus-android-live-0.4.0.apk'])assert.equal(publicAsset(path),true);
  for(const path of ['/crm','/crm.js','/financial-data.js','/unknown-snapshot.json','/backup.pdf','/ANIMUS Android App/security/live-api.mjs','/auth-preview/private.json','/signin/private.json','/downloads/customer.pdf'])assert.equal(publicAsset(path),false);
});
test('all legacy exports, scripts and documents require identity before static storage',async()=>{
  const access=createPagesAccess({verify:async()=>{throw {status:401};}});
  for(const path of ['/crm','/financial-data.js','/old-snapshot.json','/invoice.pdf','/source/private.txt']){
    const response=await access({request:new Request('https://animus-v-1.pages.dev'+path),env:{},next:()=>assert.fail('Anonymous static read')});assert.equal(response.status,401);
  }
});
test('navigation prompts sign-in without copying sensitive query parameters into redirect URLs',async()=>{
  const access=createPagesAccess({verify:async()=>{throw {status:401};}});
  const response=await access({request:new Request('https://animus-v-1.pages.dev/crm?token=do-not-copy',{headers:{Accept:'text/html'}}),env:{},next:()=>assert.fail('Anonymous shell')});
  assert.equal(response.status,303);assert.equal(response.headers.get('Location'),'https://animus-v-1.pages.dev/signin/?returnTo=%2Fcrm');assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});
test('authorized HTML gets the shared bridge while API authentication stays in the API subtree',async()=>{
  let rewritten=0;const access=createPagesAccess({verify:async()=>({role:'admin'}),rewrite(response){rewritten++;return response;}});
  const response=await access({request:new Request('https://animus-v-1.pages.dev/crm'),env:{},next:()=>new Response('<head></head>',{headers:{'Content-Type':'text/html',ETag:'old'}})});
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('ETag'),null);assert.equal(rewritten,1);
  const denied=createPagesAccess({verify:()=>assert.fail('API intercepted twice')});
  assert.equal((await denied({request:new Request('https://animus-v-1.pages.dev/api/dashboard'),next:()=>new Response(null,{status:401})})).status,401);
});
