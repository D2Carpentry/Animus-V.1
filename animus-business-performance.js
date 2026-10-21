/* Presentation-only analytics over the canonical CRM records. */
(() => {
  const M = globalThis.AnimusBusinessModel;
  const state = {preset:'all',from:'',to:'',period:'monthly',filters:{},filterOpen:false,tableType:'',sort:'revenue',direction:-1,series:{revenue:true,expenses:true,profit:true}};
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value)||0);
  const percent = value => value == null ? 'Not available' : `${value.toFixed(1)}%`;
  const icon = name => `<i data-business-icon="${name}" aria-hidden="true"></i>`;
  const files = () => typeof crmFiles !== 'undefined' && Array.isArray(crmFiles) ? crmFiles : [];
  const rows = () => typeof crmRevenueRows !== 'undefined' && Array.isArray(crmRevenueRows) ? crmRevenueRows : [];
  const profit = row => typeof revenueProfit === 'function' ? revenueProfit(row) : M.number(row.gross)-M.number(row.expenses)-M.number(row.labor);
  function linkedFile(row) {
    // An explicit relationship must never silently resolve to a similarly named customer.
    const id = row.dashboardFileId || row.fileId || row.attachedEstimate?.dashboardFileId;
    if (id) return files().find(file => String(file.id) === String(id)) || null;
    const number = row.fileNumber || row.projectNumber || row.attachedEstimate?.fileNumber;
    if (number) return files().find(file => String(file.fileNumber) === String(number)) || null;
    return typeof findFileForRevenue === 'function' ? findFileForRevenue(row) : null;
  }
  function aggregate(range) {
    return M.aggregate({files:files(),rows:rows(),range,filters:state.filters,period:state.period,fileForRow:linkedFile,profit,
      categoryForFile:typeof crmFileCategory === 'function' ? crmFileCategory : undefined});
  }
  function periodLabel(key) {
    return /^\d{4}-\d{2}$/.test(key) ? new Date(`${key}-01T12:00:00`).toLocaleDateString('en-US',{month:'short',year:'numeric'}) : key.replace('-Q',' Q');
  }
  function comparison(key,total,previous) {
    if (!previous?.rows.length) return '<small>Comparison unavailable</small>';
    const before=previous.total[key],after=total[key];
    if (!before) return '<small>No nonzero prior baseline</small>';
    const change=(after-before)/Math.abs(before)*100;
    const good = ['expenses','labor'].includes(key) ? change<0 : change>0;
    return `<small class="${change===0?'':good?'bp-positive':'bp-negative'}">${change>0?'+':''}${change.toFixed(1)}% vs prior period</small>`;
  }
  function chart(data) {
    if (!data.periods.length) return '<div class="bp-empty">No revenue records in this reporting period.</div>';
    const points=data.periods, width=Math.max(420,points.length*68+60);
    const values=points.flatMap(p=>Object.keys(state.series).filter(key=>state.series[key]).map(key=>p[key]));
    const high=Math.max(0,...values),low=Math.min(0,...values),span=high-low||1;
    const y=value=>20+(high-value)/span*150,base=y(0),step=(width-60)/points.length;
    const descriptions=p=>`${periodLabel(p.key)}. Gross revenue ${money(p.revenue)}; expenses ${money(p.expenses)}; net profit ${money(p.profit)}.`;
    return `<div class="bp-chart-scroll" tabindex="0" aria-label="Revenue chart, scroll for more periods"><svg class="bp-chart" viewBox="0 0 ${width} 205" style="min-width:${width}px" role="img" aria-label="Gross revenue and expenses bars, net profit line">
      ${[high,(high+low)/2,low].map(v=>`<line x1="45" x2="${width-10}" y1="${y(v)}" y2="${y(v)}"/><text x="3" y="${y(v)-4}">${new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(v)}</text>`).join('')}
      <line class="bp-baseline" x1="45" x2="${width-10}" y1="${base}" y2="${base}"/>
      ${points.map((p,i)=>{const x=55+i*step;return `<g data-bp-period="${i}" tabindex="0" role="button" aria-label="${safe(descriptions(p))} Open records."><title>${safe(descriptions(p))}</title>${['revenue','expenses'].filter(key=>state.series[key]).map((key,j)=>`<rect class="bp-${key}" x="${x+j*17}" y="${Math.min(base,y(p[key]))}" width="14" height="${Math.max(0.5,Math.abs(y(p[key])-base))}" rx="2"/>`).join('')}<text x="${x}" y="194">${safe(/^\d{4}-\d{2}$/.test(p.key)?new Date(p.key+'-01T12:00:00').toLocaleDateString('en-US',{month:'short',year:'2-digit'}):periodLabel(p.key))}</text></g>`;}).join('')}
      ${state.series.profit?`<polyline class="bp-profit-line" points="${points.map((p,i)=>`${70+i*step},${y(p.profit)}`).join(' ')}"/>${points.map((p,i)=>`<circle cx="${70+i*step}" cy="${y(p.profit)}" r="3" class="bp-profit-point"><title>${safe(descriptions(p))}</title></circle>`).join('')}`:''}</svg></div>
      <div class="bp-period-details">${points.map((p,i)=>`<details><summary>${safe(periodLabel(p.key))}</summary><p>Gross <b>${money(p.revenue)}</b><br>Expenses <b>${money(p.expenses)}</b><br>Net profit <b>${money(p.profit)}</b></p><button data-bp-period="${i}">Open ${p.rowIds.length} records</button></details>`).join('')}</div>`;
  }
  function table(data) {
    const columns=[['type','Type of Work'],['files','Files'],['landed','Landed'],['closeRate','Close %'],['pipeline','Pipeline'],['revenue','Income'],['expenses','Expenses'],['labor','Labor'],['profit','Net'],['margin','Margin']];
    const visible=data.types.filter(t=>!state.tableType||t.type===state.tableType).sort((a,b)=>{
      const av=a[state.sort],bv=b[state.sort];
      if(av==null)return bv==null?0:1;if(bv==null)return -1;
      return state.direction*(typeof av==='string'?av.localeCompare(bv):av-bv);
    });
    return `<section class="bp-worktypes"><header class="bp-section-head"><div><h2>Work Type Performance</h2><p>See which services bring in leads, landed jobs, income, and margin.</p></div><span>${data.files.length} total workfiles · ${data.types.reduce((sum,t)=>sum+t.landed,0)} landed</span></header>
      <div class="bp-types">${data.types.slice(0,4).map(t=>`<button data-bp-type-filter="${safe(t.type)}" aria-pressed="${state.tableType===t.type}"><span>${safe(t.type)}</span><strong>${money(t.revenue)}</strong><small>${t.files} files · ${t.landed} landed · ${percent(t.closeRate)} close</small></button>`).join('')||'<p class="bp-muted">No work types in this reporting period.</p>'}</div>
      ${state.tableType?`<p class="bp-scope" role="status">Work Type table only: ${safe(state.tableType)} <button data-bp-clear-type>Clear selection</button></p>`:''}
      <div class="bp-table-scroll" tabindex="0" aria-label="Work type performance table"><table><thead><tr>${columns.map(([key,label])=>`<th aria-sort="${state.sort===key?state.direction===1?'ascending':'descending':'none'}"><button data-bp-sort="${key}">${label}${state.sort===key?state.direction===1?' ↑':' ↓':''}</button></th>`).join('')}</tr></thead><tbody>${visible.map(t=>`<tr><td><button class="bp-text-link" data-bp-type-open="${safe(t.type)}">${safe(t.type)}</button><small>${t.open} open · ${t.lost} lost${t.unlinked?` · ${t.unlinked} unlinked revenue rows`:''}${t.outsideCohort?` · ${t.outsideCohort} rows from earlier files`:''}</small></td><td>${t.files}</td><td>${t.landed}</td><td>${percent(t.closeRate)}</td><td>${money(t.pipeline)}</td><td>${money(t.revenue)}</td><td class="bp-expense-text">${money(t.expenses)}</td><td class="bp-labor-text">${money(t.labor)}</td><td class="${t.profit<0?'bp-negative':t.profit>0?'bp-positive':''}">${money(t.profit)}</td><td class="${t.margin<0?'bp-negative':''}">${percent(t.margin)}</td></tr>`).join('')||'<tr><td colspan="10">No matching project types.</td></tr>'}</tbody></table></div>
      <p class="bp-footnote">Close % = landed ÷ all cohort files, including open opportunities. Pipeline = estimates on non-closed cohort files, including active jobs; not earned revenue. Margins use aggregate income and costs.</p>
    </section>`;
  }
  function options(values,current,label) {
    return `<option value="">${label}</option>${[...new Set(values.filter(Boolean))].sort().map(value=>`<option value="${safe(value)}" ${value===current?'selected':''}>${safe(value)}</option>`).join('')}`;
  }
  function insight(label,value,amount,key) {
    return `<button class="bp-insight" ${key?`data-bp-insight="${key}"`:'disabled'}><small>${label}</small><span>${safe(value||'Not available')}${key?' <b aria-hidden="true">↗</b>':''}</span><strong>${safe(amount||'No qualifying records')}</strong></button>`;
  }
  function render() {
    const root=document.getElementById('animusBusinessPerformance');if(!root||!M)return;
    const range=M.range(state.preset,new Date(),state.from,state.to);
    const data=aggregate(range),previous=range.previous?aggregate(range.previous):null;
    const best=[...data.types].filter(t=>t.revenue>0&&t.margin!=null).sort((a,b)=>b.margin-a.margin)[0];
    const expense=[...data.types].filter(t=>t.expenses>0).sort((a,b)=>b.expenses-a.expenses)[0];
    const labor=[...data.types].filter(t=>t.labor>0).sort((a,b)=>b.labor-a.labor)[0],month=data.months[0];
    const loading=typeof crmCloudAuthoritativeLoaded!=='undefined'&&!crmCloudAuthoritativeLoaded;
    const loadError=document.getElementById('crmCloudLoadNotice');
    const kpis=[['profit','Net Revenue','dollar-sign',data.total.margin==null?'Revenue required for margin':`${percent(data.total.margin)} of gross revenue`],['gross','Gross Revenue','chart-no-axes-combined','Recorded revenue, not payments'],['expenses','Expenses','package','Recorded job expenses'],['profit','Profit','chart-no-axes-combined','Same net measure as Net Revenue'],['labor','Labor','layers','Recorded workfile labor, counted once'],['count','Revenue Rows','layers','Tracked financial records']];
    root.innerHTML=`<section class="business-dashboard"><header class="bp-header"><div><h1>Business Performance</h1><p>Pipeline, revenue, profit, expenses, and work-type performance from existing ANIMUS records.</p></div><div class="bp-tools"><select id="bpRange" aria-label="Reporting period">${[['all','All dates'],['month','Current month'],['previousMonth','Previous month'],['quarter','Current quarter'],['ytd','Year to date'],['previousYear','Previous year'],['custom','Custom range']].map(([key,label])=>`<option value="${key}" ${state.preset===key?'selected':''}>${label}</option>`).join('')}</select><button id="bpFilters" aria-expanded="${state.filterOpen}">${icon('sliders-horizontal')}Filters</button><button id="bpExport">${icon('download')}Export</button><button class="bp-primary" id="bpRevenue">Open Revenue</button></div></header>
      ${state.preset==='custom'?`<div class="bp-custom"><label>From<input id="bpFrom" type="date" value="${safe(state.from)}"></label><label>Through<input id="bpTo" type="date" value="${safe(state.to)}"></label></div>`:''}
      ${state.filterOpen?`<div class="bp-filters"><label>Project type<select data-bp-filter="type">${options([...files(),...rows()].map(M.fileType),state.filters.type,'All project types')}</select></label><label>Current status<select data-bp-filter="status">${options(files().map(f=>f.fileStatus),state.filters.status,'All statuses')}</select></label><label>Lead source<select data-bp-filter="source">${options(files().map(f=>f.leadSource),state.filters.source,'All sources')}</select></label></div>`:''}
      ${Object.values(state.filters).some(Boolean)||state.preset!=='all'?`<p class="bp-scope">${range.error?safe(range.error):range.from?`${safe(range.from)} through ${safe(range.to)}`:'All dates'}${Object.values(state.filters).filter(Boolean).map(v=>` · ${safe(v)}`).join('')} <button id="bpClear">Clear filters</button></p>`:''}
      ${loading?`<div class="bp-empty" role="status">${loadError&&!loadError.hidden?safe(loadError.textContent):'Loading verified cloud records…'}</div>`:range.error?'':`
      <section class="bp-kpis">${kpis.map(([key,label,glyph,note])=>`<article><span>${icon(glyph)}${label}</span><strong class="${data.total[key]<0?'bp-negative':key==='expenses'?'bp-expense-text':key==='labor'?'bp-labor-text':key==='profit'?'bp-positive':''}">${key==='count'?data.total.count:money(data.total[key])}</strong><small>${note}</small>${comparison(key,data.total,previous)}</article>`).join('')}</section>
      <div class="bp-analytics"><section class="bp-panel"><header><h2>Revenue vs Expenses</h2><select id="bpPeriod" aria-label="Chart grouping">${['monthly','quarterly','yearly'].map(p=>`<option value="${p}" ${p===state.period?'selected':''}>${p[0].toUpperCase()+p.slice(1)}</option>`).join('')}</select></header><div class="bp-legend">${[['revenue','Gross Revenue'],['expenses','Expenses'],['profit','Net Profit']].map(([key,label])=>`<button data-bp-series="${key}" aria-pressed="${state.series[key]}"><i class="bp-dot bp-${key}"></i>${label}</button>`).join('')}</div>${chart(data)}<p class="bp-footnote">Revenue dates. Profit = gross − job expenses − labor. Company overhead is not added to job costs.</p></section>
      <section class="bp-panel"><header><h2>Sales Pipeline</h2><small>${data.files.length} files</small></header><div class="bp-funnel" aria-hidden="true">${data.stages.map((s,i)=>`<i style="width:${100-i*11}%;--stage:${['#5b8def','#b694ef','#d9af5e','#66b8c5','#7abb94','#8594aa'][i]}"></i>`).join('')}</div><div class="bp-stages">${data.stages.map((s,i)=>`<button data-bp-stage="${i}" ${s.files.length?'':'disabled'}><span>${safe(s.name)}<small>${s.files.length} files</small></span><b>${s.valued?money(s.value):'No estimate value'}</b></button>`).join('')}</div><p class="bp-footnote">Current stages of files created in the reporting period, not historical stage snapshots.${range.from&&data.undatedFiles?` ${data.undatedFiles} files without a creation date excluded.`:''}</p><p class="bp-muted">Won this period: ${data.wins.length?`<button id="bpWins">${data.wins.length} recorded wins</button>`:'Not available — no recorded won dates in period.'}${data.unknownWinDates?` ${data.unknownWinDates} landed files have no recorded won date.`:''}</p></section>
      <section class="bp-panel bp-insights"><header><h2>Key Insights</h2></header>${insight('Best Performing Type',best?.type,best?percent(best.margin):'',best?'best':'')}${insight('Highest Revenue Month',month?periodLabel(month.key):'',month?money(month.revenue):'',month?'month':'')}${insight('Most Expenses',expense?.type,expense?money(expense.expenses):'',expense?'expenses':'')}${insight('Most Labor Cost',labor?.type,labor?money(labor.labor):'',labor?'labor':'')}<p class="bp-footnote">Best type is ranked by aggregate margin, not average job percentages.</p></section></div>
      ${table(data)}<p class="bp-method">Financials use revenue dates; file counts and pipeline use creation dates. Status and lead source filters use current workfile attributes.${data.unlinked?` ${data.unlinked} unlinked financial rows retained.`:''} Net Revenue and Profit intentionally share the existing ANIMUS calculation.</p>`}</section>`;
    const bind=(selector,event,fn)=>root.querySelectorAll(selector).forEach(el=>el.addEventListener(event,e=>fn(el,e)));
    bind('#bpRange','change',el=>{state.preset=el.value;render();});
    bind('#bpPeriod','change',el=>{state.period=el.value;render();});
    bind('#bpFrom,#bpTo','change',el=>{state[el.id==='bpFrom'?'from':'to']=el.value;render();});
    bind('#bpFilters','click',()=>{state.filterOpen=!state.filterOpen;render();});
    bind('[data-bp-filter]','change',el=>{state.filters[el.dataset.bpFilter]=el.value;state.tableType='';render();});
    bind('#bpClear','click',()=>{state.filters={};state.preset='all';state.tableType='';render();});
    bind('[data-bp-series]','click',el=>{const key=el.dataset.bpSeries;if(state.series[key]&&Object.values(state.series).filter(Boolean).length===1)return;state.series[key]=!state.series[key];render();});
    bind('[data-bp-sort]','click',el=>{const key=el.dataset.bpSort;state.direction=state.sort===key?-state.direction:key==='type'?1:-1;state.sort=key;render();});
    bind('[data-bp-type-filter]','click',el=>{state.tableType=state.tableType===el.dataset.bpTypeFilter?'':el.dataset.bpTypeFilter;render();});
    bind('[data-bp-clear-type]','click',()=>{state.tableType='';render();});
    bind('[data-bp-type-open]','click',el=>{const t=data.types.find(t=>t.type===el.dataset.bpTypeOpen);openRecords(t.type,t.fileIds,t.rowIds);});
    bind('[data-bp-stage]','click',el=>{const stage=data.stages[Number(el.dataset.bpStage)];openWorkfiles(stage.files,stage.name);});
    bind('#bpWins','click',()=>openWorkfiles(data.wins,'Recorded wins'));
    bind('[data-bp-period]','click',el=>{const p=data.periods[Number(el.dataset.bpPeriod)];financialDialog(periodLabel(p.key),p.rowIds);});
    bind('g[data-bp-period]','keydown',(el,event)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();const p=data.periods[Number(el.dataset.bpPeriod)];financialDialog(periodLabel(p.key),p.rowIds);}});
    bind('#bpRevenue','click',()=>openRevenue(data.rows.map(r=>r.id),'Business Performance reporting period'));
    bind('#bpExport','click',()=>{if(loading||range.error)return;const link=document.createElement('a');link.href=URL.createObjectURL(new Blob(['\ufeff'+M.csv(data.types.filter(t=>!state.tableType||t.type===state.tableType))],{type:'text/csv;charset=utf-8'}));link.download=`ANIMUS Business Performance ${range.from||'all'} ${range.to||'dates'}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);});
    bind('[data-bp-insight]','click',el=>{
      if(el.dataset.bpInsight==='best'){state.tableType=best.type;render();root.querySelector('.bp-worktypes')?.scrollIntoView({block:'nearest',behavior:'smooth'});}
      if(el.dataset.bpInsight==='month')financialDialog(periodLabel(month.key),month.rowIds);
      if(el.dataset.bpInsight==='expenses')financialDialog(`${expense.type} expenses`,expense.rowIds,true);
      if(el.dataset.bpInsight==='labor')openRecords(`${labor.type} labor`,labor.fileIds,labor.rowIds);
    });
    root.querySelectorAll('.bp-funnel i').forEach((bar,index)=>{
      const count=data.stages[index].files.length,max=Math.max(1,...data.stages.map(s=>s.files.length));
      bar.style.width=`${Math.max(3,count/max*100)}%`;
      bar.style.opacity=count?'.75':'.15';
    });
    window.renderAnimusBusinessIcons?.();
  }
  function dialog(title,body) {
    const previous=document.activeElement;
    document.getElementById('bpDialog')?.remove();
    document.body.insertAdjacentHTML('beforeend',`<dialog id="bpDialog" class="bp-dialog"><form method="dialog"><header><h2>${safe(title)}</h2><button aria-label="Close">${icon('x')}</button></header></form>${body}</dialog>`);
    const el=document.getElementById('bpDialog');el.addEventListener('close',()=>{el.remove();if(previous?.isConnected)previous.focus({preventScroll:true});});el.showModal();window.renderAnimusBusinessIcons?.();return el;
  }
  function openRevenue(ids,label) {
    if(window.animusOpenRevenueReportScope)window.animusOpenRevenueReportScope({rowIds:ids,label});
    else if(typeof switchCrmView==='function')switchCrmView('revenue');
  }
  function financialDialog(title,ids,expenseMode=false) {
    const selectedIds=new Set(ids.map(String)),selected=rows().filter(row=>selectedIds.has(String(row.id)));
    const el=dialog(title,`<p class="bp-muted">${selected.length} recorded financial rows. Amounts use the same calculation as Revenue.</p><button class="bp-primary" data-bp-open-revenue>Open these records in Revenue</button><div class="bp-records">${selected.map(row=>{const file=linkedFile(row);return `<article><h3>${safe(file?.clientName||row.clientJob||'Unlinked financial record')}</h3><p>${safe(M.date(row.date)||'Undated')} · ${safe(file?.fileNumber||'No linked workfile')}</p><dl><dt>Gross</dt><dd>${money(row.gross)}</dd><dt>Expenses</dt><dd>${money(row.expenses)}</dd><dt>Labor</dt><dd>${money(row.labor)}</dd><dt>Net</dt><dd>${money(profit(row))}</dd></dl>${file?`<button data-bp-file="${safe(file.id)}">Open workfile</button>`:''}${expenseMode&&file?`<button data-bp-expenses="${safe(row.id)}">Open file expenses</button>`:''}</article>`;}).join('')||'<p>No matching records.</p>'}</div>`);
    el.querySelector('[data-bp-open-revenue]').onclick=()=>{el.close();openRevenue(ids,title);};
    el.querySelectorAll('[data-bp-file]').forEach(button=>button.onclick=()=>{el.close();openFile(button.dataset.bpFile);});
    el.querySelectorAll('[data-bp-expenses]').forEach(button=>button.onclick=()=>{el.close();if(typeof openRevenueExpenses==='function')openRevenueExpenses(button.dataset.bpExpenses);});
  }
  function openRecords(label,ids,rowIds) {
    // Keep orphan financials accessible even when there are no related files.
    if(!ids.length)return financialDialog(label,rowIds);
    const el=dialog(label,`<p class="bp-muted">Related workfiles include earlier files with financial activity in this period.</p><button data-bp-all-files>Open ${ids.length} workfiles</button> <button data-bp-financials>View ${rowIds.length} financial rows</button><div class="bp-records">${files().filter(f=>ids.includes(String(f.id))).map(f=>`<button data-bp-file="${safe(f.id)}">${safe(f.clientName)} · ${safe(f.fileNumber)}<small>${safe(f.fileStatus)}</small></button>`).join('')}</div>`);
    el.querySelector('[data-bp-all-files]').onclick=()=>{el.close();openWorkfiles(ids,label);};
    el.querySelector('[data-bp-financials]').onclick=()=>{el.close();financialDialog(label,rowIds);};
    el.querySelectorAll('[data-bp-file]').forEach(button=>button.onclick=()=>{el.close();openFile(button.dataset.bpFile);});
  }
  function openFile(id) {
    window.animusWorkfileReportScope=null;
    if(typeof switchCrmView==='function')switchCrmView('files');
    if(window.selectAnimusWorkfile?.(id)){if(typeof renderCrm==='function')renderCrm();window.AnimusWorkfileDetail?.selected(id);}
  }
  function openWorkfiles(ids,label) {
    if(typeof switchCrmView==='function')switchCrmView('files');
    window.selectAnimusWorkfile?.(null);
    if(typeof activateCrmFilter==='function')activateCrmFilter('all');
    const search=document.getElementById('animusWorkFileSearch');if(search)search.value='';
    document.querySelectorAll('[data-workfile-list-tab]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.workfileListTab==='all')));
    window.animusWorkfileReportScope={ids:ids.map(String),label};
    if(typeof renderCrm==='function')renderCrm();
  }
  window.animusRenderWorkfileReportScope=()=>{
    document.getElementById('bpWorkfileScope')?.remove();
    const scope=window.animusWorkfileReportScope,host=document.getElementById('crmFileList');if(!scope||!host)return;
    host.insertAdjacentHTML('beforebegin',`<div id="bpWorkfileScope" class="bp-workfile-scope" role="status">Report: ${safe(scope.label)} <button type="button">Clear report filter</button></div>`);
    document.querySelector('#bpWorkfileScope button').onclick=()=>{window.animusWorkfileReportScope=null;if(typeof renderFileList==='function')renderFileList();};
  };
  document.addEventListener('click',event=>{if(event.target.closest('[data-animus-shell-view="files"]')){window.animusWorkfileReportScope=null;window.animusRenderWorkfileReportScope();}},true);
  window.renderBusinessPerformance=render;
  document.addEventListener('DOMContentLoaded',()=>{
    render();
    const notice=document.getElementById('crmCloudLoadNotice');
    if(notice)new MutationObserver(()=>{if(!document.getElementById('crmBusinessView')?.hidden)render();}).observe(notice,{attributes:true,attributeFilter:['hidden'],childList:true,subtree:true});
  });
})();
