window.AnimusPortalPdf={
  async create(data){
    const timers=[];
    const timeout=(message,ms)=>new Promise((_,reject)=>timers.push(setTimeout(()=>reject(Error(message)),ms)));
    const frame=document.createElement('iframe');frame.title='Private estimate render copy';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;frame.style.cssText='position:fixed;left:0;top:0;width:1000px;height:1200px;border:0;opacity:0;pointer-events:none;z-index:-1;';
    const status=text=>window.dispatchEvent(new CustomEvent('d2-render-status',{detail:text}));
    try{
      const loaded=new Promise((resolve,reject)=>{frame.onload=resolve;frame.onerror=()=>reject(Error('The estimate renderer could not load.'));});
      frame.src=new URL('portal-estimate-renderer.html?standard=1&open=portal-saved',document.baseURI).href;document.body.append(frame);
      status('Preparing the estimate layout...');
      await Promise.race([loaded,timeout('The estimate renderer took too long. Retry.',30000)]);
      if(!frame.contentWindow.AnimusPortalRenderer)throw Error('The estimate renderer is unavailable. Sign in again and retry.');
      status('Creating the estimate PDF...');
      const pdf=await Promise.race([frame.contentWindow.AnimusPortalRenderer.create(structuredClone(data)),timeout('PDF preparation took too long. Please retry.',90000)]);
      // Copy the bytes before disposing the iframe; its Blob promises belong to that realm.
      const bytes=await Promise.race([pdf.arrayBuffer(),timeout('The PDF could not be transferred. Please retry.',15000)]);
      return new Blob([bytes],{type:'application/pdf'});
    }finally{timers.forEach(clearTimeout);frame.remove();}
  }
};
