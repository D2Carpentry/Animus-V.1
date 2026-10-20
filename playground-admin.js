import {createIcons,RotateCcw,Maximize2,Eye,Smartphone,Monitor,X} from './ANIMUS Android App/node_modules/lucide/dist/esm/lucide.js';
import {sample,project} from './playground-model.mjs';
const $=id=>document.getElementById(id),root=$('crmPlaygroundView');
let selected='sample',seed=sample(),events=[],mode='phone',signature='';
const frames=new Map();
function files(){return typeof crmFiles!=='undefined'?crmFiles:[];}
function money(value){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);}
function activity(text,view=false){events.unshift({text,view,time:new Date()});events=events.slice(0,50);drawActivity();}
function drawActivity(){const list=$('pgEvents');list.replaceChildren();for(const entry of events){const li=document.createElement('li'),time=document.createElement('time');li.textContent=entry.text;time.textContent=entry.time.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});li.append(time);list.append(li);}if(!events.length){const li=document.createElement('li');li.className='pg-empty';li.textContent='No test activity yet.';list.append(li);}const count=events.filter(e=>e.view).length;$('pgViewCount').textContent=`${count} test ${count===1?'view':'views'}`;}
function loadFrame(id){const frame=$(id),request=crypto.randomUUID();frames.set(frame,{request,seed:structuredClone(seed)});frame.src=`portal-admin-preview.html?request=${encodeURIComponent(request)}`;}
function select(value){if($('pgPreviewDialog').open)$('pgPreviewDialog').close();frames.clear();selected=value;const file=files().find(f=>String(f.id)===value);seed=value==='sample'?sample():project(file);signature='';events=[];drawActivity();refresh();}
function refresh(){
  if(!root||root.hidden)return;
  const selectBox=$('pgWorkfile');selectBox.replaceChildren(new Option('Sample Customer','sample'));
  for(const file of files())selectBox.add(new Option(`${file.fileNumber||'Unnumbered'} · ${file.clientName||'Customer'}`,String(file.id)));
  if(selected!=='sample'&&!files().some(f=>String(f.id)===selected)){selected='sample';seed=sample();}
  selectBox.value=selected;
  if(selected!=='sample')seed=project(files().find(f=>String(f.id)===selected));
  $('pgCustomer').textContent=seed.clientName;$('pgFile').textContent=seed.fileNumber;$('pgTotal').textContent=money(seed.total);
  const available=!!(seed.documentPath||seed.estimate)&&!seed.unavailable;
  $('pgExpand').disabled=!available;$('pgDevice').hidden=!available;$('pgPreviewEmpty').hidden=available;
  if(!available){frames.delete($('pgPreviewFrame'));$('pgPreviewFrame').removeAttribute('src');signature='';}
  $('pgStatus').textContent=seed.unavailable?'This saved attachment cannot be previewed here.':available?'':'No saved estimate on this workfile.';
  const next=JSON.stringify(seed);if(available&&signature!==next){signature=next;loadFrame('pgPreviewFrame');}
}
window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  const match=[...frames].find(([frame,state])=>frame.contentWindow===event.source&&state.request===event.data?.request);if(!match)return;
  const [frame,state]=match;
  if(event.data.type==='animus-playground-ready')frame.contentWindow.postMessage({type:'animus-playground-seed',request:state.request,seed:state.seed},location.origin);
  if(event.data.type==='animus-playground-pdf')activity('Estimate viewed in preview',true);
});
if(root){
  createIcons({icons:{RotateCcw,Maximize2,Eye,Smartphone,Monitor,X},root});
  $('pgWorkfile').addEventListener('change',event=>select(event.target.value));
  $('pgUseOpen').addEventListener('click',()=>{const file=typeof activeFile==='function'?activeFile():null;if(file)select(String(file.id));else $('pgStatus').textContent='Open a workfile first, or choose one above.';});
  $('pgReset').addEventListener('click',()=>select('sample'));
  $('pgSimulate').addEventListener('click',()=>activity('Simulated view',true));
  root.querySelectorAll('[data-pg-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.pgMode;$('pgDevice').dataset.mode=mode;root.querySelectorAll('[data-pg-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
  $('pgExpand').addEventListener('click',()=>{$('pgPreviewDialog').showModal();loadFrame('pgExpandedFrame');activity('Expanded preview opened');});
  $('pgClosePreview').addEventListener('click',()=>$('pgPreviewDialog').close());
  $('pgPreviewDialog').addEventListener('close',()=>{frames.delete($('pgExpandedFrame'));$('pgExpandedFrame').removeAttribute('src');$('pgExpand').focus();});
}
window.AnimusPlayground={render:refresh};
refresh();
