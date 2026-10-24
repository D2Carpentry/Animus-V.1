import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {loadCloudHandler} from './load-cloud-handler.mjs';
const context={};vm.runInNewContext(await readFile(new URL('../../employee-payroll-model.js',import.meta.url),'utf8'),context);
const model=context.AnimusEmployees,plain=value=>JSON.parse(JSON.stringify(value));
const {applyMobileWorkspace:apply}=await loadCloudHandler('_mobile-workspace');
const {onRequest}=await loadCloudHandler('mobile-workspace');
const files=[{id:'one',fileNumber:'A-0001',clientName:'Same Customer',assignedTo:'David',notes:['Preserve'],estimateTotal:8000},{id:'two',fileNumber:'A-0002',clientName:'Same Customer',assignedTo:'Lara',estimateTotal:4590}];
const snapshot=()=>({dashboardFiles:structuredClone(files),payrollRows:[],revenueRows:[{id:'r1',gross:8000,expenses:50,labor:70}],priceRows:[]});
const values={employee:'David',fileId:'one',date:'2026-10-24',hours:2,rate:25,total:50,status:'Paid',role:'Carpentry',notes:'Test entry'};
test('roster includes all three employees and assignments create jobs without invented payments',()=>{
  const before=JSON.stringify(files),result=plain(model.summaries(files,[]));assert.deepEqual(result.map(row=>row.name),['David','Lara','Manny']);
  assert.equal(result[0].jobs[0].fileId,'one');assert.equal(result[1].jobs[0].fileId,'two');assert.equal(result[2].jobs.length,0);assert.equal(result[0].paid,0);assert.equal(JSON.stringify(files),before);
});
test('multiple workfile assignees each see the job without duplicating another employee payment',()=>{
  const saved=apply(snapshot(),{action:'editFile',id:'one',values:{assignedTo:'David, Lara, Manny'},expected:{assignedTo:'David'}});
  const result=plain(model.summaries(saved.dashboard.dashboardFiles,[{id:'p1',employee:'David',fileId:'one',total:100,status:'Paid'}]));
  for(const person of result)assert.equal(person.jobs.filter(job=>job.fileId==='one').length,1);
  assert.deepEqual(result.map(person=>person.paid),[100,0,0]);
});
test('checkbox dropdown retains multiple selections, updates the saved value, and supports clearing all',async()=>{
  const source=await readFile(new URL('../../animus-work-file.js',import.meta.url),'utf8');
  const ui={window:{AnimusEmployees:model},escape:value=>String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;'),assignment:file=>model.assignedNames(file).join(', ')||'Unassigned'};
  vm.runInNewContext(source.slice(source.indexOf('  function employeeSelect('),source.indexOf('  function editorMarkup(')),ui);
  const html=ui.employeeSelect({assignedTo:'David, Manny'});assert.equal((html.match(/type="checkbox"/g)||[]).length,3);assert.equal((html.match(/ checked/g)||[]).length,2);assert.ok(!html.includes('<select'));
  const value={value:'David, Manny'},summary={},boxes=['David','Lara','Manny'].map(name=>({value:name,addEventListener(_name,fn){this.changed=fn;}}));
  const picker={querySelector:selector=>selector==='summary'?summary:value,querySelectorAll:()=>boxes};
  ui.bindEmployeeSelect({querySelector:()=>picker});assert.deepEqual(boxes.map(box=>box.checked),[true,false,true]);
  boxes[1].checked=true;boxes[1].changed();assert.equal(value.value,'David, Lara, Manny');assert.equal(summary.textContent,value.value);
  boxes.forEach(box=>box.checked=false);boxes[0].changed();assert.equal(value.value,'');assert.equal(summary.textContent,'Choose employees');
});
test('paid, pending and historical jobs are separated by stable workfile ID, never customer name',()=>{
  const rows=[{id:'p1',employee:' david ',fileId:'one',date:'2026-10-01',total:100,status:'Paid'},{id:'p2',employee:'David',fileId:'two',date:'2026-10-02',total:50,status:'Paid'},{id:'p3',employee:'David',fileId:'one',date:'2026-10-03',total:75,status:'Pending'}];
  const david=plain(model.summaries(files,rows))[0];assert.equal(david.jobs.length,2);assert.equal(david.jobs.find(job=>job.fileId==='one').paid,100);assert.equal(david.jobs.find(job=>job.fileId==='two').paid,50);assert.equal(david.paid,150);assert.equal(david.pending,75);assert.deepEqual(david.payments.map(row=>row.runningPaid),[100,150]);
});
test('legacy assignments, explicit unassignment, exact file numbers and pennies remain accurate',()=>{
  assert.deepEqual(plain(model.assignedNames({assignedTo:'',assignedEmployee:'David'})),[]);
  assert.deepEqual(plain(model.assignedNames({assignedTo:[{name:'David'},'Lara; Manny']})),['David','Lara','Manny']);
  const rows=[{id:'p1',employee:'David',fileNumber:'A-0002',total:.1,status:'Paid'},{id:'p2',employee:'David',fileNumber:'A-0002',total:.2,status:'Paid'},{id:'p3',employee:'Former employee',fileId:'deleted',clientJob:'Historical job',total:80,status:'Paid'}];
  const result=plain(model.summaries(files,rows));assert.equal(result[0].paid,.3);assert.equal(result[0].jobs.find(job=>job.fileId==='two').paid,.3);assert.equal(result.at(-1).paid,80);
});
test('targeted payroll saves preserve customer fields, revenue and other employees and reject stale edits',()=>{
  const before=snapshot(),result=apply(before,{action:'savePayroll',id:'pay-1',expected:null,values});assert.equal(before.payrollRows.length,0);assert.equal(result.record.total,50);assert.deepEqual(result.dashboard.dashboardFiles,before.dashboardFiles);assert.deepEqual(result.dashboard.revenueRows,before.revenueRows);
  assert.throws(()=>apply(result.dashboard,{action:'savePayroll',id:'pay-1',expected:null,values}),/changed/);
  const other=apply(result.dashboard,{action:'savePayroll',id:'pay-2',expected:null,values:{...values,employee:'Manny',fileId:'two'}});
  const edited=apply(other.dashboard,{action:'savePayroll',id:'pay-1',expected:result.record,values:{...values,total:70}});assert.equal(edited.dashboard.payrollRows.find(row=>row.id==='pay-2').employee,'Manny');
  assert.throws(()=>apply(edited.dashboard,{action:'savePayroll',id:'pay-1',expected:result.record,values}),/changed/);
});
test('invalid dates, missing files and negative pay fail without changing live values',()=>{
  for(const change of [{date:'2026-02-30'},{fileId:'missing'},{total:-1},{employee:''},{status:'Sent'},{hours:'no'}])assert.throws(()=>apply(snapshot(),{action:'savePayroll',id:'pay-1',expected:null,values:{...values,...change}}));
  const saved=apply(snapshot(),{action:'savePayroll',id:'pay-1',expected:null,values});
  const deleted=apply(saved.dashboard,{action:'deletePayroll',id:'pay-1',expected:saved.record});assert.equal(deleted.dashboard.payrollRows.length,0);assert.throws(()=>apply(deleted.dashboard,{action:'savePayroll',id:'pay-1',expected:null,values}),/deleted/);
});
test('assignment updates compare only assignedTo and preserve all financial and note data',()=>{
  const before=snapshot(),after=apply(before,{action:'editFile',id:'one',values:{assignedTo:'Manny'},expected:{assignedTo:'David'}});assert.equal(after.record.assignedTo,'Manny');assert.deepEqual(after.record.notes,['Preserve']);assert.deepEqual(after.dashboard.revenueRows,before.revenueRows);assert.equal(after.record.estimateTotal,8000);
});
test('normalized browser rows can edit legacy numeric strings without losing server metadata',()=>{
  const before=snapshot();before.payrollRows=[{id:'legacy-pay',employee:'David',date:'2026-10-01',hours:'2',rate:'25',status:'Paid',updatedAt:'server-metadata'}];
  const expected={id:'legacy-pay',revenueId:'',employee:'David',date:'2026-10-01',fileId:'',fileNumber:'',clientJob:'',hours:2,rate:25,total:50,status:'Paid',role:'',notes:''};
  const after=apply(before,{action:'savePayroll',id:'legacy-pay',expected,values});assert.equal(after.record.updatedAt,'server-metadata');assert.equal(after.record.total,50);
});
test('cloud payroll endpoint retries CAS conflicts from fresh records and denies anonymous writes',async()=>{
  let current=snapshot(),etag=1,writes=0;const bucket={async get(){return {etag:String(etag),text:async()=>JSON.stringify(current)};},async put(key,body,options){assert.equal(key,'dashboard/latest.json');if(++writes===1){current.dashboardFiles[0].notes.push('Concurrent note');etag++;return null;}assert.equal(options.onlyIf.etagMatches,String(etag));current=JSON.parse(body);return {etag:String(++etag)};}};
  const request=()=>new Request('https://animus-v-1.pages.dev/api/mobile-workspace',{method:'POST',body:JSON.stringify({action:'savePayroll',id:'pay-1',expected:null,values})});
  assert.equal((await onRequest({request:request(),env:{ANIMUS_BUCKET:bucket},data:{}})).status,403);assert.equal(writes,0);
  assert.equal((await onRequest({request:request(),env:{ANIMUS_BUCKET:bucket},data:{animusIdentity:{role:'admin'}}})).status,200);assert.equal(current.payrollRows.length,1);assert.deepEqual(current.dashboardFiles[0].notes,['Preserve','Concurrent note']);
});
