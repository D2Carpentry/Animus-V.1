// A completed request may update only the workfile workspace that initiated it.
export const portalEndpoint=()=>globalThis.window?.ANIMUS_APP_CONFIG?'https://animus-v-1.pages.dev/api/customer-portal':'/api/customer-portal';
export function createPortalTransport(snapshot,fetcher=fetch){
  return async(action,payload={},raw=false)=>{
    const scope=snapshot();
    if(!scope.fileId)throw Error('Open a workfile before changing its portal.');
    const response=await fetcher(portalEndpoint(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,fileId:scope.fileId,revision:scope.revision,action}),cache:'no-store',signal:AbortSignal.timeout(90000)});
    const current=()=>{const next=snapshot();if(next.fileId!==scope.fileId||next.generation!==scope.generation)throw Error('The workfile changed. Reopen its portal to refresh.');};
    current();
    if(!response.ok){let result;try{result=await response.json();}catch{}current();throw Object.assign(Error(result?.error||'The portal operation did not finish.'),{status:response.status});}
    if(raw)return response;
    const result=await response.json();current();return result;
  };
}
