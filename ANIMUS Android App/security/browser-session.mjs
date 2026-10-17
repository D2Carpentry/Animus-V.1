import {decodeJwt} from 'jose';

export const sessionCookie='__Host-animus';
const origin='https://animus-v-1.pages.dev';
const stateMethods=new Set(['POST','PUT','PATCH','DELETE']);
function denied(status,message){throw Object.assign(new Error(message),{status});}

export function browserIdentityRequest(request) {
  if(request.headers.has('Authorization'))return request;
  const entries=(request.headers.get('Cookie')||'').split(';').map(value=>value.trim()).filter(value=>value.startsWith(sessionCookie+'='));
  if(!entries.length)return request;
  if(entries.length!==1||new URL(request.url).origin!==origin)denied(401,'Sign-in required.');
  const site=request.headers.get('Sec-Fetch-Site');
  if(site&&!['same-origin','none'].includes(site))denied(403,'Cross-site session use is not allowed.');
  if(stateMethods.has(request.method)&&request.headers.get('Origin')!==origin)denied(403,'Same-origin confirmation required.');
  const token=entries[0].slice(sessionCookie.length+1);
  if(token.length>3800||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(token))denied(401,'Sign-in required.');
  const headers=new Headers(request.headers);headers.set('Authorization',`Bearer ${token}`);
  return new Request(request,{headers});
}

export function clearSessionCookie(){return `${sessionCookie}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;}

// Called only after a freshly submitted bearer token passes the live verifier.
export function establishSessionCookie(request) {
  if(new URL(request.url).origin!==origin||request.headers.get('Origin')!==origin)denied(403,'Same-origin confirmation required.');
  const token=(request.headers.get('Authorization')||'').slice(7);
  if(token.length>3800)denied(400,'The sign-in credential is too large.');
  const {exp}=decodeJwt(token);
  const seconds=Math.min(3600,exp-Math.floor(Date.now()/1000));
  if(!Number.isInteger(seconds)||seconds<=0)denied(401,'Sign-in expired.');
  return `${sessionCookie}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
}

export function sameOriginSessionAction(request) {
  return new URL(request.url).origin===origin&&request.headers.get('Origin')===origin;
}
