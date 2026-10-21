/* Read-only aggregation. Revenue remains the source of financial amounts. */
(() => {
  const number = value => Number(String(value ?? 0).replace(/[$,]/g, "")) || 0;
  function summarize(rows, getProfit) {
    const total = rows.reduce((sum, row) => {
      for (const key of ["gross", "expenses", "labor"]) sum[key] += number(row[key]);
      sum.profit += getProfit(row);
      return sum;
    }, {gross:0, expenses:0, labor:0, profit:0});
    return {...total, margin:total.gross ? total.profit / total.gross * 100 : null};
  }
  function analyze(rows, {fileFor = () => null, dateFor = row => row.date, getProfit = row => number(row.gross)-number(row.expenses)-number(row.labor), period = "monthly"} = {}) {
    const groups = {types:new Map(), customers:new Map(), months:new Map(), periods:new Map()};
    const costs = new Map();
    const addCost = (key, amount) => costs.set(key, (costs.get(key) || 0) + amount);
    const add = (map, key, row) => { if (!map.has(key)) map.set(key, []); map.get(key).push(row); };
    rows.forEach(row => {
      const file = fileFor(row);
      add(groups.types, file?.projectType || "Unclassified", row);
      add(groups.customers, file?.clientName || row.clientName || row.clientJob || "Unlinked customer", row);
      const date = String(dateFor(row) || "").match(/^(\d{4})-(\d{2})/);
      if (date && +date[2] >= 1 && +date[2] <= 12) {
        add(groups.months, `${date[1]}-${date[2]}`, row);
        const key = period === "yearly" ? date[1] : period === "quarterly" ? `${date[1]}-Q${Math.ceil(+date[2]/3)}` : `${date[1]}-${date[2]}`;
        add(groups.periods, key, row);
      } else add(groups.periods, "Undated", row);
      // Classify only reconciled receipt lines. Manual differences stay explicit.
      let classified = 0;
      const seen = new Set();
      for (const line of Array.isArray(row.expenseLines) ? row.expenseLines : []) {
        if (line.id && seen.has(line.id)) continue;
        if (line.id) seen.add(line.id);
        const amount = number(line.amount);
        const category = String(line.category || "Uncategorized").trim();
        const key = /^(supplies|materials)$/i.test(category) ? "Materials" : /subcontract/i.test(category) ? "Subcontractors" : /^labor$/i.test(category) ? "Labor (expenses)" : category;
        addCost(key, amount); classified += amount;
      }
      addCost("Uncategorized / adjustments", number(row.expenses) - classified);
      // Payroll is already represented by row.labor; never add payroll records again.
      addCost("Labor (payroll)", number(row.labor));
    });
    const aggregate = map => [...map].map(([name, list]) => ({name, count:list.length, ...summarize(list, getProfit)}));
    return {total:summarize(rows,getProfit), types:aggregate(groups.types).sort((a,b)=>(b.margin ?? -Infinity)-(a.margin ?? -Infinity)), customers:aggregate(groups.customers).sort((a,b)=>b.profit-a.profit), months:aggregate(groups.months).sort((a,b)=>b.profit-a.profit), periods:aggregate(groups.periods).sort((a,b)=>a.name.localeCompare(b.name)), costs:[...costs].filter(([,value])=>Math.abs(value)>.005).map(([name,value])=>({name,value})), costTotal:summarize(rows,getProfit).expenses+summarize(rows,getProfit).labor};
  }
  globalThis.AnimusRevenueAnalytics = {summarize, analyze};
})();
