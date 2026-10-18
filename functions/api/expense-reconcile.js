import {readFileReceipts,projectFileReceipts} from './_expense-ledger.js';
const key='dashboard/latest.json';
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
const esc=value=>String(value||'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export async function onRequest({request,env,data}){
  if(data?.animusIdentity?.role!=='admin')return reply({ok:false,error:'Administrator required.'},403);
  if(!['GET','POST'].includes(request.method))return reply({ok:false,error:'Method not allowed.'},405);
  try{
    const url=new URL(request.url);const payload=request.method==='POST'?await request.json():{};
    const id=String(payload.fileId||url.searchParams.get('fileId')||'');
    const original=await env.ANIMUS_BUCKET.get(key);if(!original)return reply({ok:false,error:'Current cloud dashboard unavailable.'},503);
    const raw=await original.text();const dashboard=JSON.parse(raw);
    const index=dashboard.dashboardFiles?.findIndex(file=>String(file.id)===id);if(!(index>=0))return reply({ok:false,error:'Current workfile not found.'},404);
    const file=dashboard.dashboardFiles[index];const entries=await readFileReceipts(env.ANIMUS_BUCKET,file);
    const total=entries.reduce((sum,entry)=>sum+entry.amount,0);
    if(request.method==='GET'){
      const preview={ok:true,fileId:id,name:file.clientName,fileNumber:file.fileNumber,receiptCount:entries.length,total,legacyTotal:(file.animusExpenseLedgerV4||[]).reduce((sum,entry)=>sum+(Number(entry.amount)||0),0)};
      if(url.searchParams.get('format')!=='html')return reply(preview);
      return new Response(`<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><title>ANIMUS Expense Reconciliation</title><style>body{background:#171b21;color:#eee;font:16px system-ui;padding:32px;max-width:700px;margin:auto}button{padding:16px;background:#2864ca;border:0;color:white;font:inherit}pre{white-space:pre-wrap}</style><h1>${esc(file.clientName)} · ${esc(file.fileNumber)}</h1><p>Verified cloud receipts: ${entries.length} · Total: $${total.toFixed(2)}</p><p>Old embedded ledger total: $${preview.legacyTotal.toFixed(2)}</p><p>A full recovery copy will be preserved before correcting this workfile. No receipt objects will be deleted.</p><button id="apply">Reconcile this workfile</button><pre id="result"></pre><script>document.querySelector('#apply').onclick=async()=>{const b=document.querySelector('#apply');b.disabled=true;try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({fileId:${JSON.stringify(id).replace(/</g,'\\u003c')},requireEmpty:true,preserveRecovery:true})});document.querySelector('#result').textContent=JSON.stringify(await r.json(),(key,value)=>['file','revenueRows'].includes(key)?undefined:value,2);}catch{document.querySelector('#result').textContent='Connection interrupted. Verify before retrying.';}finally{b.disabled=false;}};</script></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}});
    }
    if(payload.requireEmpty&&entries.length)return reply({ok:false,error:'Cloud receipts exist. No amounts were zeroed.'},409);
    const updated=projectFileReceipts(file,entries);dashboard.dashboardFiles[index]=updated;
    const rows=(dashboard.revenueRows||[]).filter(row=>row.dashboardFileId===id||(!row.dashboardFileId&&file.fileNumber&&row.fileNumber===file.fileNumber));
    for(const row of rows){row.expenses=total;row.expenseLines=updated.expenseLines;row.profit=(Number(row.gross)||0)-total-(Number(row.labor)||0);}
    let recoveryKey='';
    if(payload.preserveRecovery){
      recoveryKey='dashboard/recovery/'+new Date().toISOString().replace(/[:.]/g,'-')+'-expense-reconcile.json';
      const sha256=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));
      await env.ANIMUS_BUCKET.put(recoveryKey,raw,{sha256,httpMetadata:{contentType:'application/json'}});
      const copy=await env.ANIMUS_BUCKET.head(recoveryKey);
      if(!copy?.checksums?.sha256||!new Uint8Array(sha256).every((value,i)=>value===new Uint8Array(copy.checksums.sha256)[i]))throw Error('Recovery backup verification failed.');
    }
    const body=JSON.stringify(dashboard);
    const saved=await env.ANIMUS_BUCKET.put(key,body,{onlyIf:{etagMatches:original.etag},sha256:await crypto.subtle.digest('SHA-256',new TextEncoder().encode(body)),httpMetadata:{contentType:'application/json; charset=utf-8'}});
    if(!saved)return reply({ok:false,error:'A newer cloud save arrived. No correction was applied; retry.'},409);
    return reply({ok:true,fileId:id,total,receiptCount:entries.length,file:updated,revenueRows:rows,recoveryKey});
  }catch(error){return reply({ok:false,error:error.message||'Expense reconciliation failed. No verified zero total is available.'},503);}
}
