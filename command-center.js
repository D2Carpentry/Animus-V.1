/* Read-only dashboard; every edit returns to the existing CRM workflow. */
(() => {
  const M=globalThis.AnimusCommandModel,B=globalThis.AnimusBusinessModel;
  const state={preset:'ytd',period:'monthly'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(v)||0);
  const icon=n=>`<i data-command-icon="${n}" aria-hidden="true"></i>`;
  const files=()=>typeof crmFiles!=='undefined'?crmFiles:[];
  const category=f=>typeof crmFileCategory==='function'?crmFileCategory(f):'new';
  const empty=s=>`<p class="cc-empty">${esc(s)}</p>`;
  const name=f=>f.clientName||f.fileNumber||'Unnamed customer';
  const fileAttr=(f,tab='overview')=>`data-cc-file="${esc(f.id)}" data-cc-tab="${tab}"`;
  const dateLabel=v=>B.date(v)?new Date(B.date(v)+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}):'Date not recorded';
  function relative(at){const n=Math.floor((Date.now()-Date.parse(at))/60000);return !Number.isFinite(n)?'':n<0?dateLabel(at):n<1?'Just now':n<60?`${n}m ago`:n<1440?`${Math.floor(n/60)}h ago`:`${Math.floor(n/1440)}d ago`;}
  function linkedFile(row){
    const id=row.dashboardFileId||row.fileId||row.attachedEstimate?.dashboardFileId;
    if(id){const f=files().find(f=>String(f.id)===String(id));if(f)return f;}
    const number=row.fileNumber||row.projectNumber||row.attachedEstimate?.fileNumber;
    if(number)return files().find(f=>String(f.fileNumber)===String(number))||null;
    if(id)return null;
    return typeof findFileForRevenue==='function'?findFileForRevenue(row):null;
  }
  function aggregate(rows,range){return B.aggregate({files:files(),rows,range,period:state.period,fileForRow:linkedFile,categoryForFile:category,profit:row=>typeof revenueProfit==='function'?revenueProfit(row):B.number(row.gross)-B.number(row.expenses)-B.number(row.labor)});}
  function read(){
    const profile=window.animusReadCompanyPreferences?.()||{},now=new Date(),clock=M.clock(now,profile.timezone),snapshot=window.animusExpenseReportSnapshot?.();
    const rows=snapshot?.rows||(typeof crmRevenueRows!=='undefined'?crmRevenueRows:[]),loading=typeof crmCloudAuthoritativeLoaded!=='undefined'&&!crmCloudAuthoritativeLoaded;
    const costsLoading=!!snapshot&&(!snapshot.loaded||snapshot.loading);
    if(!loading&&snapshot&&!snapshot.loaded&&!snapshot.loading)setTimeout(()=>window.animusRefreshBusinessExpenseReport?.(),0);
    const range=B.range(state.preset,clock.local),financial=aggregate(rows,range);
    // All current work types stay visible; only their recorded income follows reporting dates.
    financial.types=aggregate(financial.rows,B.range('all',clock.local)).types;
    return {profile,now,clock,snapshot,loading,costsLoading,financial,month:aggregate(rows,B.range('month',clock.local)),stages:M.stages.map(([key,label,glyph])=>({key,label,glyph,files:files().filter(f=>category(f)===key)})),outcomes:M.monthOutcomes(files(),clock.today.slice(0,7)),alerts:M.alerts(files(),clock.today,typeof totalPaidForFile==='function'?totalPaidForFile:()=>0),upcoming:M.upcoming(files(),clock.today),activity:M.activity(files()),team:M.assignments(files(),category),schedule:M.schedule(calendarEvents(),now,clock.zone)};
  }
  const head=(title,action='',target='')=>`<header class="cc-panel-head"><h2>${title}</h2>${action?`<button ${target}>${action}${icon('arrow-up-right')}</button>`:''}</header>`;
  const alertRows=list=>list.map(a=>`<button class="cc-record cc-alert" ${fileAttr(a.file,a.tab)}><span class="cc-round cc-gold">${icon(a.kind==='payment'?'wallet':'circle-alert')}</span><span><strong>${esc(a.label)}</strong><small>${esc(name(a.file))} · ${esc(a.file.fileNumber||'')}</small><small>Due ${esc(dateLabel(a.due))}</small></span>${icon('chevron-right')}</button>`).join('');
  const activityRows=list=>list.map(a=>`<button class="cc-record" ${fileAttr(a.file,'history')}><span class="cc-round">${icon(a.kind==='note'?'sticky-note':'activity')}</span><span><strong>${esc(name(a.file))}</strong><small>${esc(a.text)}</small></span><time title="${esc(new Date(a.at).toLocaleString())}">${relative(a.at)}</time></button>`).join('');
  const scheduleRows=list=>list.map(e=>`<button class="cc-record cc-event ${e.highlight?'cc-next':''}" data-cc-event="${esc(e.eventKey||'')}"><time>${esc(e.allDay?'All day':e.sortTime)}</time><span><strong>${esc(e.title||'Calendar event')}</strong><small>${esc([e.clientName,e.typeLabel||e.type,e.status].filter(Boolean).join(' · '))}</small>${e.highlight?'<small class="cc-accent">Current / next event</small>':''}</span>${icon('chevron-right')}</button>`).join('');
  function calendarEvents(){
    return (typeof allCrmCalendarEvents==='function'?allCrmCalendarEvents():[]).map(event=>{
      const file=files().find(f=>String(f.id)===String(event.fileId));
      const config=typeof CRM_CALENDAR_TYPES!=='undefined'?CRM_CALENDAR_TYPES[event.type]:null;
      if(file&&config)return {...event,allDay:!config.timeField||!file[config.timeField]};
      const raw=typeof crmExternalCalendarEvents!=='undefined'?crmExternalCalendarEvents.find(e=>e.eventKey===event.eventKey||e.eventId&&e.eventId===event.eventId):null;
      return raw?{...event,allDay:!!(raw.allDay||raw.isAllDay||raw.start?.date)}:event;
    });
  }
  function upcomingRows(list){
    return list.map(f=>{
      const documents=Array.isArray(f.workFileDocuments)?f.workFileDocuments:Array.isArray(f.documents)?f.documents:[];
      const photos=[...(Array.isArray(f.workPhotos)?f.workPhotos:[]),...documents.filter(d=>String(d.type||'').startsWith('image/'))];
      const source=photos.map(p=>p.dataUrl||p.url||'').find(src=>/^data:image\/(png|jpeg|webp|gif);base64,/i.test(src)||/^\/(?!\/)/.test(src)||src.startsWith(location.origin+'/'));
      return `<button class="cc-record" ${fileAttr(f)}><span class="cc-job-mark">${source?`<img src="${esc(source)}" alt="" loading="lazy">`:icon('hammer')}<time>${esc(dateLabel(f.startDate))}</time></span><span><strong>${esc(name(f))}</strong><small>${esc(f.projectAddress||'Address not recorded')}</small><small class="cc-accent">${esc(f.fileStatus)}</small></span>${icon('chevron-right')}</button>`;
    }).join('');
  }
  function chart(data){
    if(!data.periods.length)return empty('No revenue records in this period.');
    const p=data.periods,w=Math.max(420,p.length*58+50),high=Math.max(0,...p.flatMap(p=>[p.revenue,p.expenses,p.profit])),low=Math.min(0,...p.map(p=>p.profit)),span=high-low||1,y=v=>18+(high-v)/span*140,base=y(0),step=(w-50)/p.length;
    return `<div class="cc-chart-scroll" tabindex="0" aria-label="Financial chart"><svg viewBox="0 0 ${w} 198" role="img" aria-label="Gross and expense bars; net profit line" style="min-width:${w}px">${[high,(high+low)/2,low].map(v=>`<line x1="36" x2="${w-8}" y1="${y(v)}" y2="${y(v)}"/><text x="0" y="${y(v)-4}">${esc(new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(v))}</text>`).join('')}${p.map((v,i)=>{const x=44+i*step;return `<g tabindex="0" role="button" data-cc-period="${i}" aria-label="${esc(v.key)}: gross ${money(v.revenue)}, expenses ${money(v.expenses)}, net ${money(v.profit)}. Open records."><title>${esc(v.key)}: gross ${money(v.revenue)}, expenses ${money(v.expenses)}, net ${money(v.profit)}</title>${['revenue','expenses'].map((key,j)=>`<rect class="cc-chart-${key}" x="${x+j*15}" y="${Math.min(base,y(v[key]))}" width="12" height="${Math.max(.5,Math.abs(base-y(v[key])))}" rx="2"/>`).join('')}<text x="${x}" y="185">${esc(v.key.replace(/^20/,''))}</text></g>`;}).join('')}<polyline class="cc-profit-line" points="${p.map((v,i)=>`${56+i*step},${y(v.profit)}`).join(' ')}"/></svg></div><div class="cc-chart-periods">${p.map((v,i)=>`<button data-cc-period="${i}">${esc(v.key)}${icon('arrow-up-right')}</button>`).join('')}</div>`;
  }
  function template(d){
    const f=d.financial,ready=!d.loading&&!d.costsLoading,greeting=d.clock.hour<12?'Good morning':d.clock.hour<18?'Good afternoon':'Good evening';
    const opportunity=d.stages.filter(s=>['new','contact','estimate','negotiation'].includes(s.key)),pipeline=opportunity.reduce((sum,s)=>sum+s.files.reduce((n,f)=>n+B.number(f.estimateTotal),0),0);
    const outcome=a=>a.available?a.count:'Not tracked';
    return `<section class="animus-dashboard-home cc-home" id="animusDashboardHome">
    <header class="cc-header"><div><h1>Command Center</h1><p>Everything you need to run your business, all in one place.</p></div><label class="cc-date">${icon('calendar-days')}<select id="ccRange" aria-label="Dashboard reporting period">${[['month','This month'],['quarter','This quarter'],['ytd','Year to date'],['previousYear','Previous year'],['all','All dates']].map(([key,label])=>`<option value="${key}" ${state.preset===key?'selected':''}>${label}</option>`).join('')}</select></label></header>
    <section class="animus-command-overview" aria-label="Business overview"><div><p>${greeting}</p><h2>${esc(d.profile.companyName||'Your business')}</h2><button data-cc-dialog="alerts">${d.loading?'Loading cloud records…':`${d.alerts.length} ${d.alerts.length===1?'item requires':'items require'} attention`}${icon('arrow-up-right')}</button></div><div class="cc-glance"><h3>This Month at a Glance</h3><div><button data-cc-month ${ready?'':'disabled'}><small>Net Revenue</small><strong>${ready?money(d.month.total.profit):'Loading…'}</strong></button><button data-cc-progress><small>Jobs in Progress</small><strong>${d.loading?'—':files().filter(f=>f.fileStatus==='In Progress').length}</strong></button><span><small>Estimates Sent</small><strong>${d.loading?'—':outcome(d.outcomes.sent)}</strong></span><span><small>Jobs Completed</small><strong>${d.loading?'—':outcome(d.outcomes.completed)}</strong></span></div><small class="animus-command-overview-note">In progress: current status. Sent / completed: recorded dates only.</small></div></section>
    ${d.loading?'<div class="cc-load" role="status">Loading verified cloud records. No browser snapshot is used.</div>':''}
    <section class="cc-kpis" aria-label="Current workfile stages">${d.stages.map((s,i)=>`<button data-cc-stage="${s.key}" class="cc-kpi" ${d.loading?'disabled':''}><span class="cc-round cc-tone-${i}">${icon(s.glyph)}</span><small>${s.label}</small><strong>${d.loading?'—':s.files.length}</strong><em>Current stage</em></button>`).join('')}</section>
    <div class="cc-panels">
    <section class="cc-panel cc-revenue">${head('Revenue & Profit Overview','Revenue','data-cc-view="revenue"')}<div class="cc-financial-metrics">${[['gross','Gross Revenue'],['expenses','Expenses'],['profit','Net Profit'],['margin','Profit Margin']].map(([key,label])=>`<button data-cc-financial="${key}" ${ready?'':'disabled'}><small>${label}</small><strong class="${key==='expenses'?'cc-gold':key==='profit'?'cc-green':''}">${ready?(key==='margin'?f.total.margin==null?'—':f.total.margin.toFixed(1)+'%':money(f.total[key])):'…'}</strong></button>`).join('')}</div><div class="cc-chart-tools"><div class="cc-legend"><span class="gross">Gross</span><span class="expense">Expenses</span><span class="net">Net</span></div><select id="ccPeriod" aria-label="Chart grouping">${['monthly','quarterly','yearly'].map(p=>`<option ${state.period===p?'selected':''}>${p}</option>`).join('')}</select></div>${ready?chart(f):empty(d.loading?'Waiting for verified cloud records.':'Refreshing recorded receipt costs…')}<p class="cc-caption">Revenue dates · Net = gross − job expenses − labor (once). Company overhead excluded.</p>${d.snapshot?.unavailableFiles?`<p class="cc-caption" role="alert">${d.snapshot.unavailableFiles} receipt ledgers unavailable; saved costs retained. <button data-cc-retry>Retry</button></p>`:''}</section>
    <section class="cc-panel cc-schedule">${head("Today's Schedule",'Calendar','data-cc-view="calendar"')}<p class="cc-caption">${esc(d.clock.today)} · ${esc(d.clock.zone)}</p><div class="cc-list">${d.loading?empty('Loading schedule…'):scheduleRows(d.schedule.slice(0,5))||empty('No appointments scheduled today.')}</div>${d.schedule.length>5?`<button class="cc-footer" data-cc-dialog="schedule">View all ${d.schedule.length} events</button>`:''}</section>
    <section class="cc-panel cc-pipeline">${head('Sales Pipeline','View all','data-cc-scope="pipeline"')}<div class="cc-funnel">${opportunity.map((s,i)=>`<button data-cc-stage="${s.key}" class="cc-stage cc-tone-${i}"><span><strong>${s.label}</strong><small>${d.loading?'—':s.files.length} files</small></span><b>${d.loading?'—':money(s.files.reduce((n,f)=>n+B.number(f.estimateTotal),0))}</b><i style="width:${Math.max(2,s.files.length/Math.max(1,...opportunity.map(s=>s.files.length))*100)}%"></i></button>`).join('')}</div><div class="cc-total"><small>Active opportunity pipeline</small><strong>${d.loading?'—':money(pipeline)}</strong></div><p class="cc-caption">Current pre-job stages only. Estimates, not earned revenue.</p></section>
    <section class="cc-panel cc-attention">${head(`Attention Required <span>${d.loading?'—':d.alerts.length}</span>`,'View all','data-cc-dialog="alerts"')}<div class="cc-list">${d.loading?empty('Loading priorities…'):alertRows(d.alerts.slice(0,4))||empty('No dated follow-ups or deadlines require attention.')}</div></section>
    <section class="cc-panel cc-upcoming">${head('Upcoming Jobs','View all','data-cc-scope="upcoming"')}<div class="cc-list">${d.loading?empty('Loading jobs…'):upcomingRows(d.upcoming.slice(0,5))||empty('No future start dates scheduled.')}</div></section>
    <section class="cc-panel cc-activity">${head('Recent Activity','View all','data-cc-dialog="activity"')}<div class="cc-list">${d.loading?empty('Loading activity…'):activityRows(d.activity.slice(0,5))||empty('No dated activity recorded.')}</div></section>
    <section class="cc-panel cc-types">${head('Jobs by Type','Performance','data-cc-view="business"')}<p class="cc-caption">Current file counts · revenue in selected dates</p><div class="cc-list">${ready?f.types.slice(0,5).map((t,i)=>`<button class="cc-type" data-cc-type="${esc(t.type)}"><span><strong>${esc(t.type)}</strong><small>${files().filter(f=>B.fileType(f)===t.type).length} files</small></span><b>${money(t.revenue)}</b><i class="cc-tone-${i%6}" style="width:${Math.max(2,Math.max(0,t.revenue)/Math.max(1,...f.types.map(t=>t.revenue))*100)}%"></i></button>`).join('')||empty('No project types recorded.'):empty('Loading breakdown…')}</div></section>
    <section class="cc-panel cc-team">${head('Team Workload','Assignments','data-cc-scope="assigned"')}<p class="cc-caption">Assigned active job count · recorded assignees, not capacity or employee availability</p><div class="cc-list">${d.loading?empty('Loading assignments…'):d.team.slice(0,5).map((p,i)=>`<button class="cc-person" data-cc-person="${i}"><span class="cc-round">${esc(p.label.split(/\s+/).map(s=>s[0]).slice(0,2).join('').toUpperCase())}</span><span><strong>${esc(p.label)}</strong><small>${p.ids.length} assigned ${p.ids.length===1?'job':'jobs'}</small><i style="width:${p.ids.length/Math.max(1,...d.team.map(p=>p.ids.length))*100}%"></i></span></button>`).join('')||empty('No active assignments recorded.')}</div>${d.team.length>5?'<button class="cc-footer" data-cc-dialog="team">View all assignees</button>':''}</section>
    <section class="cc-panel cc-locations">${head('Job Locations','View all','data-cc-dialog="locations"')}<div class="cc-map-empty">${icon('map-pin')}<span>No connected CRM map provider</span></div><p class="cc-caption">Addresses stay private until you choose to open a map.</p><div class="cc-list">${d.loading?'':files().filter(f=>category(f)==='active'&&f.projectAddress).slice(0,3).map(f=>`<button class="cc-location" ${fileAttr(f)}><strong>${esc(name(f))}</strong><small>${esc(f.projectAddress)}</small></button>`).join('')||empty('No active addresses recorded.')}</div></section>
    </div></section>`;
  }
  function openFile(id,tab='overview'){
    const f=files().find(f=>String(f.id)===String(id));if(!f)return;
    switchCrmView('files');window.animusWorkfileReportScope=null;
    if(typeof filterForCrmFile==='function')activateCrmFilter(filterForCrmFile(f));
    if(window.selectAnimusWorkfile?.(f.id)){renderCrm();window.AnimusWorkfileDetail?.selected(f.id);document.querySelector(`#animusWorkFile [data-animus-tab="${tab}"]`)?.click();}
  }
  function openScope(ids,label){
    switchCrmView('files');window.selectAnimusWorkfile?.(null);activateCrmFilter('all');
    const search=document.getElementById('animusWorkFileSearch');if(search)search.value='';
    document.querySelectorAll('[data-workfile-list-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.workfileListTab==='all')));
    window.animusWorkfileReportScope={ids:ids.map(String),label};renderCrm();
  }
  const openRevenue=(ids,label)=>window.animusOpenRevenueReportScope?.({rowIds:ids,label});
  function dialog(kind,d){
    const previous=document.activeElement;document.getElementById('ccDialog')?.remove();
    const title={alerts:'Attention Required',activity:'Activity History',schedule:"Today's Schedule",team:'Recorded Assignments',locations:'Active Job Locations'}[kind];
    let body=kind==='alerts'?alertRows(d.alerts):kind==='activity'?activityRows(d.activity.slice(0,100)):kind==='schedule'?scheduleRows(d.schedule):kind==='team'?d.team.map((p,i)=>`<button class="cc-record" data-cc-person="${i}"><strong>${esc(p.label)}</strong><span>${p.ids.length} assigned active jobs</span></button>`).join(''):files().filter(f=>category(f)==='active'&&f.projectAddress).map(f=>`<div class="cc-location-row"><button ${fileAttr(f)}><strong>${esc(name(f))}</strong><small>${esc(f.projectAddress)}</small></button><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(f.projectAddress)}" target="_blank" rel="noopener noreferrer">Open map${icon('external-link')}</a></div>`).join('');
    document.body.insertAdjacentHTML('beforeend',`<dialog class="cc-dialog" id="ccDialog" aria-labelledby="ccDialogTitle"><header><h2 id="ccDialogTitle">${title}</h2><form method="dialog"><button aria-label="Close">${icon('x')}</button></form></header><div class="cc-dialog-body">${body||empty('No records to display.')}</div>${kind==='activity'&&d.activity.length>100?'<button class="cc-footer" data-cc-more>Load more activity</button>':''}</dialog>`);
    const modal=document.getElementById('ccDialog');modal.addEventListener('close',()=>{modal.remove();previous?.focus?.({preventScroll:true});});
    let shown=100;modal.querySelector('[data-cc-more]')?.addEventListener('click',e=>{modal.querySelector('.cc-dialog-body').insertAdjacentHTML('beforeend',activityRows(d.activity.slice(shown,shown+100)));shown+=100;bind(modal,d);if(shown>=d.activity.length)e.currentTarget.remove();window.renderAnimusCommandIcons?.();});
    bind(modal,d);modal.showModal();window.renderAnimusCommandIcons?.();
  }
  function bind(root,d){
    const on=(s,fn)=>root.querySelectorAll(s).forEach(el=>{if(el.dataset.ccBound)return;el.dataset.ccBound='1';el.addEventListener('click',()=>{el.closest('dialog')?.close();fn(el);});});
    on('[data-cc-file]',el=>openFile(el.dataset.ccFile,el.dataset.ccTab));
    on('[data-cc-view]',el=>switchCrmView(el.dataset.ccView));
    on('[data-cc-stage]',el=>{const s=d.stages.find(s=>s.key===el.dataset.ccStage);openScope(s.files.map(f=>f.id),s.label);});
    on('[data-cc-progress]',()=>openScope(files().filter(f=>f.fileStatus==='In Progress').map(f=>f.id),'Jobs in progress'));
    on('[data-cc-scope]',el=>{const key=el.dataset.ccScope,list=key==='upcoming'?d.upcoming:key==='assigned'?files().filter(f=>d.team.some(p=>p.ids.includes(String(f.id)))):files().filter(f=>['new','contact','estimate','negotiation'].includes(category(f)));openScope(list.map(f=>f.id),key==='upcoming'?'Upcoming scheduled jobs':key==='assigned'?'Assigned active jobs':'Active opportunities');});
    on('[data-cc-person]',el=>{const p=d.team[Number(el.dataset.ccPerson)];openScope(p.ids,`${p.label}: active assignments`);});
    on('[data-cc-type]',el=>{const t=d.financial.types.find(t=>t.type===el.dataset.ccType);if(t.rowIds.length)openRevenue(t.rowIds,`${t.type}: recorded revenue`);else openScope(t.fileIds,`${t.type}: workfiles`);});
    on('[data-cc-period]',el=>{const p=d.financial.periods[Number(el.dataset.ccPeriod)];openRevenue(p.rowIds,`${p.key}: Command Center`);});
    root.querySelectorAll('g[data-cc-period]').forEach(el=>el.onkeydown=e=>{if(['Enter',' '].includes(e.key)){e.preventDefault();el.dispatchEvent(new MouseEvent('click',{bubbles:true}));}});
    on('[data-cc-financial]',el=>el.dataset.ccFinancial==='expenses'?switchCrmView('expenses'):openRevenue(d.financial.rows.map(r=>r.id),'Command Center reporting period'));
    on('[data-cc-month]',()=>openRevenue(d.month.rows.map(r=>r.id),'Current month net revenue'));
    on('[data-cc-dialog]',el=>dialog(el.dataset.ccDialog,d));
    on('[data-cc-event]',el=>{switchCrmView('calendar');if(typeof selectCalendarEvent==='function')selectCalendarEvent(el.dataset.ccEvent);if(typeof openCalendarPanel==='function')openCalendarPanel('crmCalendarEventPanel');});
    on('[data-cc-retry]',()=>window.animusRefreshBusinessExpenseReport?.());
    root.querySelector('#ccRange')?.addEventListener('change',e=>{state.preset=e.target.value;render();});
    root.querySelector('#ccPeriod')?.addEventListener('change',e=>{state.period=e.target.value;render();});
  }
  function showHome(show,showFiles=false,showEstimator=false){
    const root=document.getElementById('animusDashboardHome');if(root)root.hidden=!show;
    document.body.dataset.animusView=show?'dashboard':showEstimator?'estimator':'files';
    if(show||showFiles||showEstimator){const estimator=document.querySelector('#crmEstimatorView')?.closest('.crm-dashboard-view');document.querySelectorAll('.crm-dashboard-view').forEach(s=>{s.hidden=show?true:showEstimator?s!==estimator:false;});}
  }
  function render(){
    const shell=document.querySelector('.crm-dashboard');if(!shell||!M||!B)return;
    const old=document.getElementById('animusDashboardHome'),hidden=old?old.hidden:document.body.dataset.animusView!=='dashboard',focused=document.activeElement?.id,d=read();
    old?.remove();shell.insertAdjacentHTML('afterbegin',template(d));const root=document.getElementById('animusDashboardHome');root.hidden=hidden;bind(root,d);window.renderAnimusCommandIcons?.();
    if(['ccRange','ccPeriod'].includes(focused))document.getElementById(focused)?.focus({preventScroll:true});
  }
  const originalSwitch=switchCrmView;
  switchCrmView=function animusSwitchCrmView(view){const home=view==='dashboard',file=view==='files',estimate=view==='estimator';originalSwitch(file?'dashboard':view);showHome(home,file,estimate);if(home)render();};
  window.animusDashboardRender=render;
  const start=()=>{render();showHome(true);const notice=document.getElementById('crmCloudLoadNotice');if(notice)new MutationObserver(()=>{if(document.body.dataset.animusView==='dashboard')render();}).observe(notice,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true});};
  document.addEventListener('DOMContentLoaded',()=>setTimeout(start,0));if(document.readyState!=='loading')setTimeout(start,0);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.body.dataset.animusView==='dashboard')render();});
  setInterval(()=>{if(!document.hidden&&document.body.dataset.animusView==='dashboard'&&!document.getElementById('ccDialog'))render();},60000);
  if(typeof renderCalendar==='function'){const original=renderCalendar;renderCalendar=function(...args){const result=original.apply(this,args);if(document.body.dataset.animusView==='dashboard')render();return result;};}
})();
