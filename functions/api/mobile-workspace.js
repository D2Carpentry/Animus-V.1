import {applyMobileWorkspace} from './_mobile-workspace.js';
import {readFileReceipts} from './_expense-ledger.js';
const key='dashboard/latest.json';
const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function onRequest({request,env,data}){
  if(data?.animusIdentity?.role!=='admin')return reply({ok:false,error:'Administrator required.'},403);
  const bucket=env.ANIMUS_BUCKET;if(!bucket)return reply({ok:false,error:'Cloud storage unavailable.'},503);
  try{
    if(request.method==='GET'){
      const url=new URL(request.url);
      if(url.searchParams.get('context')==='estimate-revision'){
        const object=await bucket.get(key);if(!object)return reply({ok:false,error:'Current cloud dashboard unavailable.'},503);
        const current=JSON.parse(await object.text()),file=current.dashboardFiles?.find(file=>file.id===url.searchParams.get('fileId'));
        if(!file)return reply({ok:false,error:'Workfile not found.'},404);
        return reply({ok:true,lastSaveId:file.mobileDocumentSaveId||'',expected:{editableEstimate:file.editableEstimate??null,supplements:file.supplements??null,estimatePdfUrl:file.estimatePdfUrl??null,estimateTotal:file.estimateTotal??null}});
      }
      const document=new URL(request.url).searchParams.get('document')||'';
      if(!/^[a-f0-9-]{36}$/.test(document))return reply({ok:false,error:'Document not found.'},404);
      const object=await bucket.get(`documents/mobile/${document}.pdf`);if(!object)return reply({ok:false,error:'Document not found.'},404);
      return new Response(object.body,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="ANIMUS-document.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
    }
    if(request.method!=='POST')return reply({ok:false,error:'Method not allowed.'},405);
    const text=await request.text();if(text.length>18*1024*1024)return reply({ok:false,error:'Document is too large. Export a local copy and reduce the photos.'},413);
    const payload=JSON.parse(text);let pdf;
    if(payload.action==='saveDocument'){
      if(!/^[a-f0-9-]{36}$/.test(payload.saveId||''))return reply({ok:false,error:'Invalid save identifier.'},400);
      if(typeof payload.pdf!=='string'||!payload.pdf.startsWith('data:application/pdf;base64,'))return reply({ok:false,error:'PDF generation must finish before saving.'},400);
      const bytes=atob(payload.pdf.slice(28));if(!bytes.startsWith('%PDF-')||bytes.length>12*1024*1024)return reply({ok:false,error:'Invalid or oversized PDF.'},400);
      pdf=Uint8Array.from(bytes,c=>c.charCodeAt(0));delete payload.pdf;payload.pdfUrl=`https://animus-v-1.pages.dev/api/mobile-workspace?document=${payload.saveId}`;
      const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({id:payload.id,mode:payload.mode,makeCurrent:payload.makeCurrent===true,retainPrevious:payload.retainPrevious===true,document:payload.document})+bytes));payload.saveHash=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,'0')).join('');
    }
    // Read fresh on each retry, then compare-and-swap: never submit a phone's whole snapshot.
    for(let attempt=0;attempt<3;attempt++){
      const original=await bucket.get(key);if(!original)return reply({ok:false,error:'Current cloud dashboard unavailable.'},503);
      const current=JSON.parse(await original.text());
      delete payload.verifiedReceiptTotal;
      if(payload.action==='saveDocument'&&payload.retainPrevious!==true&&(payload.mode==='estimate'||payload.makeCurrent===true)&&!current.revenueRows?.some(row=>row.dashboardFileId===payload.id)){
        const file=current.dashboardFiles?.find(file=>file.id===payload.id);
        if(file)payload.verifiedReceiptTotal=(await readFileReceipts(bucket,file)).reduce((sum,entry)=>sum+entry.amount,0);
      }
      const result=applyMobileWorkspace(current,payload);
      if(result.replayed)return reply({ok:true,...result});
      const body=JSON.stringify(result.dashboard);
      if(new TextEncoder().encode(body).byteLength>32*1024*1024)return reply({ok:false,error:'The cloud snapshot is at its safe size limit. Your entries remain open. Export this document before closing and reduce its attached photos.'},413);
      if(pdf)await bucket.put(`documents/mobile/${payload.saveId}.pdf`,pdf,{httpMetadata:{contentType:'application/pdf'}});
      const saved=await bucket.put(key,body,{onlyIf:{etagMatches:original.etag},httpMetadata:{contentType:'application/json; charset=utf-8'}});
      if(saved)return reply({ok:true,...result});
    }
    return reply({ok:false,error:'Another device is saving. Your entries remain open; retry shortly.'},409);
  }catch(error){return reply({ok:false,error:error.message||'Cloud save did not finish. Your entries remain open.'},error.status||503);}
}
