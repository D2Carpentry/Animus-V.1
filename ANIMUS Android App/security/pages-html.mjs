import {createLiveAdministratorVerifier} from './live-administrator.mjs';
import {browserIdentityRequest} from './browser-session.mjs';

const publicFiles=new Set(['/signin','/signin/','/signin/index.html','/signin/sign-in.js','/signin/sign-in.css','/auth-preview','/auth-preview/','/auth-preview/index.html','/auth-preview/sign-in.js','/auth-preview/sign-in.css','/auth-preview/build-info.json','/crm-access.js','/assets/animus-sidebar-logo.png','/assets/animus-logo.svg','/icon.svg','/service-worker.js']);
export function publicAsset(path){return publicFiles.has(path)||/^\/downloads\/animus-android-(?:preview|live)-\d+\.\d+\.\d+\.apk$/.test(path);}

export function createPagesAccess({verify=createLiveAdministratorVerifier(),rewrite=response=>new HTMLRewriter().on('head',{element(element){element.prepend('<script src="/crm-access.js?v=20261017-secure"></script>',{html:true});}}).transform(response)}={}) {
  return async context=>{
    const {request}=context;const url=new URL(request.url);const path=url.pathname;
    if(path==='/api'||path.startsWith('/api/')||publicAsset(path))return context.next();
    try{await verify(browserIdentityRequest(request),context.env);}catch(error){
      const status=[401,403,503].includes(error.status)?error.status:503;
      if(status===401&&request.method==='GET'&&(request.headers.get('Accept')||'').includes('text/html')){
        const destination=new URL('/signin/',url.origin);destination.searchParams.set('returnTo',path);
        return new Response(null,{status:303,headers:{Location:destination.href,'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
      }
      return Response.json({ok:false,error:status===503?'Sign-in service unavailable. Please retry.':'Sign-in required.'},{status,headers:{'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer'}});
    }
    const response=await context.next();const headers=new Headers(response.headers);
    headers.set('Cache-Control','private, no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');
    headers.set('Cross-Origin-Opener-Policy','same-origin-allow-popups');headers.delete('ETag');
    if(!response.headers.get('Content-Type')?.includes('text/html'))return new Response(response.body,{status:response.status,headers});
    headers.delete('Content-Length');return rewrite(new Response(response.body,{status:response.status,headers}));
  };
}
export const onRequest=createPagesAccess();
