import {createAdministratorVerifier} from './verify.mjs';

// This service confirms identity only. It has no CRM bucket or database bindings.
export function createAuthHandler(verify=createAdministratorVerifier()) {
  return async function handle(request,env) {
    const origin=request.headers.get('Origin');
    const headers={'Cache-Control':'no-store','Content-Type':'application/json','Vary':'Origin','X-Content-Type-Options':'nosniff'};
    if(origin&&origin!=='https://localhost')return new Response(JSON.stringify({ok:false,error:'Origin not allowed.'}),{status:403,headers});
    if(origin)headers['Access-Control-Allow-Origin']=origin;
    const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers});
    const url=new URL(request.url);
    if(url.pathname!=='/session')return reply({ok:false,error:'Not found.'},404);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Authorization'}});
    if(request.method!=='POST')return reply({ok:false,error:'Method not allowed.'},405);
    // Cloudflare can expose a stream even for a zero-length POST body.
    if(request.body){
      const reader=request.body.getReader();
      const first=await reader.read();
      if(!first.done){await reader.cancel();return reply({ok:false,error:'Session requests do not accept a body.'},400);}
    }
    try {
      const user=await verify(request,env);
      return reply({ok:true,user:{uid:user.uid,email:user.email},role:user.role});
    }catch(error){return reply({ok:false,error:error.status?error.message:'Identity verification unavailable.'},error.status||503);}
  };
}
const handle=createAuthHandler();
export default {fetch(request,env){return handle(request,env);}};
