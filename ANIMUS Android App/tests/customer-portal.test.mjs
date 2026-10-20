import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadCloudHandler} from './load-cloud-handler.mjs';
import {publicAsset,createPagesAccess} from '../security/pages-html.mjs';
const {onPortalAdmin:admin,createPortalAccess}=await loadCloudHandler('../_portal-service');
const origin='https://animus-v-1.pages.dev';
const sha=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');
const document={clientName:'Synthetic Customer',lineItems:[{description:'Work',total:100}],totals:{total:100}};
function fixture(){
  const objects=new Map([['dashboard/latest.json',{value:JSON.stringify({dashboardFiles:[{id:'file-one',fileNumber:'A-0010',clientName:'Synthetic Customer',editableEstimate:document,notes:['private note'],clientEmail:'private@example.com'}]}),etag:'1',metadata:{}}]]);const writes=[];
  const bucket={async get(key){const o=objects.get(key);return o?{etag:o.etag,size:new TextEncoder().encode(String(o.value)).length,text:async()=>String(o.value),arrayBuffer:async()=>o.value instanceof Uint8Array?o.value.buffer:new TextEncoder().encode(o.value).buffer,body:o.value,customMetadata:o.metadata}:null;},async put(key,value,options={}){if(options.onlyIf?.etagMatches&&options.onlyIf.etagMatches!==objects.get(key)?.etag)return null;writes.push(key);objects.set(key,{value,etag:String(writes.length+1),metadata:options.customMetadata||{}});return {etag:String(writes.length+1)};},async list(){return {objects:[...objects].map(([key,o])=>({key,customMetadata:o.metadata})),truncated:false};}};
  return {objects,writes,env:{ANIMUS_BUCKET:bucket}};
}
const adminRequest=body=>new Request(origin+'/api/customer-portal',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
async function issue(f,extra={}){const file=JSON.parse(f.objects.get('dashboard/latest.json').value).dashboardFiles[0];const request=adminRequest({action:'create',fileId:'file-one',estimateHash:await sha(JSON.stringify({estimate:file.editableEstimate||null,attachment:file.estimatePdfUrl||file.estimateUrl||file.editableEstimate?.pdfUrl||file.editableEstimate?.documentUrl||''})),pdf:'data:application/pdf;base64,'+btoa('%PDF-1.4\nORIGINAL ESTIMATE\n%%EOF'),...extra});const response=await admin({request,env:f.env,data:{animusIdentity:{role:'admin'}}});return {response,result:await response.json()};}
const access=createPortalAccess();
function customerRequest(body,cookie='',headers={}){return new Request(origin+'/client-access',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...headers},body:JSON.stringify(body)});}
async function exchange(f,result){return access({request:customerRequest({action:'session',token:new URL(result.url).hash.slice(1)}),env:f.env});}
test('portal issuance is admin-only and does not duplicate or modify CRM records',async()=>{
  const f=fixture();const response=await admin({request:adminRequest({action:'create'}),env:f.env,data:{animusIdentity:{role:'backup'}}});assert.equal(response.status,403);assert.equal(f.writes.length,0);
  const before=f.objects.get('dashboard/latest.json').value;const {result}=await issue(f);assert.equal(result.ok,true);assert.equal(f.objects.get('dashboard/latest.json').value,before);assert.ok(f.writes.every(key=>key.startsWith('portal/')));
  const url=new URL(result.url);assert.equal(url.search,'');assert.match(url.hash,/^#[-_a-zA-Z0-9]{43}$/);assert.ok(!result.url.includes('file-one'));assert.ok(!JSON.stringify([...f.objects.values()]).includes(url.hash.slice(1)));
});
test('customer session returns only a first name, not CRM IDs, financials, email or internal notes',async()=>{
  const f=fixture();const {result}=await issue(f);const response=await exchange(f,result);const body=await response.json();assert.deepEqual(body,{ok:true,firstName:'Synthetic',estimateTitle:'Your Estimate',accessId:result.id});
  const cookie=response.headers.get('Set-Cookie');assert.match(cookie,/HttpOnly; Secure; SameSite=Strict/);assert.match(cookie,/Path=\/client-access/);assert.match(cookie,/Max-Age=3600/);assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  const pdf=await access({request:customerRequest({action:'pdf',accessId:result.id,fileId:'another-customer'},cookie.split(';')[0]),env:f.env});assert.equal(pdf.status,200);assert.match(await pdf.text(),/ORIGINAL ESTIMATE/);
});
test('another tab cannot switch the document behind an already-open portal',async()=>{
  const f=fixture();const first=await issue(f);const second=await issue(f);const response=await exchange(f,second.result);const cookie=response.headers.get('Set-Cookie').split(';')[0];
  assert.equal((await access({request:customerRequest({action:'pdf',accessId:first.result.id},cookie),env:f.env})).status,401);
  assert.equal((await access({request:customerRequest({action:'pdf',accessId:second.result.id},cookie),env:f.env})).status,200);
});
test('invalid, tampered, expired and revoked links cannot read private PDFs',async()=>{
  const f=fixture();const {result}=await issue(f);const token=new URL(result.url).hash.slice(1);const key='portal/links/'+await sha(token)+'.json';
  for(const value of ['', 'file-one',token.slice(0,-1)+'!','A'.repeat(43)]){assert.equal((await access({request:customerRequest({action:'session',token:value}),env:f.env})).status,401);}
  const initial=JSON.parse(f.objects.get(key).value);for(const changed of [{...initial,expiresAt:'2020-01-01'},{...initial,revokedAt:new Date().toISOString()}]){f.objects.get(key).value=JSON.stringify(changed);assert.equal((await exchange(f,result)).status,401);}
});
test('public endpoint rejects cross-origin, URL credentials, duplicate cookies and unknown actions',async()=>{
  const f=fixture();const {result}=await issue(f);const token=new URL(result.url).hash.slice(1);
  assert.equal((await access({request:customerRequest({action:'session',token},'',{Origin:'https://attacker.test'}),env:f.env})).status,403);
  assert.equal((await access({request:new Request(origin+'/client-access?token='+token,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'}),env:f.env})).status,403);
  assert.equal((await access({request:customerRequest({action:'pdf'},`__Secure-d2-portal=${token}; __Secure-d2-portal=${token}`),env:f.env})).status,401);
  assert.equal((await access({request:customerRequest({action:'dashboard',token}),env:f.env})).status,400);
  assert.equal((await access({request:new Request(origin+'/client-access'),env:f.env})).status,405);
  assert.equal((await access({request:customerRequest({action:'session',token:'x'.repeat(5000)}),env:f.env})).status,413);
});
test('revocation invalidates an existing customer cookie and is never a public operation',async()=>{
  const f=fixture();const {result}=await issue(f);const response=await exchange(f,result);const cookie=response.headers.get('Set-Cookie').split(';')[0];
  const revoked=await admin({request:adminRequest({action:'revoke',id:result.id}),env:f.env,data:{animusIdentity:{role:'admin'}}});assert.equal(revoked.status,200);
  assert.equal((await access({request:customerRequest({action:'pdf'},cookie),env:f.env})).status,401);
});
test('link creation rejects stale estimates and reuses an existing real PDF without generating a substitute',async()=>{
  const f=fixture();assert.equal((await issue(f,{estimateHash:'stale'})).response.status,409);assert.equal(f.writes.length,0);
  const current=JSON.parse(f.objects.get('dashboard/latest.json').value);const id='12345678-1234-1234-1234-123456789abc';current.dashboardFiles[0].estimatePdfUrl=origin+'/api/mobile-workspace?document='+id;f.objects.get('dashboard/latest.json').value=JSON.stringify(current);f.objects.set('documents/mobile/'+id+'.pdf',{value:new TextEncoder().encode('%PDF-1.4\nACTUAL PDF\n%%EOF'),etag:'pdf',metadata:{}});
  const {result}=await issue(f,{pdf:'do not use this'});assert.equal(result.ok,true);assert.match(new TextDecoder().decode(f.objects.get('portal/documents/'+result.id+'.pdf').value),/ACTUAL PDF/);
});
test('untrusted attachment URLs never cause server-side fetches or replacement PDFs',async()=>{
  const f=fixture();const current=JSON.parse(f.objects.get('dashboard/latest.json').value);current.dashboardFiles[0].estimatePdfUrl='https://attacker.test/private.pdf';f.objects.get('dashboard/latest.json').value=JSON.stringify(current);assert.equal((await issue(f)).response.status,409);assert.equal(f.writes.length,0);
});
test('PDF object binding cannot be redirected to another portal document',async()=>{
  const f=fixture();const {result}=await issue(f);const key='portal/links/'+result.id+'.json';const grant=JSON.parse(f.objects.get(key).value);grant.pdfKey='portal/documents/'+'a'.repeat(64)+'.pdf';f.objects.get(key).value=JSON.stringify(grant);assert.equal((await exchange(f,result)).status,503);
});
test('only explicitly listed portal assets are public, never preview data or renderer/admin tools',async()=>{
  for(const path of ['/client/','/client/index.html','/client/portal.bundle.js','/client/pdf.worker.mjs','/client-access'])assert.equal(publicAsset(path),true);
  for(const path of ['/client/preview.bundle.js','/client/private.json','/portal-estimate-renderer.html','/customer-portal-brandon-a0003.html','/customer-portal-admin.js','/api/customer-portal'])assert.equal(publicAsset(path),false);
  const guard=createPagesAccess({verify:()=>assert.fail('Public shell should not require administrator'),rewrite:()=>assert.fail('No administrator bridge in customer portal')});
  const response=await guard({request:new Request(origin+'/client/'),next:()=>new Response('<html></html>',{headers:{'Content-Type':'text/html'}})});assert.equal(response.status,200);assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
});
test('portal UI source has no hardcoded customer, browser storage, analytics, or unsafe PDF evaluation',async()=>{
  const source=await readFile(new URL('../../client/portal.js',import.meta.url),'utf8');const accessSource=await readFile(new URL('../../client/portal-source.js',import.meta.url),'utf8');assert.ok(!/Brandon|Jennifer|localStorage|sessionStorage/.test(source+accessSource));assert.ok(source.includes('isEvalSupported:false'));assert.ok(accessSource.includes("history.replaceState(null,'',location.pathname)"));assert.ok(source.includes('dialog')||source.includes('showModal'));
});
test('PDF lifecycle keeps renderer bytes alive and destroys the PDF.js loading task',async()=>{
  const viewer=await readFile(new URL('../../client/portal.js',import.meta.url),'utf8');const renderer=await readFile(new URL('../../portal-pdf-renderer-client.js',import.meta.url),'utf8');
  assert.ok(viewer.includes('const previous=loadingTask'));
  assert.ok(!viewer.includes('pdf?.destroy()'));
  assert.ok(renderer.indexOf('pdf.arrayBuffer()')<renderer.indexOf('finally{'));
  assert.ok(renderer.includes("return new Blob([bytes],{type:'application/pdf'})"));
});
