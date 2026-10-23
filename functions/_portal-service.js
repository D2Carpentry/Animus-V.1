import {registerPortalVersion,customerWorkspace,adminWorkspace,portalSummary} from './_portal-workspace.js';
const ORIGIN='https://animus-v-1.pages.dev';
const prefix='portal/links/';
const headers={'Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const reply=(body,status=200,extra={})=>Response.json(body,{status,headers:{...headers,...extra}});
const error=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
const tokenValue=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');
const estimateFingerprint=file=>digest(JSON.stringify({estimate:file.editableEstimate||null,attachment:file.estimatePdfUrl||file.estimateUrl||file.editableEstimate?.pdfUrl||file.editableEstimate?.documentUrl||''}));
const pdfKeyFor=file=>{
  const value=file.estimatePdfUrl||file.estimateUrl||file.editableEstimate?.pdfUrl||file.editableEstimate?.documentUrl;
  if(!value)return '';
  let url;try{url=new URL(value);}catch{error('The attached estimate PDF must be imported before creating a portal link.',409);}
  if(url.origin!==ORIGIN||url.pathname!=='/api/mobile-workspace'||!/^[-a-f0-9]{36}$/.test(url.searchParams.get('document')||''))error('Import the existing estimate PDF before creating a portal link. The original attachment was not replaced.',409);
  return `documents/mobile/${url.searchParams.get('document')}.pdf`;
};
async function readBody(request,limit){
  if(Number(request.headers.get('Content-Length'))>limit)error('Request too large.',413);
  const reader=request.body?.getReader();if(!reader)error('Request required.');
  const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)error('Request too large.',413);chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{error('Invalid request.');}
}
async function currentFile(bucket,id){const object=await bucket.get('dashboard/latest.json');if(!object)error('Current CRM records are unavailable.',503);const data=typeof object.json==='function'?await object.json():JSON.parse(await object.text());const file=data.dashboardFiles?.find(file=>file.id===id);if(!file)error('Workfile not found.',404);return file;}
export async function onPortalAdmin({request,env,data}){
  if(data?.animusIdentity?.role!=='admin')return reply({ok:false,error:'Administrator required.'},403);
  const bucket=env.ANIMUS_BUCKET;if(!bucket)return reply({ok:false,error:'Cloud storage unavailable.'},503);
  try{
    if(request.method==='GET'){
      if(new URL(request.url).searchParams.get('summary')==='1')return reply({ok:true,...await portalSummary(bucket)});
      const id=new URL(request.url).searchParams.get('fileId');if(!id)error('Select a workfile.');
      const file=await currentFile(bucket,id);const estimateHash=await estimateFingerprint(file);
      const links=[];let cursor;
      do{const page=await bucket.list({prefix,limit:1000,cursor,include:['customMetadata']});for(const object of page.objects||[]){if(object.customMetadata?.fileId!==id)continue;links.push({id:object.key.slice(prefix.length,-5),createdAt:object.customMetadata.createdAt,expiresAt:object.customMetadata.expiresAt,revokedAt:object.customMetadata.revokedAt||''});}cursor=page.truncated?page.cursor:undefined;if(page.truncated&&!cursor)error('Link listing unavailable.',503);}while(cursor);
      return reply({ok:true,file:{id:file.id,clientName:file.clientName,fileNumber:file.fileNumber,estimateStatus:file.estimateStatus,editableEstimate:file.editableEstimate||null,hasAttachedPdf:Boolean(file.estimatePdfUrl||file.estimateUrl||file.editableEstimate?.pdfUrl||file.editableEstimate?.documentUrl)},estimateHash,links:links.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))});
    }
    if(request.method!=='POST')return reply({ok:false,error:'Method not allowed.'},405);
    const body=await readBody(request,36*1024*1024);
    const workspaceActions=new Set(['workspace','uploadAsset','adminAsset','adminDocument','publishDocument','streamUpload','streamStatus','streamPreview','streamDelete','videoUploadStart','videoUploadPart','videoUploadComplete','videoUploadCancel','videoPreview','videoArchiveHold','videoRestore','reply','requestStatus','publishUpdate','publishAsset','publishDesign','publishRecord','publishVideo','archive','milestone','updateMilestone','checklistItem','learningResource','reviewInvitation','selectionOption','markRead','settings']);
    if(workspaceActions.has(body.action)){
      const file=await currentFile(bucket,body.fileId);
      const result=await adminWorkspace({bucket,file,body,env,actor:data.animusIdentity.email||'Administrator'});
      return result instanceof Response?result:reply({ok:true,...result});
    }
    if(body.action==='revoke'){
      if(!/^[a-f0-9]{64}$/.test(body.id||''))error('Invalid link.');
      const object=await bucket.get(prefix+body.id+'.json');if(!object)error('Link not found.',404);
      const grant=JSON.parse(await object.text());grant.revokedAt=new Date().toISOString();
      const saved=await bucket.put(prefix+body.id+'.json',JSON.stringify(grant),{onlyIf:{etagMatches:object.etag},customMetadata:{fileId:grant.fileId,createdAt:grant.createdAt,expiresAt:grant.expiresAt,revokedAt:grant.revokedAt},httpMetadata:{contentType:'application/json'}});
      if(!saved)error('This link changed. Refresh before retrying.',409);return reply({ok:true});
    }
    if(body.action!=='create')error('Invalid operation.');
    const file=await currentFile(bucket,body.fileId);const hash=await estimateFingerprint(file);
    if(body.estimateHash!==hash)error('The saved estimate changed. Reopen sharing to use the latest copy.',409);
    const attached=pdfKeyFor(file);let pdf;
    if(attached){const object=await bucket.get(attached);if(!object||object.size>25*1024*1024)error('The attached PDF is unavailable. Nothing was shared.',409);pdf=new Uint8Array(await object.arrayBuffer());}
    else{
      if(!file.editableEstimate)error('Attach an estimate PDF before creating a link.',409);
      if(typeof body.pdf!=='string'||!body.pdf.startsWith('data:application/pdf;base64,'))error('The saved estimate PDF must finish rendering first.',409);
      try{pdf=Uint8Array.from(atob(body.pdf.slice(28)),char=>char.charCodeAt(0));}catch{error('The PDF could not be read.');}
    }
    if(!pdf?.length||pdf.length>12*1024*1024||new TextDecoder().decode(pdf.slice(0,5))!=='%PDF-')error('Invalid or oversized estimate PDF.');
    const expiresDays=Number(body.expiresDays??30);if(![7,14,30,60,90].includes(expiresDays))error('Choose a supported expiration.');
    const token=tokenValue();const id=await digest(token);const createdAt=new Date().toISOString();const expiresAt=new Date(Date.now()+expiresDays*86400000).toISOString();
    const key=`portal/documents/${id}.pdf`;await bucket.put(key,pdf,{httpMetadata:{contentType:'application/pdf'}});
    const grant={fileId:file.id,firstName:String(file.clientName||'').trim().split(/\s+/)[0]||'there',estimateId:String(file.editableEstimate?.estimateNumber||file.fileNumber||''),estimateStatus:String(file.estimateStatus||''),pdfKey:key,createdAt,expiresAt,revokedAt:''};
    if(body.projectAccess===true){
      const version=await registerPortalVersion(bucket,file,{id,hash,kind:'estimate',pdfKey:key,amount:file.editableEstimate?.totals?.total??file.estimateTotal,date:file.editableEstimate?.estimateDate||''});
      grant.projectAccess=true;grant.versionId=version.id;grant.customerId=id;
    }
    await bucket.put(prefix+id+'.json',JSON.stringify(grant),{customMetadata:{fileId:file.id,createdAt,expiresAt},httpMetadata:{contentType:'application/json'}});
    return reply({ok:true,id,url:`${ORIGIN}/client/#${token}`,expiresAt});
  }catch(cause){return reply({ok:false,error:cause.status?cause.message:'Portal sharing is temporarily unavailable. Your CRM records were not changed.'},cause.status||503);}
}
export function createPortalAccess({origin=ORIGIN,now=()=>Date.now()}={}){
  return async({request,env})=>{
    try{
      const url=new URL(request.url);
      const media=request.method==='GET'&&url.searchParams.has('video');
      if(request.method!=='POST'&&!media)return reply({ok:false,error:'Method not allowed.'},405);
      if(media){if([...url.searchParams.keys()].some(k=>!['video','accessId'].includes(k))||url.searchParams.getAll('video').length!==1||url.searchParams.getAll('accessId').length!==1||request.headers.get('Sec-Fetch-Site')&&request.headers.get('Sec-Fetch-Site')!=='same-origin'||request.headers.get('Origin')&&request.headers.get('Origin')!==origin)return reply({ok:false,error:'This request is not permitted.'},403);}
      else if(url.search||request.headers.get('Origin')!==origin)return reply({ok:false,error:'This request is not permitted.'},403);
      if(!media&&!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({ok:false,error:'Invalid request.'},400);
      const body=media?{action:'videoBytes',videoId:url.searchParams.get('video'),accessId:url.searchParams.get('accessId'),range:request.headers.get('Range')||''}:await readBody(request,9*1024*1024);
      if(['session','pdf'].includes(body.action)&&JSON.stringify(body).length>4096)error('Request too large.',413);
      if(!['session','pdf','project','document','asset','video','videoBytes','upload','message','request','approve','decline','checklist','appointment','selection','preferences','seen'].includes(body.action)||body.action==='videoBytes'&&!media)error('Invalid request.');
      const cookies=(request.headers.get('Cookie')||'').split(';').map(value=>value.trim()).filter(value=>value.startsWith('__Secure-d2-portal='));
      if(cookies.length>1)error('Reopen your private estimate link.',401);
      const token=body.action==='session'&&body.token?body.token:cookies[0]?.slice('__Secure-d2-portal='.length);
      if(typeof token!=='string'||!/^[-_a-zA-Z0-9]{43}$/.test(token))error('This private estimate link is invalid or has expired.',401);
      const id=await digest(token);const object=await env.ANIMUS_BUCKET.get(prefix+id+'.json');
      if(!object)error('This private estimate link is invalid or has expired.',401);
      const grant=JSON.parse(await object.text());
      if(grant.revokedAt||!Number.isFinite(Date.parse(grant.expiresAt))||Date.parse(grant.expiresAt)<=now())error('This private estimate link is invalid or has expired.',401);
      if(grant.pdfKey!==`portal/documents/${id}.pdf`)error('Estimate temporarily unavailable.',503);
      if(body.action==='session'){
        const maxAge=Math.max(1,Math.min(3600,Math.floor((Date.parse(grant.expiresAt)-now())/1000)));
        return reply({ok:true,firstName:grant.firstName,estimateTitle:'Your Estimate',accessId:id,...(grant.projectAccess?{projectAccess:true,versionId:grant.versionId}:{})},200,{'Set-Cookie':`__Secure-d2-portal=${token}; Path=/client-access; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`});
      }
      if(body.accessId!==id)error('Reopen the private link for this estimate.',401);
      if(body.action!=='pdf'){
        const file=await currentFile(env.ANIMUS_BUCKET,grant.fileId);
        const result=await customerWorkspace({bucket:env.ANIMUS_BUCKET,file,grant,accessId:id,body,env});
        return result instanceof Response?result:reply({ok:true,...result});
      }
      const pdf=await env.ANIMUS_BUCKET.get(grant.pdfKey);if(!pdf)error('Your estimate PDF is temporarily unavailable. Please try again or contact D2.',404);
      return new Response(pdf.body,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="D2-Estimate.pdf"','Content-Security-Policy':"sandbox; default-src 'none'"}});
    }catch(cause){return reply({ok:false,error:cause.status?cause.message:'Your estimate is temporarily unavailable. Please try again.'},cause.status||503);}
  };
}
