const encoder=new TextEncoder();
const canonicalOrigin='https://animus-v-1.pages.dev';
const body='{"action":"createCurrentCloudBackup"}';
const metadataQuery='?backups=list&limit=3';
const error=(status)=>Object.assign(new Error(status===503?'Backup authentication unavailable.':'Backup access denied.'),{status});
function secret(env){const value=env.ANIMUS_BACKUP_SECRET;if(typeof value!=='string'||!/^[-\w]{43,128}$/.test(value))throw error(503);return value;}
async function key(env){return crypto.subtle.importKey('raw',encoder.encode(secret(env)),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
function encode(bytes){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
function decode(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),char=>char.charCodeAt(0));}
function canonical(request,time,content){const url=new URL(request.url);return encoder.encode(`${time}\n${request.method}\n${url.origin}${url.pathname}${url.search}\n${content}`);}
async function permittedBody(request) {
  const url=new URL(request.url);
  if(url.origin!==canonicalOrigin||url.pathname!=='/api/dashboard'||request.headers.has('Origin'))throw error(403);
  if(request.method==='GET'&&url.search===metadataQuery)return '';
  if(request.method!=='POST'||url.search||request.headers.get('Content-Type')!=='application/json')throw error(403);
  // Read a bounded clone: the canonical handler must receive its untouched body.
  const reader=request.clone().body?.getReader();let content='';
  if(reader)try{while(true){const {done,value}=await reader.read();if(done)break;if(content.length+value.byteLength>128)throw error(403);content+=new TextDecoder().decode(value);}}finally{void reader.cancel().catch(()=>{});}
  if(content!==body)throw error(403);
  return content;
}

export async function signBackupRequest(env,{create=false,now=Date.now()}={}) {
  const request=new Request(canonicalOrigin+'/api/dashboard'+(create?'':metadataQuery),create?{method:'POST',headers:{'Content-Type':'application/json'},body}:{});
  const time=String(Math.floor(now/1000));
  const signature=encode(await crypto.subtle.sign('HMAC',await key(env),canonical(request,time,create?body:'')));
  const headers=new Headers(request.headers);headers.set('Authorization',`AnimusBackup ${time}.${signature}`);
  return new Request(request,{headers,redirect:'manual'});
}

export async function verifyBackupRequest(request,env,{now=Date.now()}={}) {
  const content=await permittedBody(request);
  const match=(request.headers.get('Authorization')||'').match(/^AnimusBackup (\d{10})\.([-\w]{43})$/);
  if(!match||Math.abs(Math.floor(now/1000)-Number(match[1]))>60)throw error(401);
  const valid=await crypto.subtle.verify('HMAC',await key(env),decode(match[2]),canonical(request,match[1],content));
  if(!valid)throw error(401);
  return {uid:'animus-weekly-backup',email:'backup-service@animus.internal',role:'backup'};
}
