import test from 'node:test';
import assert from 'node:assert/strict';
import {compactApprovedActivity} from '../security/activity-compaction.mjs';
const digest=async value=>Buffer.from(await crypto.subtle.digest('SHA-256',value)).toString('hex');
async function fixture({race=false,changed=false,badBackup=false}={}){
  const original=new TextEncoder().encode('original snapshot');const candidate=new TextEncoder().encode('compacted snapshot');
  const approved={sourceSha256:await digest(original),candidateSha256:await digest(candidate),sourceBytes:original.length,candidateBytes:candidate.length};
  const objects=new Map([['dashboard/latest.json',{bytes:original,etag:'original'}]]);let writes=0;
  const metadata=item=>({size:item.bytes.length,etag:item.etag,checksums:item.checksums,customMetadata:item.customMetadata});
  const bucket={
    async get(key){const item=objects.get(key);return item&&{...metadata(item),body:new Response(item.bytes).body};},
    async head(key){const item=objects.get(key);return item&&metadata(item);},
    async put(key,value,options){
      const previous=objects.get(key);
      if(options.onlyIf.etagDoesNotMatch==='*'&&previous)return null;
      if(options.onlyIf.etagMatches&&(race||previous.etag!==options.onlyIf.etagMatches))return null;
      const bytes=value instanceof Uint8Array?value:new Uint8Array(await new Response(value).arrayBuffer());
      if(changed||await digest(bytes)!==options.sha256)throw Error('Checksum mismatch');
      const item={bytes,etag:'new',customMetadata:options.customMetadata,checksums:{sha256:badBackup?new Uint8Array(32).buffer:Uint8Array.from(Buffer.from(options.sha256,'hex')).buffer}};
      objects.set(key,item);if(key==='dashboard/latest.json')writes++;return metadata(item);
    },
  };
  const context={request:new Request('https://animus-v-1.pages.dev/api/activity-compaction',{method:'POST',body:candidate}),env:{ANIMUS_BUCKET:bucket},data:{animusIdentity:{role:'admin'}}};
  return {context,approved,objects,get writes(){return writes;}};
}
test('approved compaction verifies recovery before conditional live replacement',async()=>{const f=await fixture();const r=await compactApprovedActivity(f.context,f.approved);assert.equal(r.status,200);assert.equal(f.writes,1);assert.equal(f.objects.size,2);});
for(const option of ['race','changed','badBackup'])test('compaction preserves live data on '+option,async()=>{const f=await fixture({[option]:true});const r=await compactApprovedActivity(f.context,f.approved);assert.equal(r.status,409);assert.equal(f.writes,0);});
test('compaction denies unauthorized identity and unapproved bytes',async()=>{const f=await fixture();f.context.data={};assert.equal((await compactApprovedActivity(f.context,f.approved)).status,403);f.context.data={animusIdentity:{role:'admin'}};f.approved.candidateSha256='0'.repeat(64);assert.equal((await compactApprovedActivity(f.context,f.approved)).status,400);assert.equal(f.writes,0);});
