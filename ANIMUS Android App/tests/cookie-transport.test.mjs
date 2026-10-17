import test from 'node:test';
import assert from 'node:assert/strict';
import {createCookieTransport} from '../web-sign-in/cookie-transport.js';
test('signed-in desktop requests keep canonical payloads and use same-origin HttpOnly session cookies',async()=>{
  const transport=createCookieTransport({ensureSession:async()=>true,promptSignIn:()=>assert.fail('Unexpected login'),invalidate(){},fetcher:async request=>{assert.equal(request.credentials,'same-origin');assert.equal(request.redirect,'error');assert.equal(await request.text(),'keep-this-draft');return new Response('saved');}});
  assert.equal(await (await transport('/api/dashboard',{method:'POST',body:'keep-this-draft'})).text(),'saved');
});
test('signed-out writes are never queued or replayed after successful login',async()=>{
  let prompts=0;const transport=createCookieTransport({ensureSession:async()=>false,promptSignIn:async()=>{prompts++;return true;},invalidate(){},fetcher:()=>assert.fail('Unauthorized or replayed write')});
  const response=await transport('/api/dashboard',{method:'POST',body:'preserve-draft'});assert.equal(response.status,401);assert.equal(prompts,1);
});
test('initial cloud reads wait for interactive sign-in but cancel without a network request',async()=>{
  for(const accepted of [false,true]){let calls=0;const transport=createCookieTransport({ensureSession:async()=>false,promptSignIn:async()=>accepted,invalidate(){},fetcher:async()=>{calls++;return Response.json({ok:true});}});assert.equal((await transport('/api/dashboard')).status,accepted?200:401);assert.equal(calls,accepted?1:0);}
});
test('expired sessions do not retry an uncertain write and preserve conflict/server responses',async()=>{
  for(const status of [401,409,503]){let calls=0,invalidated=0;const transport=createCookieTransport({ensureSession:async()=>true,promptSignIn:async()=>false,invalidate(){invalidated++;},fetcher:async()=>{calls++;return Response.json({ok:false,currentVersion:4},{status});}});const response=await transport('/api/dashboard',{method:'POST',body:'original'});assert.equal(response.status,status);assert.equal(calls,1);assert.equal(invalidated,status===401?1:0);assert.equal((await response.json()).currentVersion,4);}
});
