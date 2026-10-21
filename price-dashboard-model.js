/* Read-only views of the canonical price database. Never reconstruct history. */
(() => {
  const price = row => Number(row.defaultPrice) || 0;
  const category = row => String(row.category || "Custom");
  const vendor = row => String(row.vendor || row.source || "");
  function date(row) {
    const value=String(row.updatedAt || row.lastChecked || "");
    const match=value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match && !Number.isNaN(Date.parse(match[1]+"T12:00:00")) ? match[1] : "";
  }
  function filter(rows,state,now=new Date()) {
    const query=String(state.query||"").trim().toLowerCase();
    const cutoff=state.recent ? new Date(now.getFullYear(),now.getMonth(),now.getDate()-Number(state.recent)).getTime() : 0;
    return rows.filter(row=>{
      const updated=date(row),value=price(row);
      return (!query || [row.product,row.name,row.description,row.category,vendor(row),row.unit,row.id].join(" ").toLowerCase().includes(query))
        && (!state.category || category(row)===state.category)
        && (!state.vendor || vendor(row)===state.vendor)
        && (!state.unit || String(row.unit||"each")===state.unit)
        && (!state.year || updated.startsWith(state.year))
        && (state.min==="" || state.min==null || value>=Number(state.min))
        && (state.max==="" || state.max==null || value<=Number(state.max))
        && (!cutoff || updated && Date.parse(updated+"T12:00:00")>=cutoff);
    }).sort((a,b)=>{
      const read=row=>state.sort==="price"?price(row):state.sort==="updated"?date(row):state.sort==="category"?category(row):state.sort==="vendor"?vendor(row):state.sort==="unit"?row.unit||"each":row.product||row.name||"";
      const av=read(a),bv=read(b),order=typeof av==="number"?av-bv:String(av).localeCompare(String(bv));
      return (state.direction===-1?-1:1)*(order||String(a.id).localeCompare(String(b.id)));
    });
  }
  function summarize(rows) {
    const categories=new Map();let sum=0;
    for(const row of rows){const key=category(row),group=categories.get(key)||{name:key,count:0,total:0};group.count++;group.total+=price(row);categories.set(key,group);sum+=price(row);}
    const groups=[...categories.values()].map(group=>({...group,average:group.total/group.count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
    return {count:rows.length,average:rows.length?sum/rows.length:null,categories:groups,mostExpensive:[...groups].sort((a,b)=>b.average-a.average)[0]||null};
  }
  function csv(rows) {
    const quote=value=>{let text=String(value??"");if(/^[\s]*[=+@\-]/.test(text))text="'"+text;return `"${text.replace(/"/g,'""')}"`;};
    const lines=rows.map(row=>[row.product||row.name||"",row.description||"",category(row),vendor(row),row.unit||"each",price(row).toFixed(2),date(row),row.id]);
    return [["Item Name","Description","Category","Vendor","Unit","Current Price","Last Updated / Checked","ID"],...lines].map(line=>line.map(quote).join(",")).join("\n");
  }
  globalThis.AnimusPriceModel={price,category,vendor,date,filter,summarize,csv};
})();
