// Targeted document saves reuse the existing authenticated, compare-and-swap API.
(() => {
  let saving=false;
  // The desktop presentation normalizes file numbers; compare document content
  // without those associations, then submit the exact fresh cloud values for CAS.
  const comparable=value=>Array.isArray(value)?value.map(comparable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(key=>!['dashboardFileId','fileNumber','workFileNumber','estimateNumber'].includes(key)).map(key=>[key,key==='estimateTotal'?(Number(value[key])||0):comparable(value[key])])):value;
  window.addEventListener('message',async event=>{
    if(event.origin!==location.origin||event.source!==document.getElementById('crmEstimatorFrame')?.contentWindow||event.data?.type!=='animus-save-current-estimate')return;
    const message=event.data,opened=pendingEstimatorOpen;
    const reply=result=>event.source?.postMessage({type:'animus-current-estimate-result',requestId:message.requestId,saveId:message.saveId,...result},event.origin);
    if(saving){reply({ok:false,error:'A save is already in progress. Please wait.'});return;}
    if(!opened?.revisionExpected||opened.requestId!==message.requestId||opened.estimate?.dashboardFileId!==message.fileId){reply({ok:false,error:'Reopen this estimate from its workfile before saving. Your changes remain here.'});return;}
    const file=crmFiles.find(file=>file.id===message.fileId);
    if(!file){reply({ok:false,error:'This workfile is no longer open. Your changes remain here.'});return;}
    saving=true;
    try{
      const contextResponse=await fetch(`/api/mobile-workspace?context=estimate-revision&fileId=${encodeURIComponent(file.id)}`,{cache:'no-store',signal:AbortSignal.timeout(45000)});
      const context=await contextResponse.json();if(!contextResponse.ok||!context.ok)throw Error(context.error||'The current cloud estimate could not be verified.');
      if(context.lastSaveId!==message.saveId&&JSON.stringify(comparable(context.expected))!==JSON.stringify(comparable(opened.revisionExpected)))throw Error('This estimate changed on another device. Your edits remain here. Save a draft before reopening the current workfile.');
      const response=await fetch('/api/mobile-workspace',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',signal:AbortSignal.timeout(90000),body:JSON.stringify({action:'saveDocument',id:file.id,mode:message.asSupplement?'supplement':'estimate',makeCurrent:message.asSupplement===true,retainPrevious:true,saveId:message.saveId,document:message.document,pdf:message.pdf,expected:context.expected})});
      const result=await response.json();if(!response.ok||!result.ok)throw Error(result.error||'The cloud did not confirm this save.');
      // Merge only this freshly confirmed record and its reporting rows, never a browser snapshot.
      Object.assign(file,result.record);
      for(const saved of result.dashboard.revenueRows||[]){if(saved.dashboardFileId!==file.id&&!(saved.fileNumber===file.fileNumber&&!saved.dashboardFileId))continue;const index=crmRevenueRows.findIndex(row=>row.id===saved.id);if(index<0)crmRevenueRows.push(saved);else crmRevenueRows[index]=saved;}
      saveCrmFiles({syncExpenses:false});
      try{localStorage.setItem(CRM_REVENUE_STORAGE_KEY,JSON.stringify(crmRevenueRows));}catch(_){}
      rememberCloudSync(result.dashboard);
      opened.estimate=file.editableEstimate;
      opened.revisionExpected=JSON.parse(JSON.stringify({editableEstimate:file.editableEstimate??null,supplements:file.supplements??null,estimatePdfUrl:file.estimatePdfUrl??null,estimateTotal:file.estimateTotal??null}));
      opened.revisionContext={nextSupplementNumber:`${file.fileNumber}-S${(file.supplements?.length||0)+1}`};
      reply({ok:true,revisionContext:opened.revisionContext});
      showDashboardSaveStatus(message.asSupplement?'Supplement saved as the current estimate.':'Current estimate saved to Cloudflare.');
    }catch(error){reply({ok:false,error:error.message||'Save failed. Your changes remain open.'});}
    finally{saving=false;}
  });
})();
