/**
 * FinAudit AI — App logic
 */
const state = {
  batchId: null,
  anomalies: [],
  financials: null,
  currentCaseId: null,
  filter: "all",
  queuedFiles: [],
  charts: {},
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function fmtINR(n) {
  if (n === null || n === undefined) return "—";
  const sign = n < 0 ? "-" : "";
  return sign + "₹" + Math.abs(n).toLocaleString("en-IN");
}

/* ---------------- Navigation ---------------- */
function showView(name) {
  $$(".view").forEach((v) => v.classList.remove("active"));
  const el = $(`#view-${name}`);
  if (el) el.classList.add("active");
  $$(".rail-link").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
}

$$(".rail-link").forEach((btn) => {
  btn.addEventListener("click", () => {
    showView(btn.dataset.view);
    if (btn.dataset.view === "ledger") renderLedger();
    if (btn.dataset.view === "cases") renderCases();
    if (btn.dataset.view === "report") renderReport();
  });
});

$("#backToCases").addEventListener("click", () => {
  showView("cases");
});

/* ---------------- Boot / connection check ---------------- */
async function boot() {
  const dot = $("#connDot");
  const label = $("#connLabel");
  try {
    const health = await Api.health();
    if (FINAUDIT_CONFIG.MOCK_MODE) {
      dot.classList.add("mock");
      label.textContent = "Demo mode (mock data)";
    } else {
      dot.classList.add("live");
      label.textContent = "Connected to backend";
    }
  } catch (e) {
    dot.classList.add("mock");
    label.textContent = "Backend unreachable — showing demo data";
  }

  // Fallback if backend doesn't give an ID right away
  state.batchId = state.batchId || "batch-2026-03";
  $("#batchLabel").textContent = `Batch ${state.batchId}`;

  await loadDashboardData();
}

async function loadDashboardData() {
  state.financials = await Api.getFinancials(state.batchId);
  state.anomalies = await Api.getAnomalies(state.batchId);
  const feed = await Api.getFeed();

  renderMetrics();
  renderTrendChart();
  renderFeed(feed);
  renderPriorityCases();
  updateCaseBadge();
}

function updateCaseBadge() {
  const open = state.anomalies.filter((a) => a.status === "awaiting_response").length;
  $("#openCasesBadge").textContent = open;
}

/* ---------------- Dashboard ---------------- */
function renderMetrics() {
  const f = state.financials;
  if (!f) return;
  $("#m-revenue").textContent = fmtINR(f.totalRevenue);
  $("#m-revenue-delta").textContent = `▲ ${f.revenueDeltaPct}% vs prior period`;
  $("#m-expenses").textContent = fmtINR(f.totalExpenses);
  $("#m-expenses-delta").textContent = `▲ ${f.expenseDeltaPct}% vs prior period`;
  $("#m-profit").textContent = fmtINR(f.profit);
  $("#m-profit-delta").textContent = `▲ ${f.profitDeltaPct}% vs prior period`;
  $("#m-profit-delta").className = "metric-delta up";
  $("#m-tax").textContent = fmtINR(f.tax);
  $("#m-cashflow").textContent = fmtINR(f.cashFlow);
  $("#m-cases").textContent = state.anomalies.filter((a) => a.status === "awaiting_response").length;
}

function renderFeed(feed) {
  const list = $("#feedList");
  list.innerHTML = "";
  if (!feed) return;
  feed.forEach((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="feed-time">${item.time}</span>${item.text}`;
    list.appendChild(li);
  });
}

function severityRank(s) {
  return { critical: 0, high: 1, medium: 2, low: 3, cleared: 4 }[s === "cleared" ? "cleared" : s] ?? 5;
}

function displaySeverity(a) {
  return a.status === "cleared" ? "cleared" : a.severity;
}

function renderPriorityCases() {
  const top = [...state.anomalies]
    .sort((a, b) => severityRank(displaySeverity(a)) - severityRank(displaySeverity(b)))
    .slice(0, 3);
  renderCaseGrid("#priorityCases", top);
}

/* ---------------- Case card rendering ---------------- */
function renderCaseGrid(selector, list) {
  const container = $(selector);
  container.innerHTML = "";
  const tpl = $("#caseCardTemplate");
  list.forEach((a) => {
    const node = tpl.content.cloneNode(true);
    node.querySelector(".case-number").textContent = a.caseNumber;
    const stamp = node.querySelector(".stamp");
    const sev = displaySeverity(a);
    stamp.textContent = sev === "cleared" ? "CLEARED" : sev.toUpperCase();
    stamp.classList.add(sev);
    node.querySelector(".case-desc").textContent = a.description;
    node.querySelector(".case-amount").textContent = fmtINR(a.amount);
    node.querySelector(".case-date").textContent = `${a.date} · ${a.time}`;
    node.querySelector(".case-card").addEventListener("click", () => openCase(a.id));
    container.appendChild(node);
  });
}

function renderCases() {
  const filtered = state.anomalies.filter((a) => {
    if (state.filter === "all") return true;
    if (state.filter === "cleared") return a.status === "cleared";
    return displaySeverity(a) === state.filter;
  });
  renderCaseGrid("#allCases", filtered);
}

$$(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    $$(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    state.filter = chip.dataset.filter;
    renderCases();
  });
});

/* ---------------- Case detail ---------------- */
async function openCase(id) {
  const a = await Api.getAnomaly(state.batchId, id);
  state.currentCaseId = id;
  showView("case-detail");

  $("#cd-eyebrow").textContent = a.caseNumber;
  $("#cd-title").textContent = a.description;
  const sev = displaySeverity(a);
  const stamp = $("#cd-stamp");
  stamp.className = "stamp " + sev;
  stamp.textContent = a.status === "cleared" ? "CLEARED"
    : a.status === "escalated" ? "ESCALATED"
    : sev.toUpperCase();

  const kv = $("#cd-kv");
  kv.innerHTML = `
    <dt>Vendor / payee</dt><dd>${a.vendor}</dd>
    <dt>Account</dt><dd>${a.account}</dd>
    <dt>Amount</dt><dd>${fmtINR(a.amount)}</dd>
    <dt>Baseline (avg)</dt><dd>${fmtINR(a.baseline)}</dd>
    <dt>Posted</dt><dd>${a.date} · ${a.time}</dd>
    <dt>AI confidence</dt><dd>${Math.round(a.confidence * 100)}%</dd>
  `;

  renderCaseChart(a);
  renderTimeline(a);
  renderContactPanel(a);
}

function renderTimeline(a) {
  const ol = $("#cd-timeline");
  ol.innerHTML = "";
  a.timeline.forEach((step) => {
    const li = document.createElement("li");
    li.className = step.tone;
    li.innerHTML = `
      <span class="tl-time">${step.time}</span>
      <div class="tl-title">${step.title}</div>
      <div class="tl-body">${step.body}</div>
    `;
    ol.appendChild(li);
  });
}

function renderContactPanel(a) {
  const panel = $("#cd-contact-panel");
  const msg = $("#cd-contact-msg");
  const replyInput = $("#cd-reply-input");
  replyInput.value = "";

  if (a.status === "cleared") {
    panel.style.display = "none";
    return;
  }
  panel.style.display = "block";
  const method = (a.severity === "critical" || a.severity === "high") ? "phone call" : "email";
  msg.textContent = a.status === "escalated"
    ? "This case was flagged as suspicious and escalated for full fraud review. Add further notes below if needed."
    : `The AI could not fully explain this anomaly and sent a ${method} to the finance manager. Enter their reply to continue the investigation.`;
}

$("#cd-reply-send").addEventListener("click", async () => {
  const text = $("#cd-reply-input").value.trim();
  if (!text) return;
  const btn = $("#cd-reply-send");
  btn.disabled = true;
  btn.textContent = "Submitting…";

  const result = await Api.submitResponse(state.currentCaseId, text);

  const a = state.anomalies.find((x) => x.id === state.currentCaseId);
  a.status = result.updatedStatus;
  a.timeline.push({
    title: "Manager reply received",
    time: new Date().toLocaleString(),
    body: `"${text}" — ${result.aiSummary}`,
    tone: result.updatedStatus === "cleared" ? "ok" : "alert",
  });

  btn.disabled = false;
  btn.textContent = "Submit reply";
  openCase(state.currentCaseId);
  updateCaseBadge();
  renderMetrics();
});

function renderCaseChart(a) {
  if (typeof Chart === 'undefined') return; // FIX: Don't crash
  const ctx = $("#caseChart");
  if (state.charts.case) state.charts.case.destroy();
  state.charts.case = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Baseline average", "Flagged transaction"],
      datasets: [{
        data: [a.baseline, a.amount],
        backgroundColor: ["#4E9A6D", "#C1442E"],
        borderRadius: 6,
      }]
    },
    options: chartBaseOptions({ legend: false })
  });
}

/* ---------------- Financials / ledger ---------------- */
function renderLedger() {
  const f = state.financials;
  if(!f) return;
  
  const rows = [
    ["Total revenue", fmtINR(f.totalRevenue), `▲ ${f.revenueDeltaPct}%`],
    ["Total expenses", fmtINR(f.totalExpenses), `▲ ${f.expenseDeltaPct}%`],
    ["Net profit", fmtINR(f.profit), `▲ ${f.profitDeltaPct}%`],
    ["Estimated tax", fmtINR(f.tax), "—"],
    ["Net cash flow", fmtINR(f.cashFlow), f.cashFlow < 0 ? "▼ negative" : "▲ positive"],
  ];
  $("#ledgerBody").innerHTML = rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("");
  renderCashflowChart();
  renderRatiosChart();
}

function chartBaseOptions({ legend = true } = {}) {
  return {
    responsive: true,
    plugins: {
      legend: { display: legend, labels: { color: "#8592AC", font: { family: "Inter" } } },
      tooltip: { titleFont: { family: "Inter" }, bodyFont: { family: "IBM Plex Mono" } }
    },
    scales: {
      x: { ticks: { color: "#8592AC" }, grid: { color: "rgba(233,228,216,0.06)" } },
      y: { ticks: { color: "#8592AC" }, grid: { color: "rgba(233,228,216,0.06)" } }
    }
  };
}

function renderTrendChart() {
  if (typeof Chart === 'undefined') return; // FIX: Don't crash if Chart tool is missing
  const f = state.financials;
  if (!f || !f.trend) return;
  
  const ctx = $("#trendChart");
  if (state.charts.trend) state.charts.trend.destroy();
  state.charts.trend = new Chart(ctx, {
    type: "line",
    data: {
      labels: f.trend.map(t => t.period),
      datasets: [
        { label: "Revenue", data: f.trend.map(t => t.revenue), borderColor: "#4E9A6D", backgroundColor: "rgba(78,154,109,0.15)", fill: true, tension: 0.35 },
        { label: "Expenses", data: f.trend.map(t => t.expenses), borderColor: "#C1442E", backgroundColor: "rgba(193,68,46,0.12)", fill: true, tension: 0.35 },
      ]
    },
    options: chartBaseOptions()
  });
}

function renderCashflowChart() {
  if (typeof Chart === 'undefined') return; // FIX: Don't crash
  const f = state.financials;
  if (!f || !f.cashflow) return;
  
  const ctx = $("#cashflowChart");
  if (state.charts.cashflow) state.charts.cashflow.destroy();
  state.charts.cashflow = new Chart(ctx, {
    type: "bar",
    data: {
      labels: f.cashflow.map(t => t.period),
      datasets: [{
        data: f.cashflow.map(t => t.value),
        backgroundColor: f.cashflow.map(t => t.value < 0 ? "#C1442E" : "#E8A33D"),
        borderRadius: 5,
      }]
    },
    options: chartBaseOptions({ legend: false })
  });
}

function renderRatiosChart() {
  if (typeof Chart === 'undefined') return; // FIX: Don't crash
  const f = state.financials;
  if (!f || !f.ratios) return;
  
  const ctx = $("#ratiosChart");
  const labels = Object.keys(f.ratios);
  const values = Object.values(f.ratios);
  if (state.charts.ratios) state.charts.ratios.destroy();
  state.charts.ratios = new Chart(ctx, {
    type: "radar",
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: "#6C9BD1",
        backgroundColor: "rgba(108,155,209,0.18)",
        pointBackgroundColor: "#6C9BD1",
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          angleLines: { color: "rgba(233,228,216,0.08)" },
          grid: { color: "rgba(233,228,216,0.08)" },
          pointLabels: { color: "#8592AC", font: { size: 10.5 } },
          ticks: { display: false }
        }
      }
    }
  });
}


/* ---------------- Upload / intake ---------------- */
const dropzone = $("#dropzone");
const fileInput = $("#fileInput");

["dragenter", "dragover"].forEach(evt =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("drag"); })
);
["dragleave", "drop"].forEach(evt =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("drag"); })
);
dropzone.addEventListener("drop", (e) => addFiles([...e.dataTransfer.files]));
fileInput.addEventListener("change", (e) => addFiles([...e.target.files]));

function addFiles(files) {
  state.queuedFiles.push(...files);
  renderFileQueue();
}

function renderFileQueue() {
  const ul = $("#fileQueue");
  ul.innerHTML = "";
  state.queuedFiles.forEach((f) => {
    const li = document.createElement("li");
    const ext = f.name.split(".").pop().toUpperCase();
    li.innerHTML = `<span>${f.name}</span><span class="file-tag">${ext} · ${(f.size / 1024).toFixed(0)} KB</span>`;
    ul.appendChild(li);
  });
  $("#startCleaning").disabled = state.queuedFiles.length === 0;
}

// THIS IS THE FIXED BLOCK
$("#startCleaning").addEventListener("click", async () => {
  const btn = $("#startCleaning");
  btn.disabled = true;
  btn.textContent = "Uploading…";

  try {
    // 1. Upload to FastAPI
    const uploadRes = await Api.upload(state.queuedFiles);
    state.batchId = uploadRes.batchId;
    $("#batchLabel").textContent = `Batch ${state.batchId}`;
    
    // Reload the dashboard
    await loadDashboardData();

    // 2. Show the fancy cleaning UI
    $("#cleaningPanel").style.display = "block";
    const steps = ["dedupe", "fillna", "dates", "structure"];
    for (const step of steps) {
      const li = $(`#pipelineSteps li[data-step="${step}"]`);
      li.classList.add("active");
      await Api.getUploadStatus(state.batchId);
      await new Promise(r => setTimeout(r, 500));
      li.classList.remove("active");
      li.classList.add("done");
      if (step === "dates") $("#normalizeSample").style.display = "flex";
    }
    
    $("#cleaningTag").textContent = "Complete";
    btn.textContent = "Cleaning complete — view financials";
    btn.disabled = false;
    btn.onclick = () => { showView("ledger"); renderLedger(); };
    
  } catch (err) {
    // THIS WILL POP UP THE EXACT ERROR ON YOUR SCREEN
    alert("JAVASCRIPT ERROR: " + err.message);
    console.error(err);
    btn.textContent = "Upload failed. Try again.";
    btn.disabled = false;
  }
});
$("#refreshDash").addEventListener("click", loadDashboardData);

/* ---------------- Report ---------------- */
async function renderReport() {
  const r = await Api.getReport(state.batchId);
  const stamp = $("#report-risk-stamp");
  stamp.textContent = `${r.riskLevel.toUpperCase()} RISK`;
  stamp.className = "stamp " + (r.riskLevel === "high" || r.riskLevel === "critical" ? "critical" : r.riskLevel === "medium" ? "medium" : "cleared");
  $("#report-summary").textContent = r.summary;
  $("#report-findings").innerHTML = r.findings.map(f => `<li>${f}</li>`).join("");
  $("#report-actions").innerHTML = r.actions.map(a => `<li>${a}</li>`).join("");
}

$("#exportReport").addEventListener("click", async () => {
  const url = await Api.getReportExportUrl(state.batchId, "pdf");
  if (url) {
    window.open(url, "_blank");
  } else {
    alert("Export is wired to call GET /api/report/:batchId/export?format=pdf on your backend. In demo mode there's no file to download — connect a backend to enable this.");
  }
});

boot();
