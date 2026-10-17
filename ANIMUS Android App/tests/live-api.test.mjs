import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveApi} from '../security/live-api.mjs';
import {browserIdentityRequest,establishSessionCookie} from '../security/browser-session.mjs';
import {signBackupRequest,verifyBackupRequest} from '../security/backup-access.mjs';
const origin='https://animus-v-1.pages.dev';
const env={ANIMUS_BACKUP_SECRET:'x'.repeat(43)};
const claims={exp:Math.floor(Date.now()/1000)+1800,auth_time:Math.floor(Date.now()/1000)};
const token='e30.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
const identity={uid:'synthetic',email:'owner@example.test',role:'admin'};
const verify=async request=>{if(request.headers.get('Authorization')!==`Bearer ${token}`)throw {status:401};return identity;};
const middleware=createLiveApi({verify});
function context(request,next=()=>Response.json({ok:true})){return {request,env,data:{},next};}

test('browser session exchange sets a bounded Host-only Secure HttpOnly SameSite cookie and returns no token',async()=>{
  const input=new Request(origin+'/api/session',{method:'POST',headers:{Origin:origin,Authorization:`Bearer ${token}`}});
  const response=await middleware(context(input,()=>assert.fail('Session reached CRM storage')));
  assert.equal(response.status,200);const cookie=response.headers.get('Set-Cookie');
  for(const part of ['__Host-animus=','Path=/','HttpOnly','Secure','SameSite=Strict','Max-Age='])assert.ok(cookie.includes(part));
  assert.ok(!cookie.includes('Domain='));assert.ok(!JSON.stringify(await response.json()).includes(token));
  const text=establishSessionCookie(input);assert.ok(Number(text.split('Max-Age=')[1])<=1800);
});
test('session exchange denies cookie-only renewal, cross-origin login and nonempty bodies',async()=>{
  for(const [headers,body,status] of [
    [{Cookie:`__Host-animus=${token}`,Origin:origin},undefined,401],
    [{Authorization:`Bearer ${token}`,Origin:'https://evil.test'},undefined,403],
    [{Authorization:`Bearer ${token}`,Origin:origin},'unexpected',400]
  ])assert.equal((await middleware(context(new Request(origin+'/api/session',{method:'POST',headers,body})))).status,status);
});
test('cookie-authenticated CRM preserves canonical bodies and strips credentials before storage',async()=>{
  const body=JSON.stringify({action:'mobileFilePatch',fileId:'test',changes:{notes:[]}});
  const ctx=context(new Request(origin+'/api/dashboard',{method:'POST',headers:{Cookie:`__Host-animus=${token}`,Origin:origin,'Sec-Fetch-Site':'same-origin'},body}),async request=>{
    assert.equal(await request.text(),body);assert.equal(request.headers.get('Cookie'),null);assert.equal(request.headers.get('Authorization'),null);assert.equal(request.headers.get('X-Animus-Actor'),identity.email);return Response.json({ok:true});
  });
  assert.equal((await middleware(ctx)).status,200);assert.deepEqual(ctx.data.animusIdentity,identity);
});
test('cookie mutation requires exact same origin; cross-site reads, duplicate cookies and host aliases fail closed',async()=>{
  for(const input of [
    new Request(origin+'/api/dashboard',{method:'POST',headers:{Cookie:`__Host-animus=${token}`},body:'{}'}),
    new Request(origin+'/api/dashboard',{headers:{Cookie:`__Host-animus=${token}`,'Sec-Fetch-Site':'cross-site'}}),
    new Request(origin+'/api/dashboard',{headers:{Cookie:`__Host-animus=${token}; __Host-animus=${token}`}}),
    new Request('https://preview.pages.dev/api/dashboard',{headers:{Cookie:`__Host-animus=${token}`}})
  ])assert.throws(()=>browserIdentityRequest(input));
});
test('session sign-out clears cookie without storage access but rejects cross-site requests',async()=>{
  for(const [requestOrigin,status] of [[origin,200],['https://evil.test',403]]) {
    const response=await middleware(context(new Request(origin+'/api/session',{method:'DELETE',headers:{Origin:requestOrigin}}),()=>assert.fail('Logout reached storage')));
    assert.equal(response.status,status);if(status===200)assert.ok(response.headers.get('Set-Cookie').endsWith('Max-Age=0'));
  }
});
test('backup signature permits only exact metadata listing and current-copy creation, without an admin grant',async()=>{
  for(const create of [false,true]) {
    const input=await signBackupRequest(env,{create});const principal=await verifyBackupRequest(input,env);
    assert.equal(principal.role,'backup');
    const ctx=context(input,async request=>{assert.equal(request.headers.get('Authorization'),null);if(create)assert.deepEqual(await request.json(),{action:'createCurrentCloudBackup'});return Response.json({ok:true});});
    assert.equal((await middleware(ctx)).status,200);assert.equal(ctx.data.animusIdentity.role,'backup');
  }
});
test('backup key cannot read CRM, fetch snapshots, restore records, modify revenue or access extraction/v2',async()=>{
  const signed=await signBackupRequest(env);
  for(const path of ['/api/dashboard','/api/dashboard?backups=list&limit=100','/api/dashboard?backup=dashboard/backups/test.json','/api/expenses?fileId=test','/api/receipt','/api/v2/workfiles','/api/session']) {
    const response=await middleware(context(new Request(origin+path,{headers:signed.headers}),()=>assert.fail('Service exceeded scope')));
    assert.equal(response.status,403,path);
  }
  const write=await signBackupRequest(env,{create:true});
  for(const body of ['{"action":"revenueUpdate"}','{"action":"createCurrentCloudBackup","extra":true}','x'.repeat(1000)]) {
    const response=await middleware(context(new Request(write.url,{method:'POST',headers:write.headers,body}),()=>assert.fail('Service mutated CRM')));assert.equal(response.status,403);
  }
});
test('backup requests reject tampering, expiry, browser origins and missing server configuration',async()=>{
  const signed=await signBackupRequest(env);
  await assert.rejects(verifyBackupRequest(signed,{ANIMUS_BACKUP_SECRET:'y'.repeat(43)}),error=>error.status===401);
  await assert.rejects(verifyBackupRequest(signed,env,{now:Date.now()+120000}),error=>error.status===401);
  const headers=new Headers(signed.headers);headers.set('Origin',origin);
  await assert.rejects(verifyBackupRequest(new Request(signed,{headers}),env),error=>error.status===403);
  await assert.rejects(verifyBackupRequest(signed,{}),error=>error.status===503);
});
test('migration maintenance remains unavailable through live CRM even for an administrator',async()=>{
  for(const path of ['migrate','migrate-chunk','migrate-finalize','verify']) {
    const response=await middleware(context(new Request(origin+'/api/v2/'+path,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:'{}'}),()=>assert.fail('Live migration')));assert.equal(response.status,403);
  }
});
