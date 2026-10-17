const origin='https://animus-v-1.pages.dev';
export function createCookieTransport({fetcher,ensureSession,promptSignIn,invalidate}) {
  return async (input,init)=>{
    const request=new Request(typeof input==='string'?new URL(input,origin):input,init);
    const url=new URL(request.url);
    if(url.origin!==origin||!url.pathname.startsWith('/api/')||url.pathname==='/api/session')return fetcher(input,init);
    const read=['GET','HEAD'].includes(request.method);
    let permitted=await ensureSession();
    if(!permitted&&read)permitted=await promptSignIn();
    if(!permitted){if(!read)void promptSignIn();return Response.json({ok:false,error:'Sign in again, then retry saving. Your entered data has not been discarded.'},{status:401});}
    const response=await fetcher(new Request(request,{credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'}));
    if(response.status===401){invalidate();void promptSignIn();}
    // Never replay a write after sign-in or a network error.
    return response;
  };
}
