/* Business reporting reads the existing revenue rows and work files. */
(() => {
  const money = (value) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

  const numeric = (value) => typeof parseMoney === "function" ? parseMoney(value) : Number(value) || 0;
  const revenueRows = () => typeof crmRevenueRows !== "undefined" && Array.isArray(crmRevenueRows) ? crmRevenueRows : [];
  const workFiles = () => typeof crmFiles !== "undefined" && Array.isArray(crmFiles) ? crmFiles : [];
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));

  function rowProfit(row) {
    return typeof revenueProfit === "function"
      ? revenueProfit(row)
      : numeric(row.gross) - numeric(row.expenses) - numeric(row.labor);
  }

  function totals() {
    return revenueRows().reduce((sum, row) => {
      const gross = numeric(row.gross);
      const expenses = numeric(row.expenses);
      const labor = numeric(row.labor);
      return {
        gross: sum.gross + gross,
        expenses: sum.expenses + expenses,
        labor: sum.labor + labor,
        profit: sum.profit + rowProfit(row),
      };
    }, { gross:0, expenses:0, labor:0, profit:0 });
  }

  function stages() {
    const rules = [
      ["New Leads", "new", (file) => file.fileStatus === "New Lead"],
      ["Pending Contact", "contact", (file) => ["Contact Established", "Contact Attempted"].includes(file.fileStatus)],
      ["Pending Estimates", "estimate", (file) => file.fileStatus === "Inspection Completed" || file.statusDetail === "Estimate Pending"],
      ["In Negotiation", "negotiation", (file) => file.fileStatus === "In Negotiation"],
      ["Active Jobs", "active", (file) => ["Job Won", "In Progress", "Work Completed"].includes(file.fileStatus)],
      ["Closed Files", "archive", (file) => ["Closed / Paid", "Job Lost / Closed"].includes(file.fileStatus)],
    ];
    return rules.map(([name, filter, test]) => {
      const files = workFiles().filter(test);
      return {
        name,
        filter,
        count: files.length,
        value: files.reduce((sum, file) => sum + numeric(file.estimateTotal), 0),
      };
    });
  }

  function isLanded(file = {}) {
    return ["Job Won", "In Progress", "Work Completed", "Closed / Paid"].includes(file.fileStatus);
  }

  function fileType(file = {}) {
    return String(file.projectType || "Uncategorized").trim() || "Uncategorized";
  }

  function fileForRevenue(row = {}) {
    if (typeof findFileForRevenue === "function") return findFileForRevenue(row);
    const id = row.fileId || row.dashboardFileId || row.id;
    return workFiles().find((file) => file.id === id || file.fileNumber === row.fileNumber || file.fileNumber === row.projectNumber) || null;
  }

  function workTypeStats() {
    const map = new Map();
    const ensure = (type) => {
      const key = type || "Uncategorized";
      if (!map.has(key)) {
        map.set(key, {
          type: key,
          files: 0,
          landed: 0,
          open: 0,
          pipeline: 0,
          revenue: 0,
          expenses: 0,
          labor: 0,
          profit: 0,
        });
      }
      return map.get(key);
    };

    workFiles().forEach((file) => {
      const stat = ensure(fileType(file));
      stat.files += 1;
      if (isLanded(file)) stat.landed += 1;
      if (!["Closed / Paid", "Job Lost / Closed"].includes(file.fileStatus)) {
        stat.open += 1;
        stat.pipeline += numeric(file.estimateTotal);
      }
    });

    revenueRows().forEach((row) => {
      const file = fileForRevenue(row);
      const stat = ensure(fileType(file || row));
      stat.revenue += numeric(row.gross);
      stat.expenses += numeric(row.expenses);
      stat.labor += numeric(row.labor);
      stat.profit += rowProfit(row);
    });

    return [...map.values()]
      .map((stat) => ({
        ...stat,
        closeRate: stat.files ? (stat.landed / stat.files) * 100 : 0,
        margin: stat.revenue ? (stat.profit / stat.revenue) * 100 : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue || b.files - a.files || a.type.localeCompare(b.type));
  }

  function chart(data) {
    const scale = Math.max(data.gross, 1);
    const profitHeight = Math.max(0, (data.profit / scale) * 124);
    return `<svg class="animus-performance-chart" viewBox="0 0 540 210">
      <line x1="44" y1="176" x2="520" y2="176" stroke="#e2e8f0"/>
      <line x1="44" y1="108" x2="520" y2="108" stroke="#e2e8f0"/>
      <line x1="44" y1="40" x2="520" y2="40" stroke="#e2e8f0"/>
      <rect x="105" y="${176 - (data.gross / scale) * 124}" width="78" height="${(data.gross / scale) * 124}" rx="7" fill="#2563eb"/>
      <rect x="245" y="${176 - (data.expenses / scale) * 124}" width="78" height="${(data.expenses / scale) * 124}" rx="7" fill="#f59e0b"/>
      <rect x="385" y="${176 - profitHeight}" width="78" height="${profitHeight}" rx="7" fill="#16a34a"/>
      <text x="105" y="198" fill="#64748b" font-size="12">Revenue</text>
      <text x="245" y="198" fill="#64748b" font-size="12">Expenses</text>
      <text x="385" y="198" fill="#64748b" font-size="12">Profit</text>
    </svg>`;
  }

  function workTypeMarkup(stats) {
    const totals = stats.reduce((sum, stat) => ({
      files: sum.files + stat.files,
      landed: sum.landed + stat.landed,
      revenue: sum.revenue + stat.revenue,
      profit: sum.profit + stat.profit,
    }), { files:0, landed:0, revenue:0, profit:0 });
    const top = stats.slice(0, 4);
    return `<section class="animus-performance-panel animus-work-type-panel">
      <div class="animus-performance-panel-head">
        <div>
          <h2>Work Type Performance</h2>
          <p>See which services bring in leads, landed jobs, income, and margin.</p>
        </div>
        <span>${totals.files} total file${totals.files === 1 ? "" : "s"} · ${totals.landed} landed</span>
      </div>
      ${top.length ? `<div class="animus-work-type-cards">${top.map((stat) => `
        <article class="animus-work-type-card">
          <span>${safe(stat.type)}</span>
          <strong>${money(stat.revenue)}</strong>
          <small>${stat.files} file${stat.files === 1 ? "" : "s"} · ${stat.landed} landed · ${stat.closeRate.toFixed(0)}% close</small>
        </article>`).join("")}</div>` : ""}
      <div class="animus-work-type-table-wrap">
        <table class="animus-work-type-table">
          <thead>
            <tr><th>Type of Work</th><th>Files</th><th>Landed</th><th>Close %</th><th>Pipeline</th><th>Income</th><th>Expenses</th><th>Labor</th><th>Net</th><th>Margin</th></tr>
          </thead>
          <tbody>
            ${stats.length ? stats.map((stat) => `<tr>
              <td><strong>${safe(stat.type)}</strong><small>${stat.open} open file${stat.open === 1 ? "" : "s"}</small></td>
              <td>${stat.files}</td>
              <td>${stat.landed}</td>
              <td>${stat.closeRate.toFixed(0)}%</td>
              <td>${money(stat.pipeline)}</td>
              <td>${money(stat.revenue)}</td>
              <td>${money(stat.expenses)}</td>
              <td>${money(stat.labor)}</td>
              <td class="${stat.profit < 0 ? "negative" : stat.profit === 0 ? "zero" : "positive"}">${money(stat.profit)}</td>
              <td class="${stat.margin < 0 ? "negative" : stat.margin === 0 ? "zero" : "positive"}">${stat.margin.toFixed(1)}%</td>
            </tr>`).join("") : `<tr><td colspan="10">No project types found yet.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>`;
  }

  function render() {
    const root = document.querySelector("#animusBusinessPerformance");
    if (!root) return;
    const data = totals();
    const margin = data.gross ? (data.profit / data.gross) * 100 : 0;
    const typeStats = workTypeStats();

    root.innerHTML = `<section class="animus-performance">
      <header class="animus-performance-head">
        <div><h1>Business Performance</h1><p>Pipeline, revenue, profit, expenses, and work-type performance from existing ANIMUS records.</p></div>
        <button class="animus-home-primary" data-performance-open="revenue">Open Revenue</button>
      </header>
      <section class="animus-performance-grid">
        <article class="animus-performance-card net-revenue"><span>Net Revenue</span><strong>${money(data.profit)}</strong><small>${data.gross ? `${margin.toFixed(1)}% of gross revenue` : "0.0% of gross revenue"}</small></article>
        <article class="animus-performance-card"><span>Gross Revenue</span><strong>${money(data.gross)}</strong><small>All recorded revenue</small></article>
        <article class="animus-performance-card expense"><span>Expenses</span><strong>${money(data.expenses)}</strong><small>Saved work-file expenses</small></article>
        <article class="animus-performance-card profit"><span>Profit</span><strong>${money(data.profit)}</strong><small>${data.gross ? `${margin.toFixed(1)}% profit margin` : "Revenue required for margin"}</small></article>
        <article class="animus-performance-card"><span>Labor</span><strong>${money(data.labor)}</strong><small>Payroll linked to work files</small></article>
        <article class="animus-performance-card"><span>Revenue Rows</span><strong>${revenueRows().length}</strong><small>Tracked job records</small></article>
      </section>
      <section class="animus-performance-main">
        <article class="animus-performance-panel">
          <h2>Revenue vs Expenses</h2>
          ${chart(data)}
          <button class="animus-performance-link" data-performance-open="revenue">View full revenue report</button>
        </article>
        <article class="animus-performance-panel">
          <h2>Sales Pipeline</h2>
          <div class="animus-performance-stages">${stages().map((stage) => `<button class="animus-performance-stage" data-performance-filter="${stage.filter}"><span><strong>${stage.name}</strong><br>${stage.count} work file${stage.count === 1 ? "" : "s"}</span><b>${money(stage.value)}</b></button>`).join("")}</div>
        </article>
      </section>
      ${workTypeMarkup(typeStats)}
    </section>`;

    root.querySelectorAll("[data-performance-open]").forEach((button) => {
      button.addEventListener("click", () => switchCrmView(button.dataset.performanceOpen));
    });
    root.querySelectorAll("[data-performance-filter]").forEach((button) => {
      button.addEventListener("click", () => {
        activateCrmFilter(button.dataset.performanceFilter);
        switchCrmView("files");
        renderCrm();
      });
    });
  }

  window.renderBusinessPerformance = render;
  document.addEventListener("DOMContentLoaded", render);
})();
