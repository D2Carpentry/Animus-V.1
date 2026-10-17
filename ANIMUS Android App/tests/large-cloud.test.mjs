import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLiveApi} from '../security/live-api.mjs';
const source=await readFile(new URL('../../functions/api/dashboard.js',import.meta.url),'utf8');
const dashboard=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const identity={uid:'synthetic',email:'owner@example.test',role:'admin'};
test('authenticated 54 MB snapshot streams without choosing an older backup or rewriting data',async()=>{
  const bytes=54*1024*1024;let reads=0,writes=0,produced=0;
  const bucket={async get(key){assert.equal(key,'dashboard/latest.json');reads++;return {size:bytes,body:new ReadableStream({pull(controller){const amount=Math.min(64*1024,bytes-produced);if(!amount){controller.close();return;}controller.enqueue(new Uint8Array(amount));produced+=amount;}})};},put(){writes++;assert.fail('Read changed data');},list(){assert.fail('Read chose backup');}};
  const ctx={env:{ANIMUS_BUCKET:bucket},data:{},request:new Request('https://animus-v-1.pages.dev/api/dashboard'),next:request=>dashboard.onRequestGet({...ctx,request})};
  const middleware=createLiveApi({verify:async()=>identity});const response=await middleware(ctx);assert.equal(response.status,200);
  let received=0;for await(const chunk of response.body)received+=chunk.byteLength;
  assert.equal(received,bytes);assert.equal(reads,1);assert.equal(writes,0);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
});
test('signed-in note patch preserves a realistic large synthetic document and every other financial field',async()=>{
  let saved=null;
  const document='data:application/pdf;base64,'+'A'.repeat(54*1024*1024);
  const snapshot={dashboardFiles:[{id:'target',fileNumber:'TEST-1',notes:[],estimatePdfUrl:document},{id:'untouched',fileNumber:'TEST-2',estimateTotal:4590}],revenueRows:[{id:'revenue-test',gross:8000,expenses:500,labor:1000}]};
  const bucket={async get(key){assert.equal(key,'dashboard/latest.json');return {json:async()=>structuredClone(snapshot),size:document.length};},async put(key,body){assert.equal(key,'dashboard/latest.json');saved=JSON.parse(body);}};
  const ctx={env:{ANIMUS_BUCKET:bucket},data:{},request:new Request('https://animus-v-1.pages.dev/api/dashboard',{method:'POST',headers:{'Content-Type':'application/json','X-Animus-Compact-Response':'1'},body:JSON.stringify({action:'mobileFilePatch',fileId:'target',changes:{notes:[{id:'test-note',text:'Synthetic note'}]}})}),next:request=>dashboard.onRequestPost({...ctx,request})};
  const response=await createLiveApi({verify:async()=>identity})(ctx);assert.equal(response.status,200);assert.equal((await response.json()).ok,true);
  assert.equal(saved.dashboardFiles[0].estimatePdfUrl,document);assert.equal(saved.dashboardFiles[0].notes[0].id,'test-note');assert.deepEqual(saved.dashboardFiles[1],snapshot.dashboardFiles[1]);assert.deepEqual(saved.revenueRows,snapshot.revenueRows);
});
