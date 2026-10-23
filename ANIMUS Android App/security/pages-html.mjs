import {createLiveAdministratorVerifier} from './live-administrator.mjs';
import {browserIdentityRequest} from './browser-session.mjs';

const publicFiles=new Set(['/signin','/signin/','/signin/index.html','/signin/sign-in.js','/signin/sign-in.css','/auth-preview','/auth-preview/','/auth-preview/index.html','/auth-preview/sign-in.js','/auth-preview/sign-in.css','/auth-preview/build-info.json','/crm-access.js','/assets/animus-sidebar-logo.png','/assets/animus-logo.svg','/icon.svg','/service-worker.js']);
const portalFiles=new Set(['/client','/client/','/client/index.html','/client/portal.css','/client/project.css','/client/project-layout.css','/client/portal.bundle.js','/client/model-viewer.bundle.js','/client/stream-player.js','/client/d2-logo.png','/client/pdf.mjs','/client/pdf.worker.mjs','/client-access']);
export function publicAsset(path){return publicFiles.has(path)||portalFiles.has(path)||/^\/downloads\/animus-android-(?:preview|live)-\d+\.\d+\.\d+\.apk$/.test(path);}

export function createPagesAccess({verify=createLiveAdministratorVerifier(),rewrite=response=>new HTMLRewriter().on('head',{element(element){element.prepend('<script src="/crm-access.js?v=20261017-secure"></script>',{html:true});}}).transform(response)}={}) {
  return async context=>{
    const {request}=context;const url=new URL(request.url);const path=url.pathname;
    if(portalFiles.has(path)){
      const response=await context.next();const headers=new Headers(response.headers);
      headers.set('Cache-Control','private, no-store');headers.set('Referrer-Policy','no-referrer');headers.set('X-Content-Type-Options','nosniff');headers.set('X-Frame-Options','DENY');
      headers.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self' data: blob:; frame-src https://iframe.videodelivery.net; worker-src 'self' blob:; font-src 'self' blob: data:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
      headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
      return new Response(response.body,{status:response.status,headers});
    }
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
