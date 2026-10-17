import {createLiveAdministratorVerifier} from './live-administrator.mjs';

const allowedOrigins=new Set(['https://animus-v-1.pages.dev','https://localhost']);
const allowedMethods=['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'];
const allowedHeaders=['authorization','content-type','if-match','idempotency-key','x-animus-actor','x-animus-compact-response'];

function securityHeaders(origin) {
  const headers=new Headers({
    'Cache-Control':'private, no-store',
    'Pragma':'no-cache',
    'X-Content-Type-Options':'nosniff',
    'Vary':'Origin',
    'Access-Control-Expose-Headers':'ETag'
  });
  if(origin&&allowedOrigins.has(origin))headers.set('Access-Control-Allow-Origin',origin);
  return headers;
}

function failure(status,message,headers) {
  const output=new Headers(headers);
  output.set('Content-Type','application/json; charset=utf-8');
  if(status===401)output.set('WWW-Authenticate','Bearer');
  return new Response(JSON.stringify({ok:false,error:message}),{status,headers:output});
}

// Staging only: mount within the API subtree, never over UI routes.
export function createApiGuard(verify=createLiveAdministratorVerifier()) {
  return async function guard(context) {
    const {request,env}=context;
    const origin=request.headers.get('Origin');
    const headers=securityHeaders(origin);
    if(origin&&!allowedOrigins.has(origin))return failure(403,'Origin not allowed.',headers);
    if(!allowedMethods.includes(request.method))return failure(405,'Method not allowed.',headers);
    if(request.method==='OPTIONS') {
      const method=request.headers.get('Access-Control-Request-Method');
      const requested=(request.headers.get('Access-Control-Request-Headers')||'').toLowerCase().split(',').map(value=>value.trim()).filter(Boolean);
      if(!method||!allowedMethods.includes(method)||requested.some(value=>!allowedHeaders.includes(value)))return failure(403,'Preflight not allowed.',headers);
      headers.set('Access-Control-Allow-Methods',allowedMethods.join(', '));
      headers.set('Access-Control-Allow-Headers',allowedHeaders.join(', '));
      return new Response(null,{status:204,headers});
    }
    let user;
    try {
      user=await verify(request,env);
      if(user?.role!=='admin'||typeof user.uid!=='string'||!user.uid||typeof user.email!=='string'||!user.email)throw {status:403};
    } catch(error) {
      const status=[401,403,503].includes(error?.status)?error.status:503;
      const message=status===401?'Sign-in required.':status===403?'Administrator access required.':'Identity verification unavailable.';
      return failure(status,message,headers);
    }
    const principal=Object.freeze({uid:user.uid,email:user.email,role:'admin'});
    context.data??={};
    context.data.animusIdentity=principal;
    const forwardedHeaders=new Headers(request.headers);
    // Neither a client-supplied audit name nor a migration key grants authority.
    forwardedHeaders.set('X-Animus-Actor',principal.email);
    forwardedHeaders.delete('X-Animus-Migration-Key');
    forwardedHeaders.delete('Authorization');
    const response=await context.next(new Request(request,{headers:forwardedHeaders}));
    const secured=new Headers(response.headers);
    for(const name of [...secured.keys()])if(name.toLowerCase().startsWith('access-control-'))secured.delete(name);
    const vary=secured.get('Vary');
    for(const [name,value] of headers)secured.set(name,value);
    if(vary)secured.set('Vary',[...new Set([...vary.split(',').map(value=>value.trim()),'Origin'])].join(', '));
    return new Response(request.method==='HEAD'?null:response.body,{status:response.status,statusText:response.statusText,headers:secured});
  };
}
