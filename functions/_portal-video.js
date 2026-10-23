// Private MP4 objects are immutable after multipart completion.
export const VIDEO_PART_BYTES=5*1024*1024;
const MAX_BYTES=500*1024*1024;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export const videoKey=(fileId,videoId)=>`portal/workfiles/${encodeURIComponent(fileId)}/videos/${videoId}.mp4`;
const limited=(v,max)=>{if(typeof v!=='string'||v.length>max)fail('Check the video details.');return v.trim();};
const locate=(state,videoId)=>{const v=state.videos.find(v=>v.id===videoId&&v.provider==='r2'&&!v.deletedAt);if(!v)fail('Video unavailable.',404);return v;};
export async function r2VideoAction({bucket,file,body,readState,mutate}){
  if(body.action==='videoUploadStart'){
    const bytes=body.bytes,title=limited(body.title,180);
    if(!title||!Number.isSafeInteger(bytes)||bytes<12||bytes>MAX_BYTES||body.type!=='video/mp4')fail('Choose an MP4 video up to 500 MB and give it a title.');
    const videoId=crypto.randomUUID(),key=videoKey(file.id,videoId);
    const transfer=await bucket.createMultipartUpload(key,{httpMetadata:{contentType:'video/mp4'},customMetadata:{fileId:file.id,videoId}});
    try{await mutate(bucket,file.id,state=>{
      if(state.videos.filter(v=>v.provider==='r2'&&!v.ready&&!v.deletedAt).length>=3)fail('Finish or cancel the pending video uploads first.',409);
      state.videos.push({id:videoId,provider:'r2',key,uploadId:transfer.uploadId,bytes,name:limited(body.name||'Walkthrough.mp4',180),title,description:limited(body.description||'',4000),designVersion:limited(body.designVersion||'',80),createdAt:new Date().toISOString(),ready:false,publishedAt:'',parts:[]});
    });}catch(error){await transfer.abort();throw error;}
    return {id:videoId,partBytes:VIDEO_PART_BYTES};
  }
  const {state}=await readState(bucket,file.id),video=locate(state,body.videoId);
  if(video.key!==videoKey(file.id,video.id))fail('Invalid video binding.',503);
  if(body.action==='videoPreview')return r2VideoResponse(bucket,file.id,video);
  if(video.ready)fail('This video is already complete.',409);
  const transfer=bucket.resumeMultipartUpload(video.key,video.uploadId);
  if(body.action==='videoUploadCancel'){
    await transfer.abort();await mutate(bucket,file.id,s=>{locate(s,video.id).deletedAt=new Date().toISOString();});return {ok:true};
  }
  if(body.action==='videoUploadPart'){
    const number=body.partNumber,total=Math.ceil(video.bytes/VIDEO_PART_BYTES),expected=Math.min(VIDEO_PART_BYTES,video.bytes-(number-1)*VIDEO_PART_BYTES);
    if(!Number.isInteger(number)||number<1||number>total||typeof body.content!=='string'||body.content.length>Math.ceil(VIDEO_PART_BYTES/3)*4)fail('Invalid video chunk.');
    let bytes;try{bytes=Uint8Array.from(atob(body.content),c=>c.charCodeAt(0));}catch{fail('Invalid video chunk.');}
    if(bytes.length!==expected)fail('Incomplete video chunk.');
    if(number===1&&new TextDecoder().decode(bytes.slice(4,8))!=='ftyp')fail('This is not a supported MP4 recording.');
    const part=await transfer.uploadPart(number,bytes);
    await mutate(bucket,file.id,s=>{const v=locate(s,video.id);if(v.ready)fail('Upload already finished.',409);v.parts=v.parts.filter(p=>p.partNumber!==number);v.parts.push({partNumber:number,etag:part.etag});});
    return {partNumber:number};
  }
  if(body.action==='videoUploadComplete'){
    const parts=video.parts.slice().sort((a,b)=>a.partNumber-b.partNumber);
    if(parts.length!==Math.ceil(video.bytes/VIDEO_PART_BYTES)||parts.some((p,i)=>p.partNumber!==i+1))fail('Upload is incomplete.',409);
    const result=await transfer.complete(parts);
    if(result.size!==video.bytes)fail('Video size verification failed. The private upload was not published.',409);
    await mutate(bucket,file.id,s=>{const v=locate(s,video.id);v.ready=true;v.sourceEtag=result.etag;delete v.parts;delete v.uploadId;});
    await bucket.put(`portal/video-archives/${encodeURIComponent(file.id)}/${video.id}.json`,JSON.stringify({schema:1,fileId:file.id,videoId:video.id,status:'waiting',eligibleSince:'',chunks:[]}),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
    return {id:video.id,ready:true};
  }
  fail('Unsupported video action.');
}
export async function r2VideoResponse(bucket,fileId,video,range=''){
  if(!video.ready||video.storageArchivedAt)fail('This walkthrough is archived. Ask your project team to restore it.',410);
  if(video.provider!=='r2'||video.key!==videoKey(fileId,video.id))fail('Invalid video binding.',404);
  let offset=0,length=video.bytes;
  if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match)fail('Unsupported byte range.',416);offset=Number(match[1]);const end=match[2]?Number(match[2]):video.bytes-1;if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(end)||offset<0||offset>=video.bytes||end<offset)fail('Invalid byte range.',416);length=Math.min(end,video.bytes-1)-offset+1;}
  const object=await bucket.get(video.key,{onlyIf:{etagMatches:video.sourceEtag},range:{offset,length}});if(!object?.body)fail('Video unavailable.',404);
  const headers={'Cache-Control':'private, no-store','Content-Type':'video/mp4','Content-Length':String(length),'Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Disposition':'inline; filename="D2-Walkthrough.mp4"'};
  if(range)headers['Content-Range']=`bytes ${offset}-${offset+length-1}/${video.bytes}`;
  return new Response(object.body,{status:range?206:200,headers});
}
