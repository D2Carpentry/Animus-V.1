import {createApiGuard} from './api-access.mjs';
import {createLiveAdministratorVerifier} from './live-administrator.mjs';
import {verifyBackupRequest} from './backup-access.mjs';
import {browserIdentityRequest,establishSessionCookie,clearSessionCookie,sameOriginSessionAction} from './browser-session.mjs';

function reply(data,status=200,headers={}){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});}
const maintenance=new Set(['/api/v2/migrate','/api/v2/migrate-chunk','/api/v2/migrate-finalize','/api/v2/verify']);

export function createLiveApi({verify=createLiveAdministratorVerifier(),verifyBackup=verifyBackupRequest}={}) {
  const guard=createApiGuard(verify,{verifyBackup});
  return async context=>{
    context.data??={};
    const {request}=context;const url=new URL(request.url);
    if(url.pathname==='/api/session'&&request.method==='DELETE') {
      if(!sameOriginSessionAction(request))return reply({ok:false,error:'Same-origin confirmation required.'},403);
      return reply({ok:true},200,{'Set-Cookie':clearSessionCookie()});
    }
    let authenticated;
    try{authenticated=browserIdentityRequest(request);}catch(error){return reply({ok:false,error:error.message},error.status||401);}
    const downstream=context.next.bind(context);
    return guard({...context,request:authenticated,next:async forwarded=>{
      const identity=context.data?.animusIdentity;
      if(url.pathname==='/api/session') {
        if(!['GET','POST'].includes(request.method))return reply({ok:false,error:'Method not allowed.'},405);
        if(url.search)return reply({ok:false,error:'Session links cannot contain parameters.'},400);
        if(request.method==='POST') {
          if(!request.headers.has('Authorization'))return reply({ok:false,error:'Fresh Google sign-in required.'},401);
          const reader=forwarded.body?.getReader();
          if(reader){const first=await reader.read();if(!first.done){await reader.cancel();return reply({ok:false,error:'Session requests do not accept a body.'},400);}}
          try{return reply({ok:true,user:identity},200,{'Set-Cookie':establishSessionCookie(request)});}catch(error){return reply({ok:false,error:error.message},error.status||503);}
        }
        return reply({ok:true,user:identity});
      }
      if(maintenance.has(url.pathname))return reply({ok:false,error:'Migration maintenance is not available through the CRM.'},403);
      return downstream(forwarded);
    }});
  };
}
