const cloudOrigin='https://animus-v-1.pages.dev';
const privateQueryKeys=new Set(['token','id_token','access_token','authorization','api_key','apikey','secret']);
const mediaTypes=new Set(['application/pdf','image/jpeg','image/png','image/webp','image/gif']);

export class CrmAccessError extends Error {
  constructor(code,message,status=0) {super(message);this.name='CrmAccessError';this.code=code;this.status=status;}
}

function endpoint(value) {
  if(typeof value!=='string')throw new TypeError('Use a CRM API path.');
  const url=new URL(value,cloudOrigin);
  if(url.origin!==cloudOrigin||!url.pathname.startsWith('/api/')||url.username||url.password||url.hash)throw new CrmAccessError('unsafe-endpoint','Only ANIMUS cloud API requests are allowed.');
  for(const key of url.searchParams.keys())if(privateQueryKeys.has(key.toLowerCase()))throw new CrmAccessError('unsafe-endpoint','Sign-in credentials must not appear in links.');
  return url.href;
}

function waitFor(promise,signal) {
  return new Promise((resolve,reject)=>{
    const aborted=()=>reject(signal.reason);
    promise.then(value=>{signal.removeEventListener('abort',aborted);resolve(value);},error=>{signal.removeEventListener('abort',aborted);reject(error);});
    if(signal.aborted){reject(signal.reason);return;}
    signal.addEventListener('abort',aborted,{once:true});
  });
}

// Prepared shared client only; no live caller is switched to it yet.
export function createAuthenticatedClient({provider,fetcher=fetch,onSignInRequired=()=>{},objectUrls=URL,timeoutMs=30000}) {
  let generation=0;
  let owner=null;
  const active=new Set();
  const documents=new Set();
  function invalidate() {
    generation++;owner=null;
    for(const controller of active)controller.abort();
    for(const url of documents)objectUrls.revokeObjectURL(url);
    documents.clear();
  }
  function requireSignIn() {
    invalidate();
    try{onSignInRequired();}catch{ /* A UI callback must not bypass authentication. */ }
    return new CrmAccessError('sign-in-required','Sign in again. Your entered data has not been discarded.',401);
  }
  async function request(path,init={}) {
    const url=endpoint(path);
    const controller=new AbortController();
    const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(timeoutMs),...(init.signal?[init.signal]:[])]);
    active.add(controller);
    try {
      const {user}=await waitFor(provider.getCurrentUser(),signal);
      if(!user?.uid)throw requireSignIn();
      if(owner&&owner!==user.uid){invalidate();throw new CrmAccessError('account-changed','The account changed. Reopen the record before saving.');}
      owner=user.uid;
      const expected=generation;
      const {token}=await waitFor(provider.getIdToken({forceRefresh:false}),signal);
      const current=(await waitFor(provider.getCurrentUser(),signal)).user;
      if(expected!==generation||current?.uid!==user.uid){invalidate();throw new CrmAccessError('account-changed','The account changed. Reopen the record before saving.');}
      if(typeof token!=='string'||!token)throw requireSignIn();
      const headers=new Headers(init.headers);
      headers.set('Authorization',`Bearer ${token}`);
      headers.delete('X-Animus-Actor');headers.delete('X-Animus-Migration-Key');
      const response=await fetcher(url,{...init,headers,signal,credentials:'omit',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer'});
      if(expected!==generation)throw new CrmAccessError('account-changed','The account changed. Reopen the record before saving.');
      if(response.status===401)throw requireSignIn();
      if(response.status===403)throw new CrmAccessError('forbidden','Your account does not have access. Your entered data has not been discarded.',403);
      // Conflict and server responses stay intact for the canonical save handlers.
      return response;
    } catch(error) {
      if(error instanceof CrmAccessError)throw error;
      if(signal.aborted)throw new CrmAccessError('request-interrupted','The request was interrupted. Check the saved result before retrying; your entered data has not been discarded.');
      throw new CrmAccessError('request-failed','The cloud request could not finish. Check the saved result before retrying; your entered data has not been discarded.');
    } finally {active.delete(controller);}
  }
  async function loadDocument(path,{maxBytes=25*1024*1024,signal}={}) {
    if(!Number.isInteger(maxBytes)||maxBytes<1||maxBytes>64*1024*1024)throw new RangeError('Choose a document limit between 1 byte and 64 MB.');
    const controller=new AbortController();
    const combined=AbortSignal.any([controller.signal,AbortSignal.timeout(timeoutMs),...(signal?[signal]:[])]);
    active.add(controller);
    try {
      const expected=generation;
      const response=await request(path,{signal:combined});
      if(!response.ok)throw new CrmAccessError('document-unavailable','The document could not be opened.',response.status);
      const type=(response.headers.get('Content-Type')||'').split(';')[0].trim().toLowerCase();
      if(!mediaTypes.has(type)){await response.body?.cancel();throw new CrmAccessError('unsafe-document','This document type cannot be previewed.');}
      if(Number(response.headers.get('Content-Length'))>maxBytes){await response.body?.cancel();throw new CrmAccessError('document-too-large','The document is too large to preview.');}
      if(!response.body)throw new CrmAccessError('document-unavailable','The document is empty.');
      const reader=response.body.getReader();const chunks=[];let size=0;
      try {
        while(true) {
          if(expected!==generation||combined.aborted)throw new CrmAccessError('request-interrupted','Document loading was interrupted.');
          const {done,value}=await waitFor(reader.read(),combined);if(done)break;
          size+=value.byteLength;
          if(size>maxBytes)throw new CrmAccessError('document-too-large','The document is too large to preview.');
          chunks.push(value);
        }
        if(expected!==generation||combined.aborted)throw new CrmAccessError('request-interrupted','Document loading was interrupted.');
        if(!size)throw new CrmAccessError('document-unavailable','The document is empty.');
      } catch(error){await reader.cancel();if(combined.aborted)throw new CrmAccessError('request-interrupted','Document loading was interrupted.');throw error;}
      const url=objectUrls.createObjectURL(new Blob(chunks,{type}));documents.add(url);
      return {url,type,size,dispose(){if(documents.delete(url))objectUrls.revokeObjectURL(url);}};
    } finally {active.delete(controller);}
  }
  return {request,loadDocument,invalidate};
}
