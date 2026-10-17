import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {createAdministratorVerifier} from '../auth-worker/verify.mjs';
import {createLiveAdministratorVerifier} from '../security/live-administrator.mjs';
import {createApiGuard} from '../security/api-access.mjs';

const {privateKey,publicKey}=await generateKeyPair('RS256');
const now=Math.floor(Date.now()/1000);
const env={FIREBASE_PROJECT_ID:'animus-b5c5d',ADMIN_UID:'synthetic-owner',ADMIN_EMAIL:'owner@example.test',FIREBASE_WEB_API_KEY:'AIza'+'x'.repeat(35)};
const identityVerifier=createAdministratorVerifier(()=>publicKey);
async function request(claims={}) {
  const jwt=await new SignJWT({email:env.ADMIN_EMAIL,email_verified:true,auth_time:now-20,firebase:{sign_in_provider:'google.com'},...claims})
    .setSubject(env.ADMIN_UID).setIssuer('https://securetoken.google.com/animus-b5c5d').setAudience('animus-b5c5d')
    .setIssuedAt(now-10).setExpirationTime(now+600).setProtectedHeader({alg:'RS256',kid:'synthetic'}).sign(privateKey);
  return new Request('https://animus-v-1.pages.dev/api/dashboard',{headers:{Authorization:`Bearer ${jwt}`}});
}
const account={localId:env.ADMIN_UID,email:env.ADMIN_EMAIL,emailVerified:true,validSince:String(now-30)};
const verifier=fetcher=>createLiveAdministratorVerifier({verifyIdentity:identityVerifier,fetcher});
const rejects=(promise,status)=>assert.rejects(promise,error=>error.status===status);

test('live identity checks Google after signature verification and never forwards credentials to another host',async()=>{
  const input=await request();let calls=0;
  const verify=verifier(async(url,options)=>{
    calls++;assert.equal(new URL(url).origin,'https://identitytoolkit.googleapis.com');
    assert.equal(new URL(url).pathname,'/v1/accounts:lookup');assert.equal(new URL(url).searchParams.get('key'),env.FIREBASE_WEB_API_KEY);
    assert.equal(options.method,'POST');assert.equal(options.redirect,'manual');assert.equal(options.cache,'no-store');
    assert.equal(JSON.parse(options.body).idToken,input.headers.get('Authorization').slice(7));
    return Response.json({users:[account]});
  });
  assert.deepEqual(await verify(input,env),{uid:env.ADMIN_UID,email:env.ADMIN_EMAIL,role:'admin'});assert.equal(calls,1);
  await rejects(verify(new Request(input.url),env),401);assert.equal(calls,1);
});
test('disabled, deleted, revoked and mismatched accounts never reach canonical CRM handlers',async()=>{
  for(const data of [{users:[]},{users:[{...account,disabled:true}]},{users:[{...account,validSince:String(now-15)}]},{users:[{...account,localId:'other-owner'}]},{users:[{...account,emailVerified:false}]},{users:[{...account,email:'other@example.test'}]}]) {
    const guard=createApiGuard(verifier(async()=>Response.json(data)));
    const response=await guard({request:await request(),env,data:{},next:()=>assert.fail('Revoked account reached storage')});
    assert.equal(response.status,401);
  }
});
test('Google token rejection is denied without exposing provider diagnostics',async()=>{
  for(const reason of ['TOKEN_EXPIRED','USER_DISABLED','USER_NOT_FOUND','INVALID_ID_TOKEN'])await rejects(verifier(async()=>Response.json({error:{message:reason}},{status:400}))(await request(),env),401);
  for(const reason of ['API_KEY_INVALID','QUOTA_EXCEEDED'])await rejects(verifier(async()=>Response.json({error:{message:reason}},{status:400}))(await request(),env),503);
});
test('missing configuration, malformed status, outages and redirects fail closed',async()=>{
  await rejects(verifier(()=>assert.fail('Unconfigured request'))(await request(),{...env,FIREBASE_WEB_API_KEY:''}),503);
  for(const fetcher of [async()=>{throw Error('private transport detail');},async()=>new Response('',{status:302,headers:{Location:'https://evil.test'}}),async()=>new Response('not-json'),async()=>Response.json({users:[{...account,validSince:'invalid'}]}),async()=>Response.json({users:[{...account,disabled:'false'}]})]) {
    const guard=createApiGuard(verifier(fetcher));const response=await guard({request:await request(),env,next:()=>assert.fail('Status failure reached storage')});
    assert.equal(response.status,503);assert.equal((await response.json()).error,'Identity verification unavailable.');
  }
});
test('account status is rechecked on each request rather than cached past revocation',async()=>{
  let calls=0;const verify=verifier(async()=>Response.json({users:[{...account,disabled:++calls>1}]}));
  await verify(await request(),env);await rejects(verify(await request(),env),401);assert.equal(calls,2);
});
