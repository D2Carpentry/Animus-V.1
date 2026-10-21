import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../revenue-analytics.js',import.meta.url),'utf8');
const ui=await readFile(new URL('../../animus-revenue.js',import.meta.url),'utf8');
const context={};vm.runInNewContext(source,context);const {analyze}=context.AnimusRevenueAnalytics;
const opts={fileFor:row=>({projectType:row.type,clientName:row.customer})};
test('aggregate and project margins are weighted and financial inputs remain untouched',()=>{
  const rows=[{gross:1000,expenses:200,labor:100,type:'Closet',customer:'One',date:'2026-01-10'},{gross:100,expenses:90,labor:0,type:'Closet',customer:'One',date:'2026-02-11'}];
  const before=JSON.stringify(rows),a=analyze(rows,opts);
  assert.equal(a.total.profit,710);assert.equal(a.total.margin,710/1100*100);assert.equal(a.types[0].margin,a.total.margin);assert.equal(a.customers[0].profit,710);assert.equal(JSON.stringify(rows),before);
});
test('cost categories reconcile with manual differences and payroll is included exactly once',()=>{
  const a=analyze([{gross:1000,expenses:300,labor:100,expenseLines:[{id:'a',category:'Supplies',amount:150},{id:'a',category:'Supplies',amount:150},{category:'Fuel',amount:20},{category:'Labor',amount:30}]}]);
  assert.equal(a.costTotal,400);assert.equal(a.costs.reduce((n,c)=>n+c.value,0),400);assert.equal(a.costs.find(c=>c.name==='Materials').value,150);assert.equal(a.costs.find(c=>c.name==='Labor (payroll)').value,100);assert.equal(a.total.profit,600);
});
test('signed adjustments, zero gross and missing dates never fabricate valid margins',()=>{
  const a=analyze([{gross:0,expenses:-10,labor:20,expenseLines:[{category:'Materials',amount:50}]}]);
  assert.equal(a.total.margin,null);assert.equal(a.types[0].margin,null);assert.equal(a.periods[0].name,'Undated');assert.equal(a.months.length,0);assert.equal(a.costs.reduce((n,c)=>n+c.value,0),10);
});
test('monthly, quarterly and yearly periods reflect actual dated rows',()=>{
  const rows=[{gross:100,date:'2026-01-10'},{gross:200,date:'2026-02-10'},{gross:300,date:'2025-12-10'}];
  assert.equal(analyze(rows).periods.length,3);const q=analyze(rows,{period:'quarterly'});assert.equal(q.periods.find(p=>p.name==='2026-Q1').gross,300);assert.equal(analyze(rows,{period:'yearly'}).periods.length,2);
});
test('all analytics honor canonical profit helper',()=>{
  const a=analyze([{gross:100,expenses:1,labor:2}],{getProfit:()=>77});assert.equal(a.total.profit,77);assert.equal(a.types[0].margin,77);
});
function model(){
  const ctx={crmRevenueRows:[],crmFiles:[],crmRevenueYearFilter:'2026',document:{readyState:'loading',addEventListener(){},querySelector(){return null;}},window:{},localStorage:{getItem(){return null;}},AnimusRevenueAnalytics:context.AnimusRevenueAnalytics,findFileForRevenue:row=>ctx.crmFiles.find(f=>f.id===row.dashboardFileId)};
  vm.runInNewContext(ui.replace('  function init() {','  window.testRevenue={state,rows,commitEdit,saveDate,columnWidths,exportCsv};\n  function init() {'),ctx);return ctx;
}
test('search, status, type, year, range, profitability and sorting share the same filtered rows',()=>{
  const ctx=model(),{state,rows}=ctx.window.testRevenue;
  ctx.crmFiles=[{id:'f',clientName:'Morgan',fileStatus:'In Progress',projectType:'Closet'}];
  ctx.crmRevenueRows=[{id:'r',dashboardFileId:'f',date:'2026-01-01',gross:100},{id:'r2',dashboardFileId:'f',date:'2026-02-01',gross:50,expenses:100},{id:'r3',date:'2025-01-01',gross:1000}];
  assert.equal(rows().length,2);state.query='Morgan';state.status='In Progress';state.project='Closet';assert.equal(rows().length,2);state.profitability='negative';assert.equal(rows()[0].id,'r2');state.from='2026-03-01';assert.equal(rows().length,0);
  state.from='';state.profitability='all';state.sort='gross';state.direction=1;assert.equal(rows()[0].id,'r2');
});
test('amount edits retain the existing save operations, inverse profit calculation and labor synchronization',()=>{
  const ctx=model(),api=ctx.window.testRevenue;let saved=0,cloud=[],labor=0;
  ctx.crmRevenueRows=[{id:'r',gross:100,expenses:20,labor:10}];ctx.saveRevenueRows=()=>saved++;ctx.document.querySelector=()=>({value:'50'});ctx.window.animusSaveRevenueChangeToCloud=(...args)=>cloud.push(args);ctx.window.syncRevenueLaborToFile=()=>{labor++;return {id:'f'};};
  // Rendering is not under test here; stop after the canonical operation.
  ctx.document.querySelector=selector=>selector==='[data-revenue-inline]'?{value:'50'}:null;
  api.state.edit={id:'r',field:'profit'};api.commitEdit('r');assert.equal(ctx.crmRevenueRows[0].gross,80);assert.equal(ctx.crmRevenueRows[0].profit,50);assert.equal(saved,1);assert.equal(cloud[0][3],'profit');
  api.state.edit={id:'r',field:'labor'};api.commitEdit('r');assert.equal(labor,1);assert.equal(ctx.crmRevenueRows[0].labor,50);
});
test('date editing retains audited save and cloud confirmation',()=>{
  const ctx=model();ctx.crmRevenueRows=[{id:'r',date:'2026-01-01'}];ctx.saveRevenueRows=()=>{};let field;ctx.window.animusSaveRevenueChangeToCloud=(a,b,c,d)=>field=d;ctx.window.testRevenue.saveDate('r','2026-02-01');assert.equal(ctx.crmRevenueRows[0].date,'2026-02-01');assert.equal(field,'date');assert.equal(ctx.crmRevenueRows[0].revenueAudit[0].from,'2026-01-01');
});
