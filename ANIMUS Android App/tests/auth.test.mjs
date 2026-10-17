import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createAdministratorVerifier} from '../auth-worker/verify.mjs';
import {createAuthHandler} from '../auth-worker/worker.mjs';
import {createAuthSession} from '../src/auth-session.js';

const {privateKey,publicKey}=await generateKeyPair('RS256');
const now=Math.floor(Date.now()/1000);
const env={FIREBASE_PROJECT_ID:'animus-b5c5d',ADMIN_EMAIL:'d2carpentryanddesign@gmail.com',ADMIN_UID:'owner-uid'};
const base={iss:'https://securetoken.google.com/animus-b5c5d',aud:'animus-b5c5d',sub:'owner-uid',iat:now-5,auth_time:now-10,exp:now+600,email:env.ADMIN_EMAIL,email_verified:true,firebase:{sign_in_provider:'google.com'}};
async function request(overrides={},options={}){
  const token=await new SignJWT({...base,...overrides}).setProtectedHeader({alg:'RS256',kid:'test-key'}).sign(options.key||privateKey);
  return new Request('https://auth.test/session',{method:'POST',headers:{Authorization:`Bearer ${token}`,Origin:'https://localhost',...options.headers}});
}
const verify=createAdministratorVerifier(()=>publicKey);
const handle=createAuthHandler(verify);
test('server verifies signed Firebase identity and requires pinned UID plus verified Google email',async()=>{
  const response=await handle(await request(),env);assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true,user:{uid:'owner-uid',email:env.ADMIN_EMAIL},role:'admin'});
  for(const change of [{sub:'another-uid'},{email:'other@gmail.com'},{email_verified:false},{firebase:{sign_in_provider:'password'}}])assert.equal((await handle(await request(change),env)).status,403);
});
test('invalid signatures, wrong project/issuer and expired or future-dated tokens are rejected',async()=>{
  const other=await generateKeyPair('RS256');
  assert.equal((await handle(await request({}, {key:other.privateKey}),env)).status,401);
  for(const change of [{aud:'other-project'},{aud:['animus-b5c5d','other']},{iss:'https://accounts.google.com'},{exp:now-1},{iat:now+600},{auth_time:now+600},{auth_time:now},{sub:''},{firebase:{sign_in_provider:'google.com',tenant:'other'}}])assert.equal((await handle(await request(change),env)).status,401);
});
test('missing identity configuration fails closed and never accepts a client email as proof',async()=>{
  assert.equal((await handle(await request(),{...env,ADMIN_UID:''})).status,503);
  assert.equal((await handle(new Request('https://auth.test/session',{method:'POST'}),env)).status,401);
  assert.equal((await handle(new Request('https://auth.test/session',{method:'POST',body:JSON.stringify({email:env.ADMIN_EMAIL})}),env)).status,400);
});
test('session service rejects untrusted origins/methods and returns no tokens or cacheable identity',async()=>{
  assert.equal((await handle(await request({}, {headers:{Origin:'https://evil.test'}}),env)).status,403);
  assert.equal((await handle(new Request('https://auth.test/session'),env)).status,405);
  const response=await handle(await request(),env);
  assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(response.headers.get('Access-Control-Allow-Origin'),'https://localhost');
  assert.ok(!(await response.text()).includes('Bearer'));
});
test('approved desktop origin can verify identity without admitting preview subdomains or lookalikes',async()=>{
  const origin='https://animus-v-1.pages.dev';
  const response=await handle(await request({}, {headers:{Origin:origin}}),env);
  assert.equal(response.status,200);assert.equal(response.headers.get('Access-Control-Allow-Origin'),origin);
  for(const Origin of ['http://animus-v-1.pages.dev','https://evil.animus-v-1.pages.dev','https://animus-v-1.pages.dev.evil.test','null'])assert.equal((await handle(await request({}, {headers:{Origin}}),env)).status,403);
});
test('Cloudflare zero-length POST streams reach authentication but nonempty bodies are rejected',async()=>{
  const headers=(await request()).headers;
  const empty=new Request('https://auth.test/session',{method:'POST',headers,body:new ReadableStream({start(c){c.close();}}),duplex:'half'});
  assert.equal((await handle(empty,env)).status,200);
  const data=new Request('https://auth.test/session',{method:'POST',headers,body:new ReadableStream({start(c){c.enqueue(new Uint8Array([1]));c.close();}}),duplex:'half'});
  assert.equal((await handle(data,env)).status,400);
});
test('Google certificate fetch uses Workers-supported manual redirects and rejects redirects',async(t)=>{
  let calls=0;
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    calls++;
    assert.equal(url,'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
    assert.equal(init.redirect,'manual');
    return new Response(null,{status:302,headers:{Location:'https://untrusted.test/certificates'}});
  });
  const warnings=[];
  t.mock.method(console,'warn',value=>warnings.push(JSON.parse(value)));
  const response=await createAuthHandler()(await request(),env);
  assert.equal(response.status,401);assert.equal(calls,1);
  assert.deepEqual(warnings,[{event:'administrator_token_rejected',reason:'TOKEN_VERIFICATION_FAILED'}]);
});
function provider(){return {getCurrentUser:async()=>({user:{uid:'owner-uid',email:env.ADMIN_EMAIL,emailVerified:true}}),signInWithGoogle:async()=>({user:{uid:'owner-uid',email:env.ADMIN_EMAIL,emailVerified:true}}),getIdToken:async()=>({token:'native-token'}),signOut:async()=>{}};}
test('native identity alone never implies administrator access or contacts CRM',async()=>{
  let calls=0;
  const session=createAuthSession({provider:provider(),fetcher:()=>{calls++;throw new Error('Unexpected request.');}});
  const state=await session.signIn();assert.equal(state.verified,null);assert.equal(state.user.email,env.ADMIN_EMAIL);assert.equal(calls,0);
  assert.equal((await session.signOut()).user,null);
});
test('native session uses only HTTPS header token and does not retain it in returned state',async()=>{
  const session=createAuthSession({provider:provider(),authUrl:'https://auth.test',fetcher:async(url,init)=>{
    assert.equal(url,'https://auth.test/session');assert.equal(init.headers.Authorization,'Bearer native-token');assert.equal(init.redirect,'error');
    return Response.json({ok:true,user:{uid:'owner-uid'},role:'admin'});
  }});
  assert.equal((await session.signIn()).verified.role,'admin');assert.ok(!JSON.stringify(session.snapshot()).includes('native-token'));
  assert.equal((await session.restore()).verified,null);
});
test('native denies failed, wrong-user and non-admin verification without discarding identity',async()=>{
  for(const result of [{ok:false},{ok:true,user:{uid:'other'},role:'admin'},{ok:true,user:{uid:'owner-uid'},role:'user'}]){
    const session=createAuthSession({provider:provider(),authUrl:'https://auth.test',fetcher:async()=>Response.json(result)});
    await assert.rejects(session.signIn(),/not confirmed/);assert.equal(session.snapshot().verified,null);assert.equal(session.snapshot().busy,false);
  }
});
