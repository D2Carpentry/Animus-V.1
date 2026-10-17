// One-time, checksum-bound repair of the explicitly approved cloud snapshot.
// R2 validates the streamed recovery copy before any conditional live write.
export const approvedCompaction=Object.freeze({
  sourceSha256:'63170595deb102dc099de43c86d4f3440394a54674b92f038cf28cc98df074ca',
  candidateSha256:'3aee24807adecb98796b0b6629811f611343a042c1734277b173c55ea2dfc81a',
  sourceBytes:53825571,candidateBytes:6978791,
});
const current='dashboard/latest.json';
const recovery='dashboard/recovery/2026-10-17-before-exact-activity-compaction.json';
const hex=buffer=>Array.from(new Uint8Array(buffer),byte=>byte.toString(16).padStart(2,'0')).join('');
const reply=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store'}});
export async function compactApprovedActivity({request,env,data},approved=approvedCompaction){
  if(data?.animusIdentity?.role!=='admin')return reply({ok:false,error:'Administrator access required.'},403);
  if(request.method!=='POST')return reply({ok:false,error:'Method not allowed.'},405);
  const length=Number(request.headers.get('Content-Length'));
  if(length&&length!==approved.candidateBytes)return reply({ok:false,error:'Unapproved snapshot size.'},400);
  const reader=request.body?.getReader();const chunks=[];let size=0;
  if(!reader)return reply({ok:false,error:'Snapshot required.'},400);
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>approved.candidateBytes){await reader.cancel();return reply({ok:false,error:'Unapproved snapshot size.'},400);}chunks.push(value);}
  if(size!==approved.candidateBytes)return reply({ok:false,error:'Incomplete snapshot.'},400);
  const candidate=new Uint8Array(size);let offset=0;for(const chunk of chunks){candidate.set(chunk,offset);offset+=chunk.byteLength;}
  if(hex(await crypto.subtle.digest('SHA-256',candidate))!==approved.candidateSha256)return reply({ok:false,error:'Snapshot checksum differs from the approved repair.'},400);
  const bucket=env.ANIMUS_BUCKET;
  const source=await bucket.get(current);
  if(!source||source.size!==approved.sourceBytes)return reply({ok:false,error:'Cloud data changed. Repair stopped; no current data overwritten.'},409);
  try{
    await bucket.put(recovery,source.body,{sha256:approved.sourceSha256,httpMetadata:{contentType:'application/json'},customMetadata:{sourceEtag:source.etag},onlyIf:{etagDoesNotMatch:'*'}});
    const backup=await bucket.head(recovery);
    if(!backup||backup.customMetadata?.sourceEtag!==source.etag||backup.size!==approved.sourceBytes||!backup.checksums?.sha256||hex(backup.checksums.sha256)!==approved.sourceSha256)
      return reply({ok:false,error:'Recovery backup verification failed. No current data overwritten.'},409);
    // The backup checksum proves the approved source; the etag protects edits
    // arriving while that source is streamed into the recovery object.
    const saved=await bucket.put(current,candidate,{onlyIf:{etagMatches:source.etag},sha256:approved.candidateSha256,httpMetadata:{contentType:'application/json; charset=utf-8'}});
    if(!saved)return reply({ok:false,error:'A newer cloud save arrived. Repair stopped; no current data overwritten.'},409);
    const verified=await bucket.head(current);
    if(!verified?.checksums?.sha256||hex(verified.checksums.sha256)!==approved.candidateSha256)throw Error('Live checksum verification failed. Recovery copy is preserved.');
    return reply({ok:true,recoveryKey:recovery,sourceBytes:approved.sourceBytes,size:verified.size,sha256:approved.candidateSha256,verified:true});
  }catch(error){return reply({ok:false,error:'Repair could not be verified. No older snapshot was imported; the recovery copy is retained.'},409);}
}

export const compactionForm=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>ANIMUS Activity Repair</title><style>body{background:#14171b;color:#e7e9ee;font:16px system-ui;padding:32px;max-width:720px;margin:auto}button,input{font:inherit;padding:14px;margin:16px 0}button{background:#2864cf;color:white;border:0}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body><h1>Approved Activity Cleanup</h1><p>Choose the verified compacted snapshot. Only the exact approved checksum can be applied. A full cloud recovery copy is verified first; a newer cloud save cancels the repair.</p><input id="snapshot" type="file" accept=".json"><button id="apply">Apply verified cleanup</button><pre id="result"></pre><script>document.querySelector('#apply').onclick=async()=>{const file=document.querySelector('#snapshot').files[0];if(!file)return;const button=document.querySelector('#apply');button.disabled=true;document.querySelector('#result').textContent='Verifying recovery backup and conditional repair...';try{const response=await fetch(location.pathname,{method:'POST',body:file,headers:{'Content-Type':'application/octet-stream'},credentials:'same-origin',cache:'no-store'});document.querySelector('#result').textContent=JSON.stringify(await response.json(),null,2);}catch(error){document.querySelector('#result').textContent='Connection interrupted. Verify live state before retrying.';}finally{button.disabled=false;}};</script></body></html>`;
