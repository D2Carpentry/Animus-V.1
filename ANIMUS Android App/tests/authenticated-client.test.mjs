import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthenticatedClient} from '../src/authenticated-client.js';

function provider(){return {getCurrentUser:async()=>({user:{uid:'synthetic-owner'}}),getIdToken:async()=>({token:'test-token-only'})};}
const denied=(promise,code)=>assert.rejects(promise,error=>error.code===code);
test('credentials are attached only to the canonical API origin and never to query strings',async()=>{
  let calls=0;
  const client=createAuthenticatedClient({provider:provider(),fetcher:async(url,init)=>{
    calls++;assert.equal(url,'https://animus-v-1.pages.dev/api/dashboard');assert.equal(init.headers.get('Authorization'),'Bearer test-token-only');
    assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(init.referrerPolicy,'no-referrer');
    assert.equal(init.headers.get('X-Animus-Actor'),null);assert.equal(init.headers.get('X-Animus-Migration-Key'),null);return Response.json({ok:true});
  }});
  for(const url of ['https://evil.test/api/dashboard','//evil.test/api/dashboard','/crm','/api/../crm','http://animus-v-1.pages.dev/api/dashboard','https://user:password@animus-v-1.pages.dev/api/dashboard','/api/dashboard#token','/api/dashboard?ID_TOKEN=private'])await denied(client.request(url),'unsafe-endpoint');
  assert.equal(calls,0);
  await client.request('/api/dashboard',{headers:{Authorization:'untrusted','X-Animus-Actor':'Forged','X-Animus-Migration-Key':'secret'},credentials:'include',redirect:'follow'});
  assert.equal(calls,1);
});
test('signed-out identity never sends data and sign-in callback failure does not bypass the check',async()=>{
  const client=createAuthenticatedClient({provider:{getCurrentUser:async()=>({user:null})},fetcher:()=>assert.fail('Network call'),onSignInRequired:()=>{throw Error('UI failure');}});
  await denied(client.request('/api/dashboard',{method:'POST',body:'keep-draft'}),'sign-in-required');
});
test('account changes during token refresh prevent the write',async()=>{
  let calls=0;const p=provider();p.getCurrentUser=async()=>({user:{uid:++calls===1?'first-owner':'second-owner'}});
  const client=createAuthenticatedClient({provider:p,fetcher:()=>assert.fail('Unexpected write')});
  await denied(client.request('/api/dashboard',{method:'POST',body:'keep-draft'}),'account-changed');
});
test('401, 403 and network errors never automatically retry a financial write',async()=>{
  for(const status of [401,403,0]) {
    let calls=0,signIns=0;const draft={gross:8000,paid:1000};const body=JSON.stringify(draft);
    const client=createAuthenticatedClient({provider:provider(),onSignInRequired:()=>signIns++,fetcher:async(url,init)=>{calls++;assert.equal(init.body,body);if(!status)throw Error('private transport detail');return new Response(null,{status});}});
    await denied(client.request('/api/dashboard',{method:'POST',body}),status===401?'sign-in-required':status===403?'forbidden':'request-failed');
    assert.equal(calls,1);assert.equal(signIns,status===401?1:0);assert.deepEqual(draft,{gross:8000,paid:1000});
  }
});
test('conflicts and server errors reach existing save logic with their response details intact',async()=>{
  for(const status of [409,503]) {
    const client=createAuthenticatedClient({provider:provider(),fetcher:async()=>Response.json({ok:false,currentVersion:9},{status})});
    const response=await client.request('/api/dashboard',{method:'POST',body:'original'});
    assert.equal(response.status,status);assert.deepEqual(await response.json(),{ok:false,currentVersion:9});
  }
});
test('sign-out invalidation aborts in-flight requests and revokes every document URL',async()=>{
  const revoked=[];let count=0;
  const objectUrls={createObjectURL(){return `blob:test-${++count}`;},revokeObjectURL(url){revoked.push(url);}};
  let pending=false,started;
  const ready=new Promise(resolve=>started=resolve);
  const client=createAuthenticatedClient({provider:provider(),objectUrls,fetcher:async(url,init)=>{
    if(!pending)return new Response(new Uint8Array([37,80,68,70]),{headers:{'Content-Type':'application/pdf'}});
    started();return new Promise((resolve,reject)=>init.signal.addEventListener('abort',()=>reject(init.signal.reason),{once:true}));
  }});
  const doc=await client.loadDocument('/api/expenses?receiptImageKey=test.pdf');assert.equal(doc.type,'application/pdf');assert.equal(doc.size,4);
  pending=true;const saving=client.request('/api/dashboard',{method:'POST',body:'original'});await ready;client.invalidate();
  await denied(saving,'request-interrupted');assert.deepEqual(revoked,['blob:test-1']);doc.dispose();assert.equal(revoked.length,1);
});
test('HTML, SVG, empty and oversized documents never become preview URLs',async()=>{
  for(const [type,body,length] of [['text/html','<html>'],['image/svg+xml','<svg/>'],['application/pdf',''],['application/pdf','12345'],['application/pdf','a','9999']]) {
    const client=createAuthenticatedClient({provider:provider(),objectUrls:{createObjectURL:()=>assert.fail('Unsafe blob URL')},fetcher:async()=>new Response(body,{headers:{'Content-Type':type,...(length?{'Content-Length':length}:{})}})});
    await assert.rejects(client.loadDocument('/api/expenses?receiptImageKey=test',{maxBytes:4}));
  }
});
test('cancelled calls do not reach the network, even when Firebase restore is pending',async()=>{
  const controller=new AbortController();controller.abort();
  const client=createAuthenticatedClient({provider:{getCurrentUser:()=>new Promise(()=>{})},fetcher:()=>assert.fail('Cancelled network')});
  await denied(client.request('/api/dashboard',{signal:controller.signal}),'request-interrupted');
});
test('sign-out interrupts a pending document body and never creates a preview URL',async()=>{
  let reading;const ready=new Promise(resolve=>reading=resolve);let cancelled=false;
  const client=createAuthenticatedClient({provider:provider(),objectUrls:{createObjectURL:()=>assert.fail('Signed-out preview')},fetcher:async()=>new Response(new ReadableStream({pull(){reading();return new Promise(()=>{});},cancel(){cancelled=true;}}),{headers:{'Content-Type':'application/pdf'}})});
  const loading=client.loadDocument('/api/expenses?receiptImageKey=test');await ready;client.invalidate();
  await denied(loading,'request-interrupted');assert.equal(cancelled,true);
});
test('already-cancelled request handles a rejected identity restore without unhandled rejections',async()=>{
  const controller=new AbortController();controller.abort();
  const client=createAuthenticatedClient({provider:{getCurrentUser:async()=>{throw Error('Restore failed');}},fetcher:()=>assert.fail('Cancelled network')});
  await denied(client.request('/api/dashboard',{signal:controller.signal}),'request-interrupted');
});
