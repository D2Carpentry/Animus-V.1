/* Private, workfile-linked portal content. Never mirrors or replaces CRM records. */
import {r2VideoAction,r2VideoResponse} from './_portal-video.js';
const ORIGIN='https://animus-v-1.pages.dev';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const text=(value,max=4000)=>{if(typeof value!=='string'||value.length>max)fail('Check the text length.');return value.trim();};
const id=value=>{if(typeof value!=='string'||!/^[-a-zA-Z0-9_]{1,180}$/.test(value))fail('Invalid record identifier.');return value;};
const stamp=()=>new Date().toISOString();
const num=value=>{const n=Number(value);return Number.isFinite(n)?n:0;};
const key=fileId=>`portal/workfiles/${encodeURIComponent(fileId)}/state.json`;
const blank=fileId=>({schema:1,fileId,revision:0,versions:[],designs:[],videos:[],assets:[],messages:[],requests:[],updates:[],milestones:[],selections:[],checklist:[],resources:[],approvals:[],events:[],receipts:[],rates:{},stats:{views:{}},settings:{},preferences:{email:false,sms:false}});
export const portalCategories=['Property Access','Gate Codes','Parking','Pets','Scheduling Preferences','Installation Instructions','Design Preferences','Property Protection','Other'];
export async function portalState(bucket,fileId){const object=await bucket.get(key(fileId));return {state:object?{...blank(fileId),...JSON.parse(await object.text())}:blank(fileId),etag:object?.etag};}
async function mutate(bucket,fileId,fn){
  for(let attempt=0;attempt<4;attempt++){
    const {state,etag}=await portalState(bucket,fileId);const result=await fn(state);
    if(result?.unchanged)return result.value;
    state.revision++;state.updatedAt=stamp();
    if(JSON.stringify(state).length>3*1024*1024)fail('This portal needs archival before adding more content.',409);
    const saved=await bucket.put(key(fileId),JSON.stringify(state),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'},customMetadata:{fileId,updatedAt:state.updatedAt},httpMetadata:{contentType:'application/json'}});
    if(saved)return result;
  }
  fail('Another update arrived. Refresh and try again.',409);
}
export {mutate as mutatePortalState};
const record=(state,type,label,extra={})=>{const event={id:crypto.randomUUID(),type,label,at:stamp(),...extra};state.events.push(event);if(state.events.length>1000)state.events.splice(0,state.events.length-1000);return event;};
const paid=file=>file.totalPaidOverride!==''&&file.totalPaidOverride!=null?Math.max(0,num(file.totalPaidOverride)):0;
const done=request=>['Resolved','Declined','Acknowledged'].includes(request.status);
function safeEstimate(estimate={}){
  const source=Array.isArray(estimate.lineItems)?estimate.lineItems:[];
  return source.slice(0,1000).map((line,index)=>({id:`line-${index}`,type:String(line.type||'item'),description:String(line.description||line.name||line.text||'').slice(0,12000),qty:line.qty===''||line.qty==null?'':num(line.qty),price:line.unitPrice===''||line.unitPrice==null?'':num(line.unitPrice),total:line.total===''||line.total==null?'':num(line.total)}));
}
export async function registerPortalVersion(bucket,file,document){
  return mutate(bucket,file.id,state=>{
    const existing=state.versions.find(v=>v.hash===document.hash&&v.kind===document.kind);
    if(existing)return {unchanged:true,value:existing};
    const sequence=state.versions.filter(v=>v.kind===document.kind).length+1;
    const version={id:document.id,kind:document.kind||'estimate',sequence,title:document.title||`Estimate V${sequence}`,hash:document.hash,pdfKey:document.pdfKey,amount:num(document.amount??file.estimateTotal),date:document.date||'',items:safeEstimate(file.editableEstimate),publishedAt:stamp(),status:'Published for Review'};
    state.versions.push(version);record(state,'document.published',`${version.title} published`,{versionId:version.id});return version;
  });
}
function appointments(file){
  return [['inspection','Appointment',file.inspectionDate,file.inspectionTime],['start','Project start',file.startDate,''],['completion','Estimated completion',file.anticipatedCompletionDate,'']].filter(([, ,date])=>/^\d{4}-\d{2}-\d{2}$/.test(date||'')).map(([id,title,date,time])=>({id,title,date,time,estimated:id==='completion',instructions:String(file.preparationInstructions||'').slice(0,4000)}));
}
function visibleVersion(state,versionId){return state.versions.find(v=>v.id===versionId&&!v.withdrawnAt);}
function publicAsset(asset){return {id:asset.id,name:asset.name,type:asset.type,category:asset.category,description:asset.description||'',version:asset.version||'',createdAt:asset.createdAt,uploadedBy:asset.uploadedBy};}
function projectViewBase(file,state,grant){
  const versions=state.versions.filter(v=>!v.withdrawnAt).map(({pdfKey,hash,...v})=>v);
  const designs=state.designs.filter(d=>d.publishedAt&&!d.archivedAt).map(({internalNotes,...d})=>d);
  const invoice=versions.filter(v=>v.kind==='invoice').at(-1),approval=state.approvals.filter(a=>a.kind==='estimate'&&a.decision==='Approved').at(-1);
  const assets=state.assets.filter(a=>a.publishedAt&&!a.archivedAt).map(publicAsset);
  return {fileNumber:file.fileNumber||'',customerName:file.clientName||'',projectName:file.projectName||file.projectType||'Your project',projectType:file.projectType||'',status:file.fileStatus||'',approvedAmount:approval?.amount??null,paid:paid(file),invoiceAmount:invoice?.amount??null,balance:invoice?Math.max(0,invoice.amount-paid(file)):null,startDate:file.startDate||'',estimatedCompletion:file.anticipatedCompletionDate||'',appointments:appointments(file),versions,designs,videos:state.videos.filter(v=>v.publishedAt&&!v.archivedAt&&!v.deletedAt&&v.ready).map(({id,title,description,designVersion,duration,storageArchivedAt})=>({id,title,description,designVersion,duration,archived:!!storageArchivedAt})),assets,messages:state.messages.filter(m=>m.visibility!=='internal'),requests:state.requests,updates:state.updates.filter(u=>u.publishedAt&&!u.archivedAt),milestones:state.milestones.filter(m=>m.published!==false),selections:state.selections.filter(s=>s.published),checklist:state.checklist,approvals:state.approvals,preferences:state.preferences,settings:{website:state.settings.website||'',reviewUrl:state.settings.reviewUrl||'',supportEmail:state.settings.supportEmail||'',supportPhone:state.settings.supportPhone||'',paymentInstructions:state.settings.paymentInstructions||'',paymentUrl:state.settings.paymentUrl||''},paymentHistory:Array.isArray(file.paymentHistory)?file.paymentHistory.map(p=>({date:p.date||'',amount:num(p.amount),method:String(p.method||''),reference:String(p.reference||'')})):[],revision:state.revision,customerAccess:'private-link',customerId:grant.customerId||grant.accessId};
}
export function projectView(file,state,grant){return {...projectViewBase(file,state,grant),resources:state.resources.filter(r=>r.published),timezone:'America/New_York'};}
function requireRevision(body,state){if(body.revision!==state.revision)fail('The portal changed. Refresh before saving.',409);}
function safeUrl(value,hosts){if(!value)return '';let url;try{url=new URL(value);}catch{fail('Use a full HTTPS link.');}if(url.protocol!=='https:'||url.username||url.password||(hosts&&!hosts.includes(url.hostname)))fail('This link is not supported.');return url.href;}
const streamReady=env=>!!(env.CLOUDFLARE_ACCOUNT_ID&&env.CLOUDFLARE_STREAM_TOKEN);
async function archiveServiceStatus(bucket){
  const object=await bucket.get('portal/video-archives/service.json');if(!object)return {connected:false,enabled:false,deletionEnabled:false,waitDays:30};
  const state=await object.json(),fresh=Number.isFinite(Date.parse(state.checkedAt))&&Date.now()-Date.parse(state.checkedAt)<20*60000;
  return {connected:fresh&&state.connected===true,enabled:fresh&&state.enabled===true,deletionEnabled:fresh&&state.deletionEnabled===true,waitDays:30};
}
async function stream(env,path,init={}){
  if(!streamReady(env))fail('Cloudflare Stream is not connected. Configure the account ID and private Stream token first.',503);
  const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/stream${path}`,{...init,redirect:'error',headers:{Authorization:`Bearer ${env.CLOUDFLARE_STREAM_TOKEN}`,...init.headers},signal:AbortSignal.timeout(30000)});
  if(!response.ok)fail('Cloudflare Stream did not accept the request. No content was published.',502);return response;
}
export async function playback(env,video,expiresAt){
  const exp=Math.min(Math.floor(Date.now()/1000)+300,expiresAt?Math.floor(Date.parse(expiresAt)/1000):Infinity);
  const response=await stream(env,`/${video.uid}/token`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({exp})});
  const result=await response.json(),token=result.result?.token;if(!token||!/^[-_.a-zA-Z0-9]+$/.test(token))fail('Video playback is unavailable.',503);
  return {url:`https://iframe.videodelivery.net/${token}`,expiresAt:new Date(exp*1000).toISOString()};
}
function fileBytes(body,max){
  if(typeof body.content!=='string'||body.content.length>Math.ceil(max*4/3)+256)fail('File exceeds the upload limit.',413);
  let bytes;try{bytes=Uint8Array.from(atob(body.content),c=>c.charCodeAt(0));}catch{fail('Invalid file.');}if(!bytes.length||bytes.length>max)fail('File exceeds the upload limit.',413);return bytes;
}
function validateFile(bytes,type){
  const prefix=new TextDecoder().decode(bytes.slice(0,5));
  const good=type==='application/pdf'?prefix==='%PDF-':type==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71:type==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:type==='image/webp'?new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP':false;
  if(!good)fail('Use a valid PDF, JPG, PNG, WebP, or self-contained GLB file.');
}
function validateGlb(bytes){
  if(bytes.byteLength<24)fail('Invalid GLB model.');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.length||view.getUint32(16,true)!==0x4e4f534a)fail('Use a self-contained GLB 2.0 export.');
  const size=view.getUint32(12,true);if(size>4*1024*1024||size+20>bytes.length)fail('Invalid GLB structure.');let json;try{json=JSON.parse(new TextDecoder().decode(bytes.slice(20,20+size)));}catch{fail('Invalid GLB structure.');}
  for(const resource of [...(json.buffers||[]),...(json.images||[])])if(resource.uri&&!/^data:(image\/(png|jpeg|webp)|application\/octet-stream);base64,/.test(resource.uri))fail('The model references external files. Export a self-contained GLB.');
  if((json.accessors||[]).reduce((sum,a)=>sum+num(a.count),0)>5e6)fail('Optimize this model for mobile before uploading.');
}
export async function uploadAsset(bucket,fileId,body,{customer=false,grantId=''}={}){
  const allowed=['application/pdf','image/jpeg','image/png','image/webp',...(!customer?['model/gltf-binary']:[])];
  if(!allowed.includes(body.type))fail('This file type is not supported.');const bytes=fileBytes(body,customer?6*1024*1024:25*1024*1024);
  if(body.type==='model/gltf-binary')validateGlb(bytes);else validateFile(bytes,body.type);
  const assetId=crypto.randomUUID(),assetKey=`portal/workfiles/${encodeURIComponent(fileId)}/assets/${assetId}`;
  const asset={id:assetId,key:assetKey,name:text(body.name,180)||'Uploaded file',type:body.type,bytes:bytes.length,category:text(body.category||'Documents',80),createdAt:stamp(),publishedAt:customer?stamp():'',uploadedBy:customer?'customer':'staff',grantId:customer?grantId:''};
  await bucket.put(assetKey,bytes,{httpMetadata:{contentType:asset.type}});
  try{await mutate(bucket,fileId,state=>{if(customer&&(state.assets.filter(a=>a.uploadedBy==='customer').length>=200||state.assets.filter(a=>a.uploadedBy==='customer').reduce((sum,a)=>sum+num(a.bytes),0)+bytes.length>256*1024*1024))fail('Please ask your team to archive earlier uploads before adding more files.',409);state.assets.push(asset);record(state,'attachment.uploaded','Attachment uploaded',{assetId,by:customer?'customer':'staff'});});}catch(error){await bucket.delete?.(assetKey);throw error;}return publicAsset(asset);
}
export async function assetResponse(bucket,fileId,state,assetId,{customer=false}={}){
  const asset=state.assets.find(a=>a.id===assetId);if(!asset||customer&&(!asset.publishedAt||asset.archivedAt))fail('File unavailable.',404);
  if(asset.key!==`portal/workfiles/${encodeURIComponent(fileId)}/assets/${asset.id}`)fail('Invalid attachment binding.',503);
  const object=await bucket.get(asset.key);if(!object)fail('File unavailable.',404);
  const name=asset.name.replace(/[\r\n"\\]/g,'_').replace(/[^\x20-\x7e]/g,'_');
  return new Response(object.body,{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Type':asset.type,'Content-Disposition':`inline; filename="${name}"`,'Referrer-Policy':'no-referrer','Content-Security-Policy':"sandbox; default-src 'none'"}});
}
function attachments(state,ids,customer){
  if(!Array.isArray(ids)||ids.length>8)fail('Choose up to eight attachments.');
  return ids.map(value=>{const asset=state.assets.find(a=>a.id===value&&!a.archivedAt&&(!customer||a.publishedAt));if(!asset)fail('An attachment is unavailable.',409);return value;});
}
function validateReferences(state,body){
  const version=body.versionId?visibleVersion(state,id(body.versionId)):null;if(body.versionId&&!version)fail('The document version is unavailable.',409);
  if(body.itemId&&!version?.items.some(i=>i.id===body.itemId))fail('That line item is not on this document.',409);
  const video=body.videoId?state.videos.find(v=>v.id===body.videoId&&v.publishedAt&&!v.archivedAt&&v.ready):null;if(body.videoId&&!video)fail('Video unavailable.',409);
  const seconds=body.seconds==null?null:num(body.seconds);if(seconds!=null&&(seconds<0||seconds>(video?.duration||86400)))fail('Check the video timestamp.');
  const design=body.designId?state.designs.find(d=>d.id===body.designId&&d.publishedAt&&!d.archivedAt):null;if(body.designId&&!design)fail('Design unavailable.',409);
  return {versionId:version?.id||'',itemId:body.itemId||'',videoId:video?.id||'',seconds,designId:design?.id||'',designVersion:video?.designVersion||design?.version||''};
}
function customerRate(state,grantId,upload=false){
  const now=Date.now(),recent=(state.rates[grantId]||[]).filter(n=>now-n<60000);if(recent.length>=(upload?4:15))fail('Please wait a moment before submitting again.',429);recent.push(now);state.rates[grantId]=recent;
  for(const [key,values] of Object.entries(state.rates))if(!values.some(n=>now-n<60000))delete state.rates[key];
}
export async function customerWorkspace({bucket,file,grant,accessId,body,env}){
  if(!grant.projectAccess)fail('This link provides estimate access only.',403);
  const current=await portalState(bucket,file.id);
  if(body.action==='project')return projectView(file,current.state,{...grant,accessId});
  if(body.action==='asset')return assetResponse(bucket,file.id,current.state,id(body.assetId),{customer:true});
  if(body.action==='document'){
    const v=visibleVersion(current.state,id(body.versionId));if(!v||v.pdfKey!==`portal/documents/${v.id}.pdf`)fail('Document unavailable.',404);
    const pdf=await bucket.get(v.pdfKey);if(!pdf)fail('Document unavailable.',404);
    return new Response(pdf.body,{headers:{'Cache-Control':'private, no-store','Content-Type':'application/pdf','Content-Disposition':'inline; filename="D2-Document.pdf"','Content-Security-Policy':"sandbox; default-src 'none'",'X-Content-Type-Options':'nosniff'}});
  }
  if(body.action==='video'){
    const video=current.state.videos.find(v=>v.id===body.videoId&&v.publishedAt&&!v.archivedAt&&v.ready&&!v.deletedAt);if(!video)fail('Video unavailable.',404);
    if(video.storageArchivedAt)fail('This walkthrough is archived. Ask your project team to restore it.',410);
    if(video.provider==='r2')return {provider:'r2',url:`/client-access?video=${encodeURIComponent(video.id)}&accessId=${encodeURIComponent(accessId)}`};
    return playback(env,video,grant.expiresAt);
  }
  if(body.action==='videoBytes'){
    const video=current.state.videos.find(v=>v.id===body.videoId&&v.publishedAt&&!v.archivedAt&&v.ready&&!v.deletedAt);if(!video)fail('Video unavailable.',404);
    return r2VideoResponse(bucket,file.id,video,body.range||'');
  }
  if(body.action==='upload'){
    await mutate(bucket,file.id,state=>customerRate(state,accessId,true));return uploadAsset(bucket,file.id,body,{customer:true,grantId:accessId});
  }
  const requestId=id(body.requestId);
  return mutate(bucket,file.id,state=>{
    if(state.receipts.includes(`${accessId}:${requestId}`))return {unchanged:true,value:{ok:true,duplicate:true}};
    customerRate(state,accessId);const now=stamp();let result={ok:true};
    if(body.action==='message'){
      const refs=validateReferences(state,body),message=text(body.message,8000);if(!message)fail('Write a message first.');
      const entry={id:crypto.randomUUID(),from:'customer',customerId:accessId,text:message,at:now,attachments:attachments(state,body.attachments||[],true),...refs,status:'Submitted'};state.messages.push(entry);record(state,'message.received','Customer message received',{messageId:entry.id});result.id=entry.id;
    }else if(body.action==='request'){
      const kinds=['special','revision','schedule','warranty','punch','new-project','referral','feedback','payment-evidence','completion'];if(!kinds.includes(body.kind))fail('Choose a request type.');
      const refs=validateReferences(state,body),description=text(body.description,12000);if(!description)fail('Describe your request.');
      const entry={id:crypto.randomUUID(),kind:body.kind,category:portalCategories.includes(body.category)?body.category:'Other',title:text(body.title||'Customer request',180),description,attachments:attachments(state,body.attachments||[],true),urgent:body.urgent===true,customerId:accessId,createdAt:now,status:'Submitted',assignedTo:'',replies:[],...refs};
      if(body.kind==='feedback'){const rating=Number(body.rating);if(!Number.isInteger(rating)||rating<1||rating>5)fail('Select a rating from one to five.');entry.rating=rating;}
      state.requests.push(entry);record(state,'request.received',`${entry.kind==='special'?'Special':entry.kind} request submitted`,{requestId:entry.id,urgent:entry.urgent});result.id=entry.id;
    }else if(body.action==='approve'||body.action==='decline'){
      const kind=body.kind;if(!['estimate','design','change-order','agreement'].includes(kind))fail('Unsupported approval.');
      const document=kind==='design'?state.designs.find(d=>d.id===body.versionId&&d.publishedAt&&!d.archivedAt):visibleVersion(state,id(body.versionId));
      if(!document||kind!=='design'&&document.kind!==kind)fail('That version is unavailable.',409);
      const latest=(kind==='design'?state.designs.filter(d=>d.publishedAt&&!d.archivedAt):state.versions.filter(v=>v.kind===kind&&!v.withdrawnAt)).at(-1);
      if(document.id!==latest?.id)fail('A newer version is available. Review it before responding.',409);
      if(state.approvals.some(a=>a.versionId===document.id))fail('A response is already recorded for this version.',409);
      const customerName=text(body.customerName,180);if(customerName.length<3||body.consent!==true)fail('Enter your full name and confirm your consent.');
      const approval={id:crypto.randomUUID(),kind,versionId:document.id,amount:kind==='design'?null:document.amount,customerName,customerId:accessId,identityMethod:'private-link possession and typed name',decision:body.action==='approve'?'Approved':'Declined',consent:'I have reviewed this exact version and confirm my response.',consentVersion:'2026-10-21',at:now};
      state.approvals.push(approval);if(kind==='design')document.status=approval.decision;record(state,`${kind}.${body.action==='approve'?'approved':'declined'}`,`${kind} ${approval.decision.toLowerCase()}`,{versionId:document.id});result.approval=approval;
    }else if(body.action==='checklist'){
      const item=state.checklist.find(i=>i.id===body.itemId);if(!item)fail('Checklist item unavailable.',404);item.completed=body.completed===true;item.completedAt=item.completed?now:'';record(state,'checklist.updated','Preparation checklist updated');
    }else if(body.action==='appointment'){
      const appointment=appointments(file).find(a=>a.id===body.appointmentId);if(!appointment)fail('Appointment unavailable.',404);
      if(body.date!==appointment.date)fail('The schedule changed. Refresh before confirming.',409);
      state.requests.push({id:crypto.randomUUID(),kind:'schedule',title:`Confirmed ${appointment.title}`,description:`Customer confirmed ${appointment.date}${appointment.time?' '+appointment.time:''}.`,status:'Submitted',createdAt:now,customerId:accessId,replies:[],attachments:[]});record(state,'appointment.confirmed','Customer confirmed an appointment');
    }else if(body.action==='selection'){
      const selection=state.selections.find(s=>s.id===body.selectionId&&s.published);const option=selection?.options.find(o=>o.id===body.optionId);if(!option)fail('Selection unavailable.',409);
      selection.response={optionId:option.id,customerId:accessId,at:now,status:'Submitted'};record(state,'selection.submitted','Customer selection submitted');
    }else if(body.action==='preferences'){
      state.preferences={email:body.email===true,sms:body.sms===true,consentAt:now,customerId:accessId};record(state,'preferences.updated','Communication preferences updated');
    }else if(body.action==='seen'){
      const refs=validateReferences(state,body);if(!refs.versionId&&!refs.videoId)fail('Choose a document or video.');
      const objectId=refs.versionId||refs.videoId;state.stats||={views:{}};state.stats.views||={};const stats=state.stats.views[objectId]||{count:0,firstAt:now};stats.count++;stats.lastAt=now;state.stats.views[objectId]=stats;
      record(state,refs.videoId?'video.viewed':'estimate.viewed',refs.videoId?'Walkthrough accessed':'Estimate accessed',{...refs,customerId:accessId});
    }else fail('Unsupported portal action.');
    if(state.messages.length>2000||state.requests.length>2000)fail('This project needs archival before adding more messages.',409);
    state.receipts.push(`${accessId}:${requestId}`);state.receipts=state.receipts.slice(-300);return result;
  });
}
export async function adminWorkspace({bucket,file,body,env,actor='Administrator'}){
  if(body.action==='workspace'){const {state}=await portalState(bucket,file.id);return {state,project:projectView(file,state,{}),streamConfigured:streamReady(env),r2VideosConfigured:typeof bucket.createMultipartUpload==='function',archive:await archiveServiceStatus(bucket),notificationsConfigured:false};}
  if(['videoUploadStart','videoUploadPart','videoUploadComplete','videoUploadCancel','videoPreview'].includes(body.action))return r2VideoAction({bucket,file,body,readState:portalState,mutate});
  if(body.action==='videoArchiveHold')return mutate(bucket,file.id,state=>{requireRevision(body,state);const video=state.videos.find(v=>v.id===body.videoId&&v.provider==='r2');if(!video)fail('Video unavailable.',404);video.archiveHold=body.hold===true;record(state,'video.archive-hold',video.archiveHold?'Walkthrough archive paused':'Walkthrough archive hold removed',{videoId:video.id});return {ok:true};});
  if(body.action==='videoRestore'){const service=await archiveServiceStatus(bucket);if(!service.connected||!service.enabled)fail('Connect the Drive archive service before restoring.',503);return mutate(bucket,file.id,state=>{requireRevision(body,state);const video=state.videos.find(v=>v.id===body.videoId&&v.provider==='r2'&&v.storageArchivedAt);if(!video)fail('Archived video unavailable.',404);video.restoreRequestedAt=stamp();record(state,'video.restore-requested','Walkthrough restoration queued',{videoId:video.id});return {ok:true};});}
  if(body.action==='uploadAsset')return uploadAsset(bucket,file.id,body);
  if(body.action==='adminAsset'){const {state}=await portalState(bucket,file.id);return assetResponse(bucket,file.id,state,id(body.assetId));}
  if(body.action==='adminDocument'){
    const {state}=await portalState(bucket,file.id),version=state.versions.find(v=>v.id===body.versionId);if(!version||version.pdfKey!==`portal/documents/${version.id}.pdf`)fail('Document unavailable.',404);
    const pdf=await bucket.get(version.pdfKey);if(!pdf)fail('Document unavailable.',404);return new Response(pdf.body,{headers:{'Cache-Control':'private, no-store','Content-Type':'application/pdf','Content-Security-Policy':"sandbox; default-src 'none'",'X-Content-Type-Options':'nosniff'}});
  }
  if(body.action==='publishDocument'){
    const {state}=await portalState(bucket,file.id);requireRevision(body,state);
    const asset=state.assets.find(a=>a.id===body.assetId&&a.type==='application/pdf');if(!asset)fail('Upload the original PDF first.');
    if(!['invoice','agreement','change-order'].includes(body.kind))fail('Choose a supported document type.');
    const object=await bucket.get(asset.key);if(!object)fail('Original document unavailable.',404);
    const versionId=crypto.randomUUID(),pdfKey=`portal/documents/${versionId}.pdf`;
    await bucket.put(pdfKey,object.body,{httpMetadata:{contentType:'application/pdf'}});
    return mutate(bucket,file.id,s=>{
      requireRevision(body,s);const amount=body.kind==='invoice'?num(file.invoiceTotal??file.invoiceAmount??file.estimateTotal):num(body.amount);
      const version={id:versionId,kind:body.kind,sequence:s.versions.filter(v=>v.kind===body.kind).length+1,title:text(body.title,180)||body.kind,amount,pdfKey,items:[],date:stamp().slice(0,10),publishedAt:stamp(),status:'Published for Review',dueDate:text(body.dueDate||'',10),scheduleImpact:text(body.scheduleImpact||'',4000),pricingMode:body.kind==='change-order'?'proposed change':'document total'};
      s.versions.push(version);record(s,'document.published',`${version.title} published`,{versionId});return {versionId};
    });
  }
  if(body.action==='streamUpload'){
    if(!streamReady(env))fail('Cloudflare Stream is not connected.',503);
    const bytes=Number(body.bytes);if(!Number.isSafeInteger(bytes)||bytes<1||bytes>10*1024*1024*1024)fail('Choose a video smaller than 10 GB.');
    const videoId=crypto.randomUUID(),title=text(body.title,180),description=text(body.description||'',4000),designVersion=text(body.designVersion||'',80);
    if(!title)fail('Name the video.');
    const result=await stream(env,'?direct_user=true',{method:'POST',headers:{'Tus-Resumable':'1.0.0','Upload-Length':String(bytes),'Upload-Metadata':`maxdurationseconds ${btoa('1800')},requiresignedurls,name ${btoa(unescape(encodeURIComponent(title)))},allowedorigins ${btoa('animus-v-1.pages.dev')}`}});
    const uid=result.headers.get('stream-media-id'),uploadUrl=result.headers.get('Location');
    let uploadHost;try{uploadHost=new URL(uploadUrl);}catch{fail('Stream did not return a secure upload URL.',502);}
    if(!/^[a-f0-9]{32}$/.test(uid||'')||uploadHost.protocol!=='https:'||!['upload.videodelivery.net','upload.cloudflarestream.com'].includes(uploadHost.hostname))fail('Stream did not return a secure upload URL.',502);
    await mutate(bucket,file.id,state=>state.videos.push({id:videoId,uid,title,description,designVersion,createdAt:stamp(),ready:false,publishedAt:'',uploadUrl}));return {id:videoId,uploadUrl};
  }
  if(body.action==='streamStatus'||body.action==='streamPreview'||body.action==='streamDelete'){
    const {state}=await portalState(bucket,file.id),video=state.videos.find(v=>v.id===body.videoId&&!v.deletedAt);if(!video)fail('Video unavailable.',404);
    if(body.action==='streamPreview')return playback(env,video);
    if(body.action==='streamDelete'){
      if(body.confirmUid!==video.uid)fail('Confirm this deletion.');
      if(state.designs.some(d=>d.videoIds?.includes(video.id)&&state.approvals.some(a=>a.versionId===d.id&&a.decision==='Approved')))fail('An approved design references this video. Archive it instead.',409);
      await stream(env,`/${video.uid}`,{method:'DELETE'});await mutate(bucket,file.id,s=>{const v=s.videos.find(v=>v.id===video.id);v.deletedAt=stamp();v.publishedAt='';});return {ok:true};
    }
    const result=await(await stream(env,`/${video.uid}`)).json(),data=result.result;if(data?.requireSignedURLs!==true)fail('This video must require signed playback before publication.',409);
    await mutate(bucket,file.id,s=>{const v=s.videos.find(v=>v.id===video.id);v.ready=!!data.readyToStream;v.status=data.status?.state||'';v.duration=num(data.duration);});return {ready:!!data.readyToStream,status:data.status?.state||'',duration:num(data.duration)};
  }
  return mutate(bucket,file.id,state=>{
    requireRevision(body,state);const now=stamp();
    if(body.action==='reply'){
      const message=text(body.message,8000);if(!message)fail('Write a message.');
      if(body.requestId){const request=state.requests.find(r=>r.id===body.requestId);if(!request)fail('Request unavailable.',404);request.replies.push({id:crypto.randomUUID(),from:'staff',text:message,at:now,actor});}
      else state.messages.push({id:crypto.randomUUID(),from:'staff',text:message,at:now,actor,attachments:attachments(state,body.attachments||[],false)});
      record(state,'message.sent','Staff reply published');
    }else if(body.action==='requestStatus'){
      const request=state.requests.find(r=>r.id===body.requestId);if(!request)fail('Request unavailable.',404);
      if(!['Submitted','Under Review','Acknowledged','Resolved','Declined'].includes(body.status))fail('Choose a valid status.');request.status=body.status;request.assignedTo=text(body.assignedTo||'',180);request.updatedAt=now;
      record(state,'request.updated','Customer request updated',{requestId:request.id});
    }else if(body.action==='publishUpdate'){
      const title=text(body.title,180),description=text(body.description||'',12000);if(!title)fail('Add an update title.');
      const selected=attachments(state,body.attachments||[],false);if(body.publish)for(const a of state.assets)if(selected.includes(a.id))a.publishedAt=now;
      state.updates.push({id:crypto.randomUUID(),title,description,category:text(body.category||'Project Update',80),milestoneId:body.milestoneId||'',attachments:selected,createdAt:now,publishedAt:body.publish?now:''});record(state,body.publish?'update.published':'update.drafted',body.publish?'Project update published':'Project update drafted');
    }else if(body.action==='publishAsset'){
      const asset=state.assets.find(a=>a.id===body.assetId);if(!asset)fail('Attachment unavailable.',404);asset.publishedAt=body.publish?now:'';asset.description=text(body.description||asset.description||'',4000);asset.category=text(body.category||asset.category||'Documents',80);record(state,'document.updated',body.publish?'Document published':'Document unpublished');
    }else if(body.action==='publishDesign'){
      const asset=state.assets.find(a=>a.id===body.assetId&&a.type==='model/gltf-binary');if(!asset)fail('Upload a self-contained GLB model first.');
      const design={id:crypto.randomUUID(),title:text(body.title,180)||'Project design',description:text(body.description||'',8000),assetId:asset.id,version:state.designs.length+1,status:body.publish?'Published for Review':'Draft',publishedAt:body.publish?now:'',createdAt:now,videoIds:[]};state.designs.push(design);if(body.publish)asset.publishedAt=now;record(state,'design.published',body.publish?'Design published':'Design drafted',{designId:design.id});
    }else if(body.action==='publishRecord'){
      if(!['designs','updates'].includes(body.collection))fail('Choose a design or update.');const item=state[body.collection].find(i=>i.id===body.id);if(!item)fail('Record unavailable.',404);
      item.publishedAt=body.publish?now:'';if(body.collection==='designs'){item.status=body.publish?'Published for Review':'Draft';const asset=state.assets.find(a=>a.id===item.assetId);if(asset&&body.publish)asset.publishedAt=now;}
      if(body.collection==='updates'&&body.publish)for(const asset of state.assets)if(item.attachments.includes(asset.id))asset.publishedAt=now;
      record(state,'content.published',body.publish?'Project content published':'Project content unpublished');
    }else if(body.action==='publishVideo'){
      const video=state.videos.find(v=>v.id===body.videoId&&!v.deletedAt);if(!video||body.publish&&!video.ready)fail('Wait for the video to finish processing.',409);video.publishedAt=body.publish?now:'';record(state,'video.published',body.publish?'Walkthrough published':'Walkthrough unpublished',{videoId:video.id});
    }else if(body.action==='archive'){
      const allowed=['updates','designs','videos','assets'];if(!allowed.includes(body.collection))fail('Unsupported archive.');const item=state[body.collection].find(i=>i.id===body.id);if(!item)fail('Record unavailable.',404);item.archivedAt=body.restore?'':now;record(state,'content.archived',body.restore?'Portal content restored':'Portal content archived');
    }else if(body.action==='milestone'){
      const title=text(body.title,180);if(!title)fail('Name the milestone.');state.milestones.push({id:crypto.randomUUID(),title,description:text(body.description||'',4000),estimatedDate:body.estimatedDate||'',confirmedDate:body.confirmedDate||'',completedAt:body.completed?now:'',published:body.publish===true});record(state,'milestone.updated','Project milestone added');
    }else if(body.action==='checklistItem'){
      const title=text(body.title,180);if(!title)fail('Name the checklist item.');state.checklist.push({id:crypto.randomUUID(),title,completed:false});
    }else if(body.action==='updateMilestone'){
      const item=state.milestones.find(i=>i.id===body.id);if(!item)fail('Milestone unavailable.',404);item.completedAt=body.completed?now:'';item.published=body.publish===true;record(state,'milestone.updated','Project milestone updated');
    }else if(body.action==='learningResource'){
      const title=text(body.title,180);if(!title)fail('Add a resource title.');state.resources.push({id:crypto.randomUUID(),title,description:text(body.description||'',4000),url:safeUrl(body.url),projectType:text(body.projectType||'',80),published:body.publish===true});
    }else if(body.action==='reviewInvitation'){
      state.reviewInvitation={status:'Prepared, not delivered',at:now};record(state,'review.prepared','Review invitation prepared; delivery not configured');
    }else if(body.action==='selectionOption'){
      const title=text(body.title,180);if(!title||!Array.isArray(body.options)||body.options.length<1||body.options.length>30)fail('Add a title and one to thirty options.');
      state.selections.push({id:crypto.randomUUID(),title,description:text(body.description||'',4000),published:body.publish===true,options:body.options.map(o=>({id:crypto.randomUUID(),label:text(o.label,180),description:text(o.description||'',4000),priceDifference:num(o.priceDifference)}))});
    }else if(body.action==='markRead'){
      state.staffReadAt=now;for(const m of state.messages)if(m.from==='customer')m.readAt=now;
    }else if(body.action==='settings'){
      state.settings={website:safeUrl(body.website),reviewUrl:safeUrl(body.reviewUrl,['g.page','search.google.com','www.google.com','maps.google.com']),supportEmail:text(body.supportEmail||'',180),supportPhone:text(body.supportPhone||'',80),paymentInstructions:text(body.paymentInstructions||'',4000),paymentUrl:safeUrl(body.paymentUrl,['buy.stripe.com','checkout.stripe.com','square.link','checkout.square.site'])};
    }else fail('Unsupported administrator operation.');
    return {ok:true};
  });
}
export async function portalSummary(bucket){
  const states=[];let cursor;
  do{const page=await bucket.list({prefix:'portal/workfiles/',limit:1000,cursor});for(const object of page.objects||[])if(object.key.endsWith('/state.json')){const saved=await bucket.get(object.key);if(saved)states.push(JSON.parse(await saved.text()));}cursor=page.truncated?page.cursor:undefined;if(page.truncated&&!cursor)fail('Portal summary unavailable.',503);}while(cursor);
  const attention=[],activity=[];
  for(const state of states){
    for(const m of state.messages.filter(m=>m.from==='customer'&&!m.readAt))attention.push({id:m.id,fileId:state.fileId,label:'Unread customer message',at:m.at,section:'messages'});
    for(const r of state.requests.filter(r=>!done(r)))attention.push({id:r.id,fileId:state.fileId,label:`${r.urgent?'Priority: ':''}${r.kind==='special'?'Special request':r.kind+' request'}`,at:r.createdAt,section:'requests'});
    for(const event of state.events)activity.push({id:event.id,fileId:state.fileId,label:event.label,at:event.at});
  }
  return {attention:attention.sort((a,b)=>a.at.localeCompare(b.at)),activity:activity.sort((a,b)=>b.at.localeCompare(a.at)).slice(0,200)};
}
