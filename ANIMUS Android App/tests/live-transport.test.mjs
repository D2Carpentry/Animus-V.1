import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveTransport} from '../src/live-transport.js';
test('native live cloud reads and writes wait for identity and use the same authenticated client',async()=>{
  let identityReady=false,calls=0;
  const transport=createLiveTransport({ready:Promise.resolve().then(()=>identityReady=true),verified:()=>identityReady,client:{async request(url,init){calls++;assert.equal(url,'https://animus-v-1.pages.dev/api/dashboard');assert.equal(init.body,'unchanged');return Response.json({ok:true});}},fetcher:()=>assert.fail('Anonymous cloud call'),onSignInRequired:()=>assert.fail('Unexpected sign-in')});
  assert.equal((await transport('https://animus-v-1.pages.dev/api/dashboard',{method:'POST',body:'unchanged'})).status,200);assert.equal(calls,1);
});
test('unverified native identity cannot read customer records or submit writes',async()=>{
  let prompts=0;const transport=createLiveTransport({ready:Promise.resolve(),verified:()=>false,client:{request:()=>assert.fail('Unverified live access')},fetcher:()=>assert.fail('Anonymous cloud call'),onSignInRequired:()=>prompts++});
  for(const method of ['GET','POST'])await assert.rejects(transport('https://animus-v-1.pages.dev/api/dashboard',{method}),/Sign in/);assert.equal(prompts,2);
});
test('camera files, local assets and unrelated hosts never receive CRM credentials',async()=>{
  let calls=0;const transport=createLiveTransport({ready:Promise.resolve(),verified:()=>true,client:{request:()=>assert.fail('Credential escaped cloud API')},fetcher:async()=>{calls++;return new Response('asset');},onSignInRequired(){}});
  for(const url of ['https://localhost/assets/photo.jpg','blob:https://localhost/example','https://example.test/image.jpg','https://animus-v-1.pages.dev/assets/animus-logo.svg'])await transport(url);assert.equal(calls,4);
});
