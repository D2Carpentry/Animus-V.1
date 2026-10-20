import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {loadCloudHandler} from './load-cloud-handler.mjs';
const {applyMobileWorkspace:apply}=await loadCloudHandler('_mobile-workspace');
function fixture(){return {dashboardFiles:[{id:'one',fileNumber:'A-0001',clientName:'Keep customer',notes:['Keep note'],estimateTotal:100,estimatePdfUrl:'old-pdf',paidTotal:50,editableEstimate:{lineItems:[],totals:{total:100}}},{id:'two',estimateTotal:999}],revenueRows:[{id:'r1',dashboardFileId:'one',gross:100,expenses:25,labor:20,profit:55},{id:'r2',dashboardFileId:'two',gross:999}]};}
function payload(before){const file=before.dashboardFiles[0];return {action:'saveDocument',id:'one',mode:'supplement',makeCurrent:true,retainPrevious:true,saveId:'revision-1',saveHash:'revision-hash',pdfUrl:'new-pdf',document:{estimateNumber:'A-0001-S1',lineItems:[{description:'Revised full scope'}],totals:{total:300}},expected:{editableEstimate:file.editableEstimate,supplements:null,estimatePdfUrl:file.estimatePdfUrl,estimateTotal:file.estimateTotal}};}
test('promoting a full supplement replaces gross once and preserves original, notes, payments and other files',()=>{
  const before=fixture(),request=payload(before),result=apply(before,request);
  assert.equal(result.record.estimateTotal,300);assert.equal(result.record.editableEstimate.documentMode,'supplement');assert.equal(result.record.estimatePdfUrl,'new-pdf');
  assert.equal(result.record.supplements.length,1);assert.deepEqual(result.record.estimateHistory[0].data,before.dashboardFiles[0].editableEstimate);assert.equal(result.record.estimateHistory[0].pdfUrl,'old-pdf');
  assert.deepEqual(result.record.notes,['Keep note']);assert.equal(result.record.paidTotal,50);assert.equal(result.record.clientName,'Keep customer');
  assert.equal(result.dashboard.revenueRows[0].gross,300);assert.equal(result.dashboard.revenueRows[0].profit,255);assert.equal(result.dashboard.revenueRows[0].expenses,25);assert.equal(result.dashboard.revenueRows[0].labor,20);
  assert.deepEqual(result.dashboard.dashboardFiles[1],before.dashboardFiles[1]);assert.deepEqual(result.dashboard.revenueRows[1],before.revenueRows[1]);
  const retry=apply(result.dashboard,request);assert.equal(retry.replayed,true);assert.equal(retry.record.estimateHistory.length,1);assert.equal(retry.record.supplements.length,1);assert.equal(retry.dashboard.revenueRows[0].gross,300);
});
test('promotion rejects changed estimates, PDFs, financial totals or supplement lists',()=>{
  const before=fixture(),request=payload(before);
  for(const change of [{estimateTotal:200},{estimatePdfUrl:'another-pdf'},{editableEstimate:{totals:{total:200}}},{supplements:[{id:'concurrent'}]}]){const changed=structuredClone(before);Object.assign(changed.dashboardFiles[0],change);assert.throws(()=>apply(changed,request),/changed/);assert.equal(changed.dashboardFiles[0].estimateHistory,undefined);}
  assert.throws(()=>apply(before,{...request,mode:'invoice'}),/Only a supplement/);
});
test('normal revision can preserve its prior version without creating a supplement',()=>{
  const before=fixture(),request={...payload(before),mode:'estimate',makeCurrent:false},result=apply(before,request);
  assert.equal(result.record.estimateTotal,300);assert.equal(result.record.supplements,undefined);assert.equal(result.record.estimateHistory.length,1);
});
test('line note centers in the visible embedded viewport without moving either document scroll',async()=>{
  const html=await readFile(new URL('../../animus-estimate-demo.html',import.meta.url),'utf8');const code=html.slice(html.indexOf('function positionNoteEditor(){'),html.indexOf('function closeNoteEditor(){'));
  const textarea={style:{}},panel={style:{}},modal={hidden:false,style:{},querySelector:()=>panel};
  const context={$:id=>id==='noteEditorModal'?modal:textarea,innerHeight:9000,window:{frameElement:{getBoundingClientRect:()=>({top:-2500})},parent:{innerHeight:844}}};
  vm.runInNewContext(code+'positionNoteEditor()',context);assert.equal(modal.style.top,'2500px');assert.equal(modal.style.height,'844px');assert.equal(panel.style.maxHeight,'820px');assert.equal(textarea.style.minHeight,'260px');
});
async function hostFixture({changed=false,retry=false}={}){
  const source=await readFile(new URL('../../estimator-revisions.js',import.meta.url),'utf8');let listener,posts=0,replies=[];
  const before=fixture(),file=before.dashboardFiles[0];file.editableEstimate.estimateNumber='original-number';const expected=payload(before).expected;
  const opened={requestId:'open-one',estimate:{dashboardFileId:'one'},revisionExpected:structuredClone(expected)};opened.revisionExpected.editableEstimate.estimateNumber='A-0001';
  const remote=structuredClone(expected);if(changed||retry)remote.editableEstimate.totals.total=200;
  const frame={postMessage:message=>replies.push(message)};
  const context={window:{addEventListener:(type,callback)=>listener=callback},location:{origin:'https://animus-v-1.pages.dev'},document:{getElementById:()=>({contentWindow:frame})},pendingEstimatorOpen:opened,crmFiles:[file],crmRevenueRows:before.revenueRows,AbortSignal,localStorage:{setItem(){}},CRM_REVENUE_STORAGE_KEY:'test',saveCrmFiles(){},rememberCloudSync(){},showDashboardSaveStatus(){},fetch:async(url,options)=>{
    if(!options.method)return Response.json({ok:true,lastSaveId:retry?'save-one':'',expected:remote});
    posts++;const body=JSON.parse(options.body);assert.equal(body.expected.editableEstimate.estimateNumber,'original-number');return Response.json({ok:true,record:file,dashboard:before});
  }};
  vm.runInNewContext(source,context);
  const event={origin:context.location.origin,source:frame,data:{type:'animus-save-current-estimate',requestId:'open-one',saveId:'save-one',fileId:'one',document:{lineItems:[],totals:{total:300}},pdf:'test'}};
  return {run:()=>listener(event),event,frame,replies,get posts(){return posts;}};
}
test('host uses exact live expected values despite desktop file-number normalization',async()=>{const host=await hostFixture();await host.run();assert.equal(host.posts,1);assert.equal(host.replies[0].ok,true);});
test('host blocks a newer cloud quote and rejects messages from another frame',async()=>{const host=await hostFixture({changed:true});await host.run();assert.equal(host.posts,0);assert.equal(host.replies[0].ok,false);assert.match(host.replies[0].error,/changed on another device/);const forged=await hostFixture();forged.event.source={};await forged.run();assert.equal(forged.posts,0);assert.equal(forged.replies.length,0);});
test('lost save confirmation can retry the same identifier without creating another revision',async()=>{const host=await hostFixture({retry:true});await host.run();assert.equal(host.posts,1);assert.equal(host.replies[0].ok,true);});
test('workfile preview honors the explicitly saved current version rather than an older supplement',async()=>{
  const source=await readFile(new URL('../../animus-work-file.js',import.meta.url),'utf8');const code=source.slice(source.indexOf('function latestEstimateDocument(file)'),source.indexOf('function estimateValue('));
  const file={currentEstimateSavedAt:'2026-10-19',editableEstimate:{documentMode:'estimate',totals:{total:400}},supplements:[{data:{totals:{total:300}}}]};
  const context={file};vm.runInNewContext(code+'result=latestEstimateDocument(file)',context);assert.equal(context.result.data.totals.total,400);assert.equal(context.result.kind,'Estimate');
});
