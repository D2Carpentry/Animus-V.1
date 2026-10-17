const CHANNEL = 'animus-updates';
const TYPES = new Set(['lead.created','estimate.opened','note.created','expense.saved','payment.updated','reminder','test']);
let oauth = null;
const hex = bytes => [...bytes].map(n=>n.toString(16).padStart(2,'0')).join('');
const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function hash(value) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))); }
async function equal(a,b) { const left=await hash(a||'');const right=await hash(b||'');let diff=0;for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);return diff===0; }
const bearer = request => (request.headers.get('Authorization')||'').replace(/^Bearer /,'');
function b64(value) { return btoa(typeof value==='string'?value:String.fromCharCode(...new Uint8Array(value))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
async function accessToken(env, transport) {
  const account=JSON.parse(env.FCM_SERVICE_ACCOUNT);
  const now=Math.floor(Date.now()/1000);
  if(oauth?.email===account.client_email&&oauth.expires>now+60)return {token:oauth.token, project:account.project_id};
  const head=b64(JSON.stringify({alg:'RS256',typ:'JWT'}));
  const claims=b64(JSON.stringify({iss:account.client_email,scope:'https://www.googleapis.com/auth/firebase.messaging',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600}));
  const bytes=Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g,'')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('pkcs8',bytes,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const unsigned=`${head}.${claims}`;
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned));
  const response=await transport('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:`${unsigned}.${b64(signature)}`})});
  const result=await response.json();if(!response.ok||!result.access_token)throw new Error('Firebase authorization failed.');
  oauth={email:account.client_email,token:result.access_token,expires:now+Number(result.expires_in||3600)};
  return {token:oauth.token,project:account.project_id};
}
async function jsonBody(request) {
  if(Number(request.headers.get('Content-Length')||0)>8192)throw new Error('Request too large.');
  const reader=request.body?.getReader();if(!reader)return {};
  let size=0;const chunks=[];
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>8192){await reader.cancel();throw new Error('Request too large.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handle(request,env,transport=fetch) {
  const origin=request.headers.get('Origin');
  const allowed=new Set((env.ALLOWED_ORIGINS||'https://localhost').split(',').map(s=>s.trim()));
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
  if(origin&&allowed.has(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'});
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(origin&&!allowed.has(origin))return reply({error:'Origin not allowed.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  const path=new URL(request.url).pathname;
  if(path==='/health'&&request.method==='GET')return reply({ok:true,firebaseConfigured:Boolean(env.FCM_SERVICE_ACCOUNT)});
  if(!env.PUSH_DB||!env.ADMIN_KEY||env.ADMIN_KEY.length<32)return reply({error:'Notification service is not configured.'},503);
  const isAdmin=await equal(bearer(request),env.ADMIN_KEY);
  try {
    if(path==='/admin/pairing-codes'&&request.method==='POST') {
      if(!isAdmin)return reply({error:'Unauthorized.'},401);
      const code=random();const expires=Date.now()+5*60000;
      await env.PUSH_DB.prepare('DELETE FROM pairing_codes WHERE expires_at < ?').bind(Date.now()).run();
      await env.PUSH_DB.prepare('INSERT INTO pairing_codes (code_hash, expires_at) VALUES (?, ?)').bind(await hash(code),expires).run();
      return reply({code,expiresAt:new Date(expires).toISOString()},201);
    }
    if(path==='/pair'&&request.method==='POST') {
      const body=await jsonBody(request);
      if(!/^[a-f0-9]{64}$/.test(body.code||''))return reply({error:'Pairing code is invalid or expired.'},401);
      // DELETE ... RETURNING consumes the code atomically, including concurrent requests.
      const row=await env.PUSH_DB.prepare('DELETE FROM pairing_codes WHERE code_hash = ? AND expires_at > ? RETURNING code_hash').bind(await hash(body.code),Date.now()).first();
      if(!row)return reply({error:'Pairing code is invalid or expired.'},401);
      const id=crypto.randomUUID();const secret=random();
      await env.PUSH_DB.prepare('INSERT INTO devices (id, secret_hash, created_at) VALUES (?, ?, ?)').bind(id,await hash(secret),new Date().toISOString()).run();
      return reply({id,secret},201);
    }
    const devicePath=path.match(/^\/devices\/([a-zA-Z0-9-]{1,80})$/);
    if(devicePath&&request.method==='PUT') {
      const device=await env.PUSH_DB.prepare('SELECT * FROM devices WHERE id = ?').bind(devicePath[1]).first();
      if(!device||!await equal(await hash(bearer(request)),device.secret_hash))return reply({error:'Unauthorized.'},401);
      const body=await jsonBody(request);
      if(typeof body.token!=='string'||body.token.length<20||body.token.length>4096)return reply({error:'Invalid device token.'},400);
      await env.PUSH_DB.prepare('UPDATE devices SET token = ?, updated_at = ? WHERE id = ?').bind(body.token,new Date().toISOString(),device.id).run();
      return reply({ok:true});
    }
    if(devicePath&&request.method==='DELETE') {
      const device=await env.PUSH_DB.prepare('SELECT * FROM devices WHERE id = ?').bind(devicePath[1]).first();
      if(!isAdmin&&(!device||!await equal(await hash(bearer(request)),device.secret_hash)))return reply({error:'Unauthorized.'},401);
      await env.PUSH_DB.prepare('DELETE FROM devices WHERE id = ?').bind(devicePath[1]).run();return reply({ok:true});
    }
    if(path==='/admin/send'&&request.method==='POST') {
      if(!isAdmin)return reply({error:'Unauthorized.'},401);
      if(!env.FCM_SERVICE_ACCOUNT)return reply({error:'Firebase is not configured.'},503);
      const body=await jsonBody(request);
      if(!TYPES.has(body.type))return reply({error:'Unsupported notification type.'},400);
      const device=await env.PUSH_DB.prepare('SELECT * FROM devices WHERE id = ?').bind(String(body.deviceId||'')).first();
      if(!device?.token)return reply({error:'Registered device not found.'},404);
      const data={type:body.type};
      if(body.fileId&&/^[a-zA-Z0-9_-]{1,160}$/.test(body.fileId))data.fileId=body.fileId;
      const auth=await accessToken(env,transport);
      const sent=await transport(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(auth.project)}/messages:send`,{method:'POST',headers:{'Authorization':`Bearer ${auth.token}`,'Content-Type':'application/json'},body:JSON.stringify({message:{token:device.token,notification:{title:String(body.title||'ANIMUS update').slice(0,80),body:String(body.body||'Open ANIMUS to review the update.').slice(0,200)},data,android:{priority:'high',notification:{channel_id:CHANNEL,icon:'ic_stat_animus',visibility:'PRIVATE'}}}})});
      const result=await sent.json();
      if(!sent.ok) {
        if(result.error?.details?.some(d=>d.errorCode==='UNREGISTERED'))await env.PUSH_DB.prepare('UPDATE devices SET token = NULL WHERE id = ?').bind(device.id).run();
        return reply({error:'Firebase did not accept this notification.'},502);
      }
      return reply({ok:true,messageId:result.name});
    }
    return reply({error:'Not found.'},404);
  } catch(error) {
    const invalid=error instanceof SyntaxError||error.message==='Request too large.';
    return reply({error:invalid?'Invalid notification request.':'Notification service failed. Please retry.'},invalid?400:503);
  }
}
export default {fetch(request,env) { return handle(request,env); }};
