import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=await readFile(new URL('../../animus-work-file.js',import.meta.url),'utf8');
const crm=await readFile(new URL('../../crm.js',import.meta.url),'utf8');
function model(){
  const document={getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}};
  const window={addEventListener(){},escapeHtml:value=>String(value??'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]))};
  const context={window,document,URL,location:{href:'https://example.test/crm'},setTimeout(){},CRM_STATUS_DETAILS:{'New Lead':['Needs Contact']}};
  const exposed=source.replace('  const originalRenderCrm = window.renderCrm;','  window.testModel={stageIndex,progressMarkup,expenseBreakdown,summaryMarkup,headerMarkup,customerCard,communicationPanel,documentsPreview,photosPreview,workPhotoDocuments,activityRows,paidTotal};\n  const originalRenderCrm = window.renderCrm;');
  vm.runInNewContext(exposed,context);return {api:window.testModel,window};
}
test('lost and unknown files never falsely complete progress milestones',()=>{
  const {api}=model();
  for(const fileStatus of ['Job Lost / Closed','Canceled','Unknown']){
    assert.equal(api.stageIndex({fileStatus}),-1);
    assert.equal(api.progressMarkup({fileStatus}).includes('step done'),false);
    assert.equal(api.progressMarkup({fileStatus}).includes('aria-current="step"'),false);
  }
  assert.equal(api.stageIndex({fileStatus:'Completed-Pending Payment'}),6);
  assert.equal((api.progressMarkup({fileStatus:'Closed / Paid'}).match(/step done/g)||[]).length,0);
});
test('expense grouping is read-only, uses saved categories, and reconciles to the canonical total',()=>{
  const {api}=model();const file={expenseLines:[{amount:12,category:'Supplies'},{amount:4,category:'Materials'},{amount:5,category:'Labor'},{amount:2,category:'Fuel'}],laborTotal:500};
  const before=JSON.stringify(file),groups=api.expenseBreakdown(file,23);
  assert.equal(groups.Materials,16);assert.equal(groups.Labor,5);assert.equal(groups.Other,2);
  assert.equal(api.expenseBreakdown(file,99),null);
  assert.equal(JSON.stringify(file),before);
});
test('summary keeps canonical paid totals and distinguishes an uninvoiced estimate',()=>{
  const {api,window}=model();window.totalPaidForFile=()=>30;
  assert.equal(api.paidTotal({totalPaidOverride:999}),30);
  const html=api.summaryMarkup({estimateTotal:100,expenseLines:[]});
  assert.ok(html.includes('$70.00'));assert.ok(html.includes('Estimate only'));
  assert.equal(api.summaryMarkup({estimateTotal:100,invoiceSent:'Yes'}).includes('Estimate only'),false);
  for(const action of ['estimate','financials','expenses','startDate'])assert.ok(html.includes(`data-animus-summary="${action}"`));
});
test('header removes always-visible Save and customer badge, retains editing and real metadata',()=>{
  const {api}=model();const html=api.headerMarkup({clientName:'<Customer>',fileNumber:'A-0001',projectType:'Closet',fileStatus:'New Lead'});
  assert.ok(html.includes('&lt;Customer&gt;'));assert.ok(html.includes('data-animus-open="editFile"'));assert.ok(html.includes('data-animus-edit="action"'));
  assert.equal(html.includes('data-animus-save'),false);assert.equal(html.includes('Customer Info'),false);assert.equal(html.includes('Created '),false);
});
test('customer panel links to the existing portal manager without a map or fabricated contact data',()=>{
  const {api}=model();const html=api.customerCard({clientName:'First',clientPhone:'(239) 555-0100',clientEmail:'first@example.test',projectAddress:'Address'});
  assert.ok(html.includes('tel:2395550100'));assert.ok(html.includes('mailto:first@example.test'));assert.ok(html.includes('data-customer-portal'));
  assert.equal(html.includes('maps'),false);assert.equal(html.includes('Full Client Profile'),false);
  const second=api.customerCard({clientName:'Second'});assert.equal(second.includes('first@example.test'),false);
});
test('photo previews reuse uploaded image documents without copying or modifying storage',()=>{
  const {api}=model();const file={workPhotos:[{id:'p1',title:'Photo'}],workFileDocuments:[{id:'d1',type:'image/png',name:'Image'},{id:'d2',type:'application/pdf',name:'Contract'}]};
  const before=JSON.stringify(file);assert.equal(api.workPhotoDocuments(file).length,2);assert.ok(api.photosPreview(file).includes('data-animus-open-work-photo="d1"'));assert.equal(JSON.stringify(file),before);
});
test('communication uses actual logged events and native contact actions, not a second message store',()=>{
  const {api}=model();const html=api.communicationPanel({clientPhone:'2395550100',timeline:[{title:'Email sent',text:'Actual communication',at:'2026-10-20T12:00:00Z'},{title:'Status change',text:'In Progress'}]});
  assert.ok(html.includes('Actual communication'));assert.ok(html.includes('sms:2395550100'));assert.equal(html.includes('Status change'),false);
  assert.ok(api.communicationPanel({}).includes('No communication activity recorded'));
});
test('legacy activity timestamps sort chronologically without changing saved history',()=>{
  const {api}=model();const file={notes:[{text:'Note',at:'2026-10-19T12:00:00Z'}],timeline:['Earlier event Oct 18, 2026, 9:00 AM','Latest event Oct 20, 2026, 9:00 AM','No timestamp']};
  const before=JSON.stringify(file),rows=api.activityRows(file);
  assert.equal(rows[0].detail,'Latest event');assert.ok(rows[0].at);assert.equal(rows.at(-1).detail,'No timestamp');assert.equal(rows.at(-1).at,'');assert.equal(JSON.stringify(file),before);
});
test('search, scope, and status filters work together without modifying records',()=>{
  const files=[{id:'1',clientName:'Morgan',fileStatus:'In Progress'},{id:'2',clientName:'Morgan Closed',fileStatus:'Closed / Paid'},{id:'3',clientName:'Taylor',fileStatus:'New Lead'}];
  let filter='open',query='morgan',tab='all';
  const context={crmFiles:files,CRM_FILE_CATEGORY_RULES:{active:'active'},isOpenCrmFile:file=>file.fileStatus!=='Closed / Paid',filesInCategory:()=>files.filter(file=>file.fileStatus==='In Progress'),document:{querySelector:()=>({dataset:{workfileListTab:tab}})},window:{AnimusWorkfileDetail:{isAssignedToCurrentUser:file=>file.id==='3'}},$:id=>({value:id==='crmFileFilter'?filter:id==='animusWorkFileSearch'?query:'name'})};
  vm.runInNewContext(crm.slice(crm.indexOf('function visibleFiles()'),crm.indexOf('function renderCounts()')),context);
  assert.deepEqual(context.visibleFiles().map(file=>file.id),['1']);filter='all';assert.equal(context.visibleFiles().length,2);tab='my';query='';assert.equal(context.visibleFiles()[0].id,'3');filter='active';assert.equal(context.visibleFiles().length,0);
});
test('presentation routing only selects existing IDs and never creates or saves records',()=>{
  const context={window:{},crmFiles:[{id:'one'},{id:'two'}],activeFileId:'one'};
  const start=crm.indexOf('window.selectAnimusWorkfile =');const end=crm.indexOf('// Used by the Work File back control',start);
  vm.runInNewContext(crm.slice(start,end),context);
  assert.equal(context.window.selectAnimusWorkfile('missing'),false);assert.equal(context.activeFileId,'one');assert.equal(context.window.selectAnimusWorkfile('two'),true);assert.equal(context.activeFileId,'two');context.window.selectAnimusWorkfile(null);assert.equal(context.activeFileId,null);assert.equal(context.crmFiles.length,2);
});
test('integration keeps the original save and portal operations with scoped responsive assets',async()=>{
  const html=await readFile(new URL('../../crm.html',import.meta.url),'utf8');const css=await readFile(new URL('../../workfile-detail.css',import.meta.url),'utf8');
  for(const tab of ['communication','tasks','history'])assert.ok(source.includes(`state.tab === "${tab}"`));
  assert.ok(source.includes('window.saveCrmFiles()'));assert.ok(source.includes('window.openCrmStartDateModal?.()'));
  assert.ok(html.includes('workfile-detail.css'));assert.ok(css.includes('280ms ease'));assert.ok(css.includes('prefers-reduced-motion'));
  assert.ok(crm.includes('activeFileId = crmFiles.some(file => file.id === activeFileId) ? activeFileId : null;'));
});
