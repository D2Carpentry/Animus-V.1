import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {generateKeyPair,SignJWT} from 'jose';
import {createApiGuard} from '../security/api-access.mjs';
import {createAdministratorVerifier} from '../auth-worker/verify.mjs';

const {privateKey,publicKey}=await generateKeyPair('RS256');
const env={FIREBASE_PROJECT_ID:'animus-b5c5d',ADMIN_EMAIL:'owner@example.test',ADMIN_UID:'test-owner'};
const guard=createApiGuard(createAdministratorVerifier(()=>publicKey));
async function token(overrides={}) {
  const now=Math.floor(Date.now()/1000);
  return new SignJWT({email:env.ADMIN_EMAIL,email_verified:true,auth_time:now-5,firebase:{sign_in_provider:'google.com'},...overrides})
    .setProtectedHeader({alg:'RS256',kid:'test'}).setIssuer('https://securetoken.google.com/animus-b5c5d')
    .setAudience('animus-b5c5d').setSubject('test-owner').setIssuedAt(now-2).setExpirationTime(now+600).sign(privateKey);
}
function context(path,options={},next=()=>Response.json({ok:true})) {
  return {env,data:{},request:new Request(`https://animus-v-1.pages.dev${path}`,options),next};
}
const paths=['/api','/api/dashboard','/api/dashboard?backups=list','/api/dashboard?summary=dashboard/backups/test.json','/api/dashboard?backup=dashboard/backups/test.json','/api/dashboard?replaceLatest=1','/api/dashboard?testSnapshot=1','/api/expenses?fileId=test','/api/expenses?receiptImageKey=animus-receipt-photos/v1/test.jpg','/api/receipt','/api/v2/workfiles','/api/v2/health','/api/v2/verify','/api/v2/migrate','/api/v2/migrate-chunk','/api/v2/migrate-finalize','/api/future-route'];
test('every API route and method denies anonymous access before any handler runs',async()=>{
  let calls=0;
  for(const path of paths)for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE']) {
    const response=await guard(context(path,{method},()=>{calls++;throw Error('Handler accessed');}));
    assert.equal(response.status,401,`${method} ${path}`);
    assert.equal(response.headers.get('WWW-Authenticate'),'Bearer');
  }
  assert.equal(calls,0);
});
test('query tokens, browser identity and migration keys cannot substitute for bearer authentication',async()=>{
  const response=await guard(context('/api/dashboard?token=pretend&email=owner@example.test',{headers:{'X-Animus-Migration-Key':'pretend','X-Animus-Actor':env.ADMIN_EMAIL}},()=>assert.fail('Unauthorized handler')));
  assert.equal(response.status,401);
});
test('signed but wrong-owner and unverified identities do not reach handlers',async()=>{
  for(const claims of [{email:'other@example.test'},{email_verified:false},{firebase:{sign_in_provider:'password'}}]) {
    const response=await guard(context('/api/dashboard',{headers:{Authorization:`Bearer ${await token(claims)}`}},()=>assert.fail('Unauthorized handler')));
    assert.equal(response.status,403);
  }
});
test('missing verifier configuration and unexpected verifier failures fail closed',async()=>{
  const ctx=context('/api/dashboard',{headers:{Authorization:`Bearer ${await token()}`}},()=>assert.fail('Unauthorized handler'));
  ctx.env={...env,ADMIN_UID:''};assert.equal((await guard(ctx)).status,503);
  const broken=createApiGuard(async()=>{throw Error('private diagnostic');});
  const response=await broken(ctx);assert.equal(response.status,503);assert.ok(!(await response.text()).includes('private diagnostic'));
});
test('CORS preflight never accesses handlers and rejects unknown origins and headers',async()=>{
  const opts={method:'OPTIONS',headers:{Origin:'https://localhost','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Authorization, Content-Type, X-Animus-Compact-Response'}};
  const response=await guard(context('/api/dashboard',opts,()=>assert.fail('Preflight handler')));
  assert.equal(response.status,204);assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://localhost');
  for(const headers of [{...opts.headers,Origin:'https://evil.test'},{...opts.headers,'Access-Control-Request-Headers':'X-Animus-Migration-Key'}])assert.equal((await guard(context('/api/dashboard',{...opts,headers},()=>assert.fail('Denied handler')))).status,403);
});
test('verified identity preserves body and conflict response but cannot spoof audit actor or expose tokens',async()=>{
  const body=JSON.stringify({action:'mobileFilePatch',fileId:'test-file',note:{id:'note-test',text:'Test note'}});
  const ctx=context('/api/dashboard',{method:'POST',headers:{Authorization:`Bearer ${await token()}`,'X-Animus-Actor':'Forged','X-Animus-Migration-Key':'must-not-forward','Content-Type':'application/json','If-Match':'7'},body},async request=>{
    assert.equal(await request.text(),body);assert.equal(request.headers.get('X-Animus-Actor'),env.ADMIN_EMAIL);
    assert.equal(request.headers.get('Authorization'),null);assert.equal(request.headers.get('X-Animus-Migration-Key'),null);assert.equal(request.headers.get('If-Match'),'7');
    return Response.json({ok:false,error:'Conflict',currentVersion:8},{status:409,headers:{ETag:'8','Access-Control-Allow-Origin':'*',Vary:'Accept'}});
  });
  const response=await guard(ctx);assert.equal(response.status,409);assert.equal(response.headers.get('ETag'),'8');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),null);assert.equal(response.headers.get('Vary'),'Accept, Origin');
  assert.equal(ctx.data.animusIdentity.uid,'test-owner');assert.ok(Object.isFrozen(ctx.data.animusIdentity));
  assert.deepEqual(await response.json(),{ok:false,error:'Conflict',currentVersion:8});
});
test('private media keeps its bytes and type but loses public cache and wildcard CORS',async()=>{
  const bytes=new Uint8Array([37,80,68,70,45]);
  const response=await guard(context('/api/expenses?receiptImageKey=test.pdf',{headers:{Authorization:`Bearer ${await token()}`,Origin:'https://localhost'}},()=>new Response(bytes,{headers:{'Content-Type':'application/pdf','Cache-Control':'public, max-age=31536000, immutable','Access-Control-Allow-Origin':'*'}})));
  assert.equal(response.headers.get('Content-Type'),'application/pdf');assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://localhost');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);
});
test('guard has no pathname bypass and HEAD stays bodyless',async()=>{
  for(const path of ['/api%2Fdashboard','/%61pi/dashboard','/api//dashboard'])assert.equal((await guard(context(path,{},()=>assert.fail('Path bypass')))).status,401);
  const response=await guard(context('/api/dashboard',{method:'HEAD',headers:{Authorization:`Bearer ${await token()}`}},()=>new Response('private body')));
  assert.equal(await response.text(),'');
});
test('guard wraps canonical dashboard and receipt media handlers using only synthetic storage',async()=>{
  const importHandler=async name=>import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL(`../../functions/api/${name}.js`,import.meta.url),'utf8')).toString('base64'));
  const dashboard=await importHandler('dashboard');const expenses=await importHandler('expenses');
  const snapshot=JSON.stringify({dashboardFiles:[{id:'test-only',clientName:'Synthetic Customer'}],revenueRows:[]});
  let reads=0,writes=0;
  const bucket={async get(key){reads++;return key==='dashboard/latest.json'?{body:snapshot}:key.startsWith('animus-receipt-photos/')?{body:new Uint8Array([1,2]),httpMetadata:{contentType:'image/jpeg'}}:null;},async put(){writes++;assert.fail('Unexpected write');}};
  for(const [path,handler] of [['/api/dashboard',dashboard.onRequestGet],['/api/expenses?receiptImageKey=animus-receipt-photos/v1/test.jpg',expenses.onRequestGet]]) {
    for(const authorized of [false,true]) {
      const ctx=context(path,{headers:authorized?{Authorization:`Bearer ${await token()}`}:{}});
      ctx.env={...env,ANIMUS_BUCKET:bucket};ctx.next=request=>handler({...ctx,request});
      const before=reads;const response=await guard(ctx);
      assert.equal(response.status,authorized?200:401);assert.equal(reads-before,authorized?1:0);
      if(authorized)assert.equal(response.headers.get('Cache-Control'),'private, no-store');
    }
  }
  assert.equal(writes,0);
});
test('authorized canonical note save updates only the synthetic target and refreshes from the saved data',async()=>{
  const source=await readFile(new URL('../../functions/api/dashboard.js',import.meta.url),'utf8');
  const dashboard=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const other={id:'other-file',fileNumber:'TEST-2',clientName:'Untouched Customer',notes:['Keep this'],estimateTotal:4590};
  let snapshot={dashboardFiles:[{id:'target-file',fileNumber:'TEST-1',clientName:'Test Customer',notes:[],estimateTotal:8000},other],revenueRows:[{id:'rev',gross:8000,labor:1000,expenses:500}]};
  const before=structuredClone(snapshot);let reads=0,writes=0;
  const bucket={async get(key){assert.equal(key,'dashboard/latest.json');reads++;return {json:async()=>structuredClone(snapshot),body:JSON.stringify(snapshot)};},async put(key,body){assert.equal(key,'dashboard/latest.json');writes++;snapshot=JSON.parse(body);}};
  const headers={Authorization:`Bearer ${await token()}`,'Content-Type':'application/json'};
  const payload={action:'mobileFilePatch',fileId:'target-file',changes:{notes:[{id:'test-note',text:'Synthetic note'}]}};
  for(const authorized of [false,true]) {
    const ctx=context('/api/dashboard',{method:'POST',headers:authorized?headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    ctx.env={...env,ANIMUS_BUCKET:bucket};ctx.next=request=>dashboard.onRequestPost({...ctx,request});
    const response=await guard(ctx);assert.equal(response.status,authorized?200:401);
    if(!authorized){assert.equal(reads,0);assert.equal(writes,0);assert.deepEqual(snapshot,before);}
    else assert.equal((await response.json()).dashboard.dashboardFiles[0].notes[0].text,'Synthetic note');
  }
  assert.equal(writes,1);assert.deepEqual(snapshot.dashboardFiles[1],other);assert.deepEqual(snapshot.revenueRows,before.revenueRows);
  const ctx=context('/api/dashboard',{headers});ctx.env={...env,ANIMUS_BUCKET:bucket};ctx.next=request=>dashboard.onRequestGet({...ctx,request});
  assert.equal((await (await guard(ctx)).json()).dashboardFiles[0].notes[0].id,'test-note');
});
