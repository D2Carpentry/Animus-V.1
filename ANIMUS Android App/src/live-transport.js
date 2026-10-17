const origin='https://animus-v-1.pages.dev';
export function createLiveTransport({client,fetcher,ready,verified,onSignInRequired}) {
  return async(input,init)=>{
    const url=new URL(typeof input==='string'?input:input.url,'https://localhost');
    if(url.origin!==origin||!url.pathname.startsWith('/api/'))return fetcher(input,init);
    await ready;
    if(!verified()){onSignInRequired();throw Error('Sign in and verify administrator access before loading or saving CRM records.');}
    if(input instanceof Request){const request=new Request(input,init);return client.request(url.href,{method:request.method,headers:request.headers,signal:request.signal,...(!['GET','HEAD'].includes(request.method)?{body:request.body,duplex:'half'}:{})});}
    return client.request(url.href,init);
  };
}

export function mountPrivateImages({root,client,onError=()=>{}}) {
  const active=new Map();let stopped=false;
  function scan(){
    for(const [image,entry] of active)if(!image.isConnected){entry.document?.dispose();active.delete(image);}
    for(const image of root.querySelectorAll('img[src]')){
      const url=new URL(image.getAttribute('src'),'https://animus-v-1.pages.dev');
      if(url.origin!=='https://animus-v-1.pages.dev'||url.pathname!=='/api/expenses')continue;
      const previous=active.get(image);if(previous?.source===url.href)continue;
      previous?.document?.dispose();
      const entry={source:url.href,document:null};active.set(image,entry);image.removeAttribute('src');
      void client.loadDocument(url.href).then(document=>{
        if(stopped||!image.isConnected||active.get(image)!==entry){document.dispose();return;}
        entry.document=document;image.src=document.url;
      }).catch(()=>{if(image.isConnected){image.alt='Receipt image unavailable. Sign in and reopen this receipt.';onError();}});
    }
  }
  const observer=new MutationObserver(scan);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});scan();
  return ()=>{stopped=true;observer.disconnect();for(const entry of active.values())entry.document?.dispose();active.clear();};
}
