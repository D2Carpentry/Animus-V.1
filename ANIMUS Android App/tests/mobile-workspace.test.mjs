import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadCloudHandler} from './load-cloud-handler.mjs';
const {applyMobileWorkspace:apply}=await loadCloudHandler('_mobile-workspace');
const {onRequest}=await loadCloudHandler('mobile-workspace');
const id='mobile-file-12345678-1234-1234-1234-123456789abc';
const source=()=>({dashboardFiles:[{id:'one',fileNumber:'A-0003',clientName:'Synthetic Customer',notes:[{text:'Keep me'}],expenseLines:[{amount:25}],estimateTotal:100,editableEstimate:{lineItems:[],totals:{total:100}},invoice:{total:100},updatedAt:'old'}],revenueRows:[{id:'r1',dashboardFileId:'one',gross:100,expenses:25,labor:20,date:'2026-10-18',profit:55}],priceRows:[{id:'p1',product:'Tape',defaultPrice:10}],deletedFileKeys:['A-0007']});
test('new file allocates above reserved numbers, is retry-safe, and never imports browser arrays',()=>{
  const before=source();const result=apply(before,{action:'createFile',id,values:{clientName:'New Test'}});
  assert.equal(result.record.fileNumber,'A-0008');assert.equal(before.dashboardFiles.length,1);
  assert.deepEqual(result.dashboard.dashboardFiles[1],before.dashboardFiles[0]);
  assert.equal(apply(result.dashboard,{action:'createFile',id,values:{clientName:'New Test'}}).dashboard.dashboardFiles.length,2);
  assert.throws(()=>apply(result.dashboard,{action:'createFile',id,values:{clientName:'Different'}}),/different/);
  assert.throws(()=>apply(before,{action:'createFile',id,values:{clientName:'New',notes:[]}}));
  assert.throws(()=>apply({...before,deletedFileKeys:[id]},{action:'createFile',id,values:{clientName:'New'}}),/deleted/);
});
test('workfile edits compare only touched fields and preserve notes, finances and documents',()=>{
  const before=source();const result=apply(before,{action:'editFile',id:'one',values:{clientName:'Updated'},expected:{clientName:'Synthetic Customer'}});
  assert.deepEqual(result.record.notes,before.dashboardFiles[0].notes);assert.deepEqual(result.record.invoice,{total:100});assert.equal(result.record.estimateTotal,100);
  assert.throws(()=>apply(result.dashboard,{action:'editFile',id:'one',values:{clientName:'Stale'},expected:{clientName:'Synthetic Customer'}}),/changed/);
  assert.throws(()=>apply(before,{action:'editFile',id:'one',values:{notes:[]},expected:{notes:[]}}));
});
test('price operations never replace other rows and reject stale edits/deletions',()=>{
  const before=source();const result=apply(before,{action:'savePrice',id:'p2',expected:null,values:{product:'Paint',defaultPrice:50,unit:'gallon'}});
  assert.equal(result.dashboard.priceRows.length,2);assert.deepEqual(result.dashboard.priceRows[0],before.priceRows[0]);
  assert.throws(()=>apply(result.dashboard,{action:'savePrice',id:'p2',expected:null,values:{product:'Stale',defaultPrice:0}}),/changed/);
  const removed=apply(result.dashboard,{action:'deletePrice',id:'p2',expected:result.record});
  assert.ok(removed.dashboard.deletedPriceIds.includes('p2'));assert.throws(()=>apply(removed.dashboard,{action:'savePrice',id:'p2',expected:null,values:{product:'Restore',defaultPrice:0}}),/deleted/);
});
test('revenue recalculates net while keeping receipt expenses and rejecting stale values',()=>{
  const result=apply(source(),{action:'editRevenue',id:'r1',values:{gross:200,labor:30,date:'2026-10-19'},expected:{gross:100,labor:20,date:'2026-10-18'}});
  assert.equal(result.record.expenses,25);assert.equal(result.record.profit,145);
  assert.throws(()=>apply(source(),{action:'editRevenue',id:'r1',values:{expenses:0},expected:{expenses:25}}),/Unsupported/);
  assert.throws(()=>apply(source(),{action:'editRevenue',id:'r1',values:{labor:-1},expected:{labor:20}}),/non-negative/);
});
test('document saves cannot change customer identity, erase notes, or replace an estimate with an invoice',()=>{
  const before=source();const document={clientName:'Imported Wrong Customer',lineItems:[{description:'Work',total:200}],totals:{total:200},documentMode:'invoice'};
  const result=apply(before,{action:'saveDocument',id:'one',mode:'invoice',saveId:'save1',document,pdfUrl:'private-pdf',expected:{invoice:before.dashboardFiles[0].invoice}});
  assert.equal(result.record.clientName,'Synthetic Customer');assert.deepEqual(result.record.editableEstimate,before.dashboardFiles[0].editableEstimate);assert.equal(result.record.invoice.total,200);assert.equal(result.record.estimateTotal,100);assert.deepEqual(result.record.notes,before.dashboardFiles[0].notes);
  assert.equal(apply(result.dashboard,{action:'saveDocument',id:'one',mode:'invoice',saveId:'save1',document,expected:{invoice:null}}).replayed,true);
});
test('estimate save updates only its linked gross; supplements append without replacing the original',()=>{
  const before=source();const document={lineItems:[],totals:{total:300}};
  const estimate=apply(before,{action:'saveDocument',id:'one',mode:'estimate',saveId:'s1',document,pdfUrl:'private',expected:{editableEstimate:before.dashboardFiles[0].editableEstimate}});
  assert.equal(estimate.dashboard.revenueRows[0].profit,255);assert.equal(estimate.record.estimateTotal,300);
  const supplement=apply(estimate.dashboard,{action:'saveDocument',id:'one',mode:'supplement',saveId:'s2',document,pdfUrl:'private2',expected:{supplements:null}});
  assert.equal(supplement.record.supplements.length,1);assert.equal(supplement.record.estimateTotal,300);assert.deepEqual(supplement.record.editableEstimate,estimate.record.editableEstimate);
});
test('first mobile estimate creates one linked revenue row using verified receipt totals',()=>{
  const before=source();before.revenueRows=[];const payload={action:'saveDocument',id:'one',mode:'estimate',saveId:'s3',document:{lineItems:[],totals:{total:500}},pdfUrl:'private',expected:{editableEstimate:before.dashboardFiles[0].editableEstimate},verifiedReceiptTotal:40};
  const result=apply(before,payload);assert.equal(result.dashboard.revenueRows.length,1);assert.equal(result.dashboard.revenueRows[0].expenses,40);assert.equal(result.dashboard.revenueRows[0].profit,460);
  assert.throws(()=>apply(result.dashboard,{...payload,saveHash:'changed'}),/different content/);
});
test('document API stores a real PDF privately and returns it only to an administrator',async()=>{
  let dashboard=source();const objects=new Map();const saveId='12345678-1234-1234-1234-123456789abc';
  const bucket={async get(key){if(key==='dashboard/latest.json')return {etag:'one',text:async()=>JSON.stringify(dashboard)};return objects.has(key)?{body:objects.get(key)}:null;},async put(key,value,options){if(key==='dashboard/latest.json'){assert.equal(options.onlyIf.etagMatches,'one');dashboard=JSON.parse(value);}else objects.set(key,value);return {etag:'two'};}};
  const document={lineItems:[],totals:{total:200}};
  const request=new Request('https://animus-v-1.pages.dev/api/mobile-workspace',{method:'POST',body:JSON.stringify({action:'saveDocument',id:'one',mode:'invoice',saveId,document,expected:{invoice:{total:100}},pdf:'data:application/pdf;base64,'+btoa('%PDF-1.4\nsynthetic test\n%%EOF')})});
  const context={env:{ANIMUS_BUCKET:bucket},data:{animusIdentity:{role:'admin'}}};
  assert.equal((await onRequest({...context,request})).status,200);assert.ok(objects.has(`documents/mobile/${saveId}.pdf`));
  const response=await onRequest({...context,request:new Request('https://animus-v-1.pages.dev/api/mobile-workspace?document='+saveId)});assert.equal(response.headers.get('Content-Type'),'application/pdf');assert.match(await response.text(),/^%PDF-/);
  assert.equal((await onRequest({...context,request:new Request('https://animus-v-1.pages.dev/api/mobile-workspace?document=../../dashboard/latest')})).status,404);
});
test('mobile endpoint requires verified admin even when called outside middleware',async()=>{
  const response=await onRequest({request:new Request('https://animus-v-1.pages.dev/api/mobile-workspace'),env:{ANIMUS_BUCKET:{get(){throw Error('must not read');}}},data:{}});assert.equal(response.status,403);
});
test('mobile endpoint retries conditional conflicts from fresh cloud and never replays stale snapshots',async()=>{
  let value=source();let etag=1;let writes=0;
  const bucket={async get(){return {etag:String(etag),text:async()=>JSON.stringify(value)};},async put(key,text,options){assert.equal(key,'dashboard/latest.json');if(++writes===1){value.dashboardFiles[0].notes.push({text:'Concurrent note'});etag++;return null;}assert.equal(options.onlyIf.etagMatches,String(etag));value=JSON.parse(text);return {etag:String(++etag)};}};
  const request=new Request('https://animus-v-1.pages.dev/api/mobile-workspace',{method:'POST',body:JSON.stringify({action:'editRevenue',id:'r1',values:{labor:30},expected:{labor:20}})});
  const response=await onRequest({request,env:{ANIMUS_BUCKET:bucket},data:{animusIdentity:{role:'admin'}}});assert.equal(response.status,200);assert.equal(value.dashboardFiles[0].notes.length,2);assert.equal(value.revenueRows[0].labor,30);
});
test('mobile bundle has no desktop navigation and generated editor never reads browser drafts',async()=>{
  const js=await readFile(new URL('../../mobile-cloud.js',import.meta.url),'utf8');const mobile=await readFile(new URL('../../mobile-cloud.html',import.meta.url),'utf8');const editor=await readFile(new URL('../../mobile-estimator.html',import.meta.url),'utf8');
  assert.ok(!js.includes('new URL("crm.html"'));assert.ok(!mobile.includes('Open desktop'));assert.ok(!mobile.includes('Desktop Command Center'));assert.ok(!editor.includes('localStorage'));assert.ok(editor.includes('const phoneHost=window.parent.AnimusMobileEditor'));
});
