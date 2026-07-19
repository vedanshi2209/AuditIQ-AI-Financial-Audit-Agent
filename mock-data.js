/**
 * FinAudit AI — Mock data
 * Used only when FINAUDIT_CONFIG.MOCK_MODE is true. Mirrors the exact
 * shapes your real backend should return — see API_DOCUMENTATION.md.
 */
const MOCK = {

  batchId: "batch-2026-03",

  financials: {
    totalRevenue: 8420000,
    totalExpenses: 6110000,
    profit: 2310000,
    tax: 462000,
    cashFlow: 1180000,
    revenueDeltaPct: 6.4,
    expenseDeltaPct: 2.1,
    profitDeltaPct: 14.8,
    trend: [
      { period: "Oct", revenue: 1180000, expenses: 940000 },
      { period: "Nov", revenue: 1240000, expenses: 960000 },
      { period: "Dec", revenue: 1510000, expenses: 1080000 },
      { period: "Jan", revenue: 1360000, expenses: 1010000 },
      { period: "Feb", revenue: 1430000, expenses: 1040000 },
      { period: "Mar", revenue: 1700000, expenses: 2080000 },
    ],
    cashflow: [
      { period: "Oct", value: 240000 },
      { period: "Nov", value: 280000 },
      { period: "Dec", value: 430000 },
      { period: "Jan", value: 350000 },
      { period: "Feb", value: 390000 },
      { period: "Mar", value: -900000 },
    ],
    ratios: {
      "Current ratio": 1.8,
      "Quick ratio": 1.3,
      "Gross margin %": 27.4,
      "Net margin %": 21.9,
      "Expense-to-revenue": 0.73,
    }
  },

  anomalies: [
    {
      id: "an-1042",
      caseNumber: "CASE-2026-0104",
      date: "2026-03-14",
      time: "23:42",
      amount: 980000,
      baseline: 10500,
      vendor: "Sundar Equipment Pvt Ltd",
      account: "Capital Expenditure — 5100",
      description: "Single payment of ₹9,80,000 against a typical monthly spend near ₹10,000–12,000.",
      severity: "critical",
      status: "awaiting_response",
      aiExplained: false,
      confidence: 0.31,
      timeline: [
        { type: "detect", title: "Anomaly detected", time: "2026-03-15 09:02", body: "Transaction is 78x the trailing 3-month average for this account.", tone:"alert" },
        { type: "reasoning", title: "AI reviewed internal records", time: "2026-03-15 09:03", body: "No matching purchase order or approval record found in the uploaded ledger.", tone:"warn" },
        { type: "search", title: "Web search: \"Sundar Equipment Pvt Ltd annual contract\"", time: "2026-03-15 09:05", body: "No public record connecting this vendor to a recurring annual contract was found.", tone:"warn" },
        { type: "severity", title: "Severity escalated to Critical", time: "2026-03-15 09:06", body: "Amount exceeds high-value threshold and falls outside business hours (23:42). Phone alert dispatched to finance manager.", tone:"alert" },
      ]
    },
    {
      id: "an-1043",
      caseNumber: "CASE-2026-0105",
      date: "2026-03-11",
      time: "14:20",
      amount: 84500,
      baseline: 60000,
      vendor: "Raghav Steel Traders",
      account: "Raw Materials — 3020",
      description: "Raw material spend up 41% versus the prior three invoices from the same vendor.",
      severity: "medium",
      status: "explained",
      aiExplained: true,
      confidence: 0.88,
      timeline: [
        { type: "detect", title: "Anomaly detected", time: "2026-03-12 08:10", body: "Spend spike flagged against 3-invoice rolling average.", tone:"warn" },
        { type: "search", title: "Web search: \"steel prices India Q1 2026\"", time: "2026-03-12 08:12", body: "Reporting on domestic steel benchmarks points to a broad price increase during this quarter.", tone:"ok" },
        { type: "resolve", title: "Anomaly explained", time: "2026-03-12 08:13", body: "Price movement is consistent with the sector-wide increase; matches the vendor's revised rate card. No action required.", tone:"ok" },
      ]
    },
    {
      id: "an-1044",
      caseNumber: "CASE-2026-0106",
      date: "2026-03-09",
      time: "11:05",
      amount: 22000,
      baseline: 22000,
      vendor: "Whitefield Facilities Mgmt",
      account: "Operating Expense — 4110",
      description: "Same invoice amount and vendor billed twice within four days.",
      severity: "low",
      status: "awaiting_response",
      aiExplained: false,
      confidence: 0.52,
      timeline: [
        { type: "detect", title: "Anomaly detected", time: "2026-03-09 11:06", body: "Duplicate-payment pattern: identical amount, same vendor, 4 days apart.", tone:"warn" },
        { type: "reasoning", title: "AI reviewed internal records", time: "2026-03-09 11:07", body: "Could not confirm whether this is a duplicate or two separate service periods — no receipt attached to the second entry.", tone:"warn" },
        { type: "severity", title: "Severity set to Low", time: "2026-03-09 11:08", body: "Clarification email sent to finance manager requesting the missing receipt.", tone:"warn" },
      ]
    },
    {
      id: "an-1045",
      caseNumber: "CASE-2026-0107",
      date: "2026-03-02",
      time: "16:40",
      amount: 3200000,
      baseline: 3100000,
      vendor: "Internal — Annual Equipment Refresh",
      account: "Capital Expenditure — 5100",
      description: "Large capital transfer for annual equipment refresh cycle.",
      severity: "high",
      status: "cleared",
      aiExplained: true,
      confidence: 0.95,
      timeline: [
        { type: "detect", title: "Anomaly detected", time: "2026-03-03 07:40", body: "Transaction well above the routine monthly range.", tone:"warn" },
        { type: "reasoning", title: "AI matched historical pattern", time: "2026-03-03 07:41", body: "Matches last year's annual equipment purchase in both timing and amount within 3%.", tone:"ok" },
        { type: "resolve", title: "Anomaly explained — no action needed", time: "2026-03-03 07:41", body: "Recurring, planned capital expenditure. Marked cleared automatically.", tone:"ok" },
      ]
    },
    {
      id: "an-1046",
      caseNumber: "CASE-2026-0108",
      date: "2026-03-16",
      time: "02:15",
      amount: 511000,
      baseline: 0,
      vendor: "Unregistered payee — Acct ****4471",
      account: "Vendor Payments — 4400",
      description: "Unauthorized-looking payment to an account not present in the approved vendor master.",
      severity: "critical",
      status: "awaiting_response",
      aiExplained: false,
      confidence: 0.12,
      timeline: [
        { type: "detect", title: "Anomaly detected", time: "2026-03-16 06:00", body: "Payee not found in approved vendor master; transaction posted at 02:15, outside business hours.", tone:"alert" },
        { type: "search", title: "Web search: \"account ****4471 vendor registry\"", time: "2026-03-16 06:01", body: "No public or internal record matches this payee.", tone:"alert" },
        { type: "severity", title: "Severity escalated to Critical", time: "2026-03-16 06:02", body: "Unrecognized payee plus off-hours timing triggered an immediate phone alert to the finance manager.", tone:"alert" },
      ]
    },
  ],

  feed: [
    { time: "09:06", text: "CASE-2026-0104 escalated to Critical — phone alert sent." },
    { time: "08:13", text: "CASE-2026-0105 explained via web search (steel price index) — cleared." },
    { time: "07:41", text: "CASE-2026-0107 matched to prior-year pattern — cleared automatically." },
    { time: "06:02", text: "CASE-2026-0108 escalated to Critical — unrecognized payee." },
    { time: "Yesterday", text: "Cleaning agent normalized 3 date formats across 1,204 records." },
  ],

  report: {
    riskLevel: "high",
    summary: "Across 1,204 cleaned transactions for the March 2026 period, the investigation agent closed 3 of 5 flagged anomalies automatically or after a single clarification. Two critical cases remain open pending manager confirmation: an unapproved ₹9,80,000 capital payment with no purchase order on file, and a ₹5,11,000 transfer to a payee absent from the approved vendor master, both posted outside business hours.",
    findings: [
      "CASE-2026-0104 — ₹9,80,000 capital payment, 78x baseline, no PO on file. Status: awaiting response.",
      "CASE-2026-0105 — Raw material cost increase explained by Q1 steel price movement. Status: cleared.",
      "CASE-2026-0106 — Possible duplicate facilities payment, missing receipt. Status: awaiting response.",
      "CASE-2026-0107 — Annual equipment refresh, matches prior-year pattern. Status: cleared.",
      "CASE-2026-0108 — ₹5,11,000 to an unregistered payee at 02:15. Status: awaiting response.",
    ],
    actions: [
      "Obtain purchase order and approval trail for CASE-2026-0104 before period close.",
      "Confirm payee identity for CASE-2026-0108 with the bank before releasing further funds.",
      "Request the missing receipt for CASE-2026-0106 from Whitefield Facilities Mgmt.",
      "Review after-hours payment controls — two of five flagged transactions posted outside business hours.",
    ]
  }
};
