import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCloudHandler} from './load-cloud-handler.mjs';
const {readFileReceipts,projectFileReceipts,protectExpenseLedger}=await loadCloudHandler('_expense-ledger');
const endpoint=await loadCloudHandler('expense-reconcile');
const {mergeDashboard}=await loadCloudHandler('dashboard','export {mergeDashboard};');
test('verified empty cloud ledger clears stale mirrors and stale whole-file saves cannot resurrect them',()=>{
  const old={id:'target',fileNumber:'TEST-1',notes:[{text:'Keep'}],estimateTotal:1044,animusExpenseLedgerV4:[{id:'old',amount:124.02}],expenseLines:[{id:'old',amount:124.02}]};
  const clean=projectFileReceipts(old,[]);assert.deepEqual(clean.notes,old.notes);assert.equal(clean.estimateTotal,1044);assert.equal(clean.expenseLines.length,0);
  assert.equal(protectExpenseLedger(clean,old).animusExpenseLedgerV4.length,0);
  const before={dashboardFiles:[clean],revenueRows:[{id:'rev',dashboardFileId:'target',gross:1044,expenses:0,labor:100}]};
  const result=mergeDashboard(before,{dashboardFiles:[old],revenueRows:[{id:'rev',dashboardFileId:'target',gross:1044,expenses:124.02,labor:100}]});
  assert.equal(result.dashboardFiles[0].expenseLines.length,0);assert.equal(result.revenueRows[0].expenses,0);assert.equal(result.revenueRows[0].profit,944);
});
test('receipt aliases deduplicate by identity, choose latest edits, and paginate all records',async()=>{
  let pages=0;const bucket={async list({prefix,cursor}){pages++;return prefix.includes('TEST-1')?{objects:[{key:'alias'}]}:cursor?{objects:[{key:'second'}]}:{objects:[{key:'first'}],truncated:true,cursor:'next'};},async get(key){return {json:async()=>key==='alias'?{id:'first',fileId:'TEST-1',amount:15,updatedAt:'2026-10-18'}:{id:key,fileId:'target',amount:10,updatedAt:'2026-10-17'}};}};
  const rows=await readFileReceipts(bucket,{id:'target',fileNumber:'TEST-1'});assert.equal(pages,3);assert.equal(rows.length,2);assert.equal(rows.reduce((n,e)=>n+e.amount,0),25);
});
test('failed or incomplete receipt reads never produce an authoritative zero',async()=>{
  await assert.rejects(readFileReceipts({list:async()=>{throw Error('offline');}},{id:'target'}),/offline/);
  await assert.rejects(readFileReceipts({list:async()=>({objects:[],truncated:true})},{id:'target'}),/incomplete/);
});
test('correction touches only selected expense mirrors and linked financial totals; concurrent save cancels',async()=>{
  for(const race of [false,true]){
    const snapshot={dashboardFiles:[{id:'target',clientName:'Test',notes:[{text:'Keep'}],animusExpenseLedgerV4:[{id:'stale',amount:124.02}]},{id:'other',notes:['Untouched']}],revenueRows:[{id:'rev',dashboardFileId:'target',gross:1044,labor:100,expenses:0},{id:'other-rev',gross:4590}]};let saved;
    const bucket={get:async()=>({etag:'v1',text:async()=>JSON.stringify(snapshot)}),list:async()=>({objects:[]}),put:async(key,value,options)=>{assert.equal(options.onlyIf.etagMatches,'v1');if(race)return null;saved=JSON.parse(value);return {etag:'v2'};}};
    const r=await endpoint.onRequest({request:new Request('https://animus-v-1.pages.dev/api/expense-reconcile',{method:'POST',body:JSON.stringify({fileId:'target',requireEmpty:true})}),env:{ANIMUS_BUCKET:bucket},data:{animusIdentity:{role:'admin'}}});
    assert.equal(r.status,race?409:200);if(race)assert.equal(saved,undefined);else{assert.deepEqual(saved.dashboardFiles[1],snapshot.dashboardFiles[1]);assert.deepEqual(saved.dashboardFiles[0].notes,snapshot.dashboardFiles[0].notes);assert.equal(saved.dashboardFiles[0].animusExpenseLedgerV4.length,0);assert.deepEqual(saved.revenueRows[1],snapshot.revenueRows[1]);}
  }
});
test('zero-only repair refuses to remove a real saved receipt',async()=>{
  let writes=0;
  const bucket={get:async key=>key==='dashboard/latest.json'?{etag:'v1',text:async()=>JSON.stringify({dashboardFiles:[{id:'target'}]})}:{json:async()=>({id:'receipt',fileId:'target',amount:25})},list:async()=>({objects:[{key:'receipt'}]}),put:async()=>{writes++;}};
  const r=await endpoint.onRequest({request:new Request('https://animus-v-1.pages.dev/api/expense-reconcile',{method:'POST',body:JSON.stringify({fileId:'target',requireEmpty:true})}),env:{ANIMUS_BUCKET:bucket},data:{animusIdentity:{role:'admin'}}});
  assert.equal(r.status,409);assert.equal(writes,0);
});
test('repair verifies an untouched recovery copy before writing the selected correction',async()=>{
  const raw=JSON.stringify({dashboardFiles:[{id:'target',notes:['Keep'],animusExpenseLedgerV4:[{id:'stale',amount:124.02}]}],revenueRows:[]});let backup,checksum,writeOrder=[];
  const bucket={get:async()=>({etag:'v1',text:async()=>raw}),list:async()=>({objects:[]}),put:async(key,value,options)=>{writeOrder.push(key);if(key.startsWith('dashboard/recovery/')){backup=value;checksum=options.sha256;}return {etag:'v2'};},head:async()=>({checksums:{sha256:checksum}})};
  const r=await endpoint.onRequest({request:new Request('https://animus-v-1.pages.dev/api/expense-reconcile',{method:'POST',body:JSON.stringify({fileId:'target',requireEmpty:true,preserveRecovery:true})}),env:{ANIMUS_BUCKET:bucket},data:{animusIdentity:{role:'admin'}}});
  assert.equal(r.status,200);assert.equal(backup,raw);assert.match(writeOrder[0],/recovery/);assert.equal(writeOrder[1],'dashboard/latest.json');
});
