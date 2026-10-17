import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {handle} from '../push-worker/worker.mjs';

async function environment() {
  const db=new DatabaseSync(':memory:');
  db.exec(await readFile(new URL('../push-worker/migrations/0001_devices.sql',import.meta.url),'utf8'));
  return {
    ADMIN_KEY:'a'.repeat(64), db,
    PUSH_DB:{prepare(sql){return {bind(...values){return {
      async run(){return db.prepare(sql).run(...values);},
      async first(){return db.prepare(sql).get(...values)||null;}
    };}};}}
  };
}
function req(path,method='GET',body,token,origin='https://localhost') {
  return new Request(`https://push.example${path}`,{method,headers:{'Origin':origin,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
test('push service fails closed until configured',async()=>{
  assert.equal((await handle(req('/admin/send','POST',{}),{})).status,503);
  const health=await (await handle(req('/health'),{})).json();assert.equal(health.firebaseConfigured,false);
});
test('admin and origin protection reject untrusted callers',async()=>{
  const env=await environment();
  assert.equal((await handle(req('/admin/pairing-codes','POST'),env)).status,401);
  assert.equal((await handle(req('/admin/pairing-codes','POST',null,env.ADMIN_KEY,'https://attacker.example'),env)).status,403);
  assert.equal((await handle(req('/anything','OPTIONS'),env)).headers.get('Access-Control-Allow-Origin'),'https://localhost');
  env.db.close();
});
test('pairing code is expiring and single-use, no raw credential stored in DB',async()=>{
  const env=await environment();
  const pair=await (await handle(req('/admin/pairing-codes','POST',null,env.ADMIN_KEY),env)).json();
  assert.equal(pair.code.length,64);
  const first=await handle(req('/pair','POST',{code:pair.code}),env);assert.equal(first.status,201);
  const device=await first.json();assert.equal(device.secret.length,64);
  assert.equal((await handle(req('/pair','POST',{code:pair.code}),env)).status,401);
  assert.notEqual(env.db.prepare('SELECT secret_hash FROM devices WHERE id=?').get(device.id).secret_hash,device.secret);
  assert.equal((await handle(req(`/devices/${device.id}`,'PUT',{token:'test-token-long-enough'},'wrong'),env)).status,401);
  assert.equal((await handle(req(`/devices/${device.id}`,'PUT',{token:'test-token-long-enough'},device.secret),env)).status,200);
  assert.equal((await handle(req(`/devices/${device.id}`,'DELETE',null,env.ADMIN_KEY),env)).status,200);
  assert.equal((await handle(req(`/devices/${device.id}`,'PUT',{token:'test-token-long-enough'},device.secret),env)).status,401);
  env.db.close();
});
test('expired codes and missing Firebase cannot send notifications',async()=>{
  const env=await environment();
  const pair=await (await handle(req('/admin/pairing-codes','POST',null,env.ADMIN_KEY),env)).json();
  env.db.exec('UPDATE pairing_codes SET expires_at=0');
  assert.equal((await handle(req('/pair','POST',{code:pair.code}),env)).status,401);
  assert.equal((await handle(req('/admin/send','POST',{type:'test'},env.ADMIN_KEY),env)).status,503);
  env.db.close();
});
test('oversized input is rejected before parsing',async()=>{
  const env=await environment();
  const result=await handle(req('/pair','POST',{code:'x'.repeat(9000)}),env);assert.equal(result.status,400);env.db.close();
});
test('paired phones can revoke themselves but cannot revoke another phone',async()=>{
  const env=await environment();
  const pair=await (await handle(req('/admin/pairing-codes','POST',null,env.ADMIN_KEY),env)).json();
  const device=await (await handle(req('/pair','POST',{code:pair.code}),env)).json();
  assert.equal((await handle(req(`/devices/${device.id}`,'DELETE',null,'bad-secret'),env)).status,401);
  assert.equal((await handle(req(`/devices/${device.id}`,'DELETE',null,device.secret),env)).status,200);
  env.db.close();
});
test('FCM sender signs a server-side OAuth assertion and sends only to a registered device',async()=>{
  const env=await environment();
  const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const privateKey=Buffer.from(await crypto.subtle.exportKey('pkcs8',keys.privateKey)).toString('base64');
  env.FCM_SERVICE_ACCOUNT=JSON.stringify({client_email:'test@preview.example',project_id:'preview-project',private_key:`-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----`});
  const pair=await (await handle(req('/admin/pairing-codes','POST',null,env.ADMIN_KEY),env)).json();
  const device=await (await handle(req('/pair','POST',{code:pair.code}),env)).json();
  await handle(req(`/devices/${device.id}`,'PUT',{token:'a-valid-dummy-token-for-tests'},device.secret),env);
  let calls=0;
  const transport=async(url,options)=>{
    calls++;
    if(url==='https://oauth2.googleapis.com/token'){
      const assertion=new URLSearchParams(options.body).get('assertion');const [head,body,sig]=assertion.split('.');
      assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',keys.publicKey,Buffer.from(sig,'base64url'),new TextEncoder().encode(`${head}.${body}`)),true);
      return Response.json({access_token:'mock-oauth-token',expires_in:3600});
    }
    assert.equal(url,'https://fcm.googleapis.com/v1/projects/preview-project/messages:send');
    assert.equal(options.headers.Authorization,'Bearer mock-oauth-token');
    const payload=JSON.parse(options.body);
    assert.equal(payload.message.token,'a-valid-dummy-token-for-tests');
    assert.equal(payload.message.android.notification.visibility,'PRIVATE');
    assert.equal(payload.message.data.fileId,'demo-work-1');
    assert.equal(payload.message.data.url,undefined);
    return Response.json({name:'projects/preview-project/messages/test-message'});
  };
  const sent=await handle(req('/admin/send','POST',{deviceId:device.id,type:'test',fileId:'demo-work-1',url:'https://attacker.example'},env.ADMIN_KEY),env,transport);
  assert.equal(sent.status,200);assert.equal(calls,2);
  env.db.close();
});
