# FinAudit AI — Frontend ↔ Backend API Contract

This frontend is fully wired to call the endpoints below through `js/api.js`.
It currently runs in **mock mode** (see `js/config.js`) so you can demo it
with zero backend. To connect your real backend:

1. Open `js/config.js`
2. Set `BASE_URL` to your backend's root (e.g. `https://api.yourapp.com`)
3. Set `MOCK_MODE` to `false`

Nothing else in the frontend needs to change, as long as your backend
returns the shapes documented below.

---

## 1. Upload documents

`POST /api/upload`
Content-Type: `multipart/form-data`, field name `files` (repeatable)

**Response 200**
```json
{
  "batchId": "batch-2026-03",
  "files": [
    { "id": "f-0", "name": "march_bank_statement.csv", "type": "text/csv", "status": "queued" }
  ]
}
```

## 2. Cleaning agent status

`GET /api/upload/:batchId/status`

**Response 200**
```json
{
  "batchId": "batch-2026-03",
  "steps": { "dedupe": "done", "fillna": "done", "dates": "done", "structure": "done" },
  "recordsProcessed": 1204
}
```
`steps` values: `"pending" | "running" | "done"`. Frontend polls this during
the intake screen — return the current state each time it's called.

## 3. Financial calculations

`GET /api/financials/:batchId`

**Response 200**
```json
{
  "totalRevenue": 8420000,
  "totalExpenses": 6110000,
  "profit": 2310000,
  "tax": 462000,
  "cashFlow": 1180000,
  "revenueDeltaPct": 6.4,
  "expenseDeltaPct": 2.1,
  "profitDeltaPct": 14.8,
  "trend": [ { "period": "Oct", "revenue": 1180000, "expenses": 940000 } ],
  "cashflow": [ { "period": "Oct", "value": 240000 } ],
  "ratios": { "Current ratio": 1.8, "Gross margin %": 27.4 }
}
```

## 4. Anomaly list

`GET /api/anomalies/:batchId`

**Response 200** — array of anomaly objects:
```json
[
  {
    "id": "an-1042",
    "caseNumber": "CASE-2026-0104",
    "date": "2026-03-14",
    "time": "23:42",
    "amount": 980000,
    "baseline": 10500,
    "vendor": "Sundar Equipment Pvt Ltd",
    "account": "Capital Expenditure — 5100",
    "description": "Single payment of ₹9,80,000 against a typical monthly spend of ₹10,000–12,000.",
    "severity": "critical",
    "status": "awaiting_response",
    "aiExplained": false,
    "confidence": 0.31,
    "timeline": [
      { "title": "Anomaly detected", "time": "2026-03-15 09:02", "body": "...", "tone": "alert" }
    ]
  }
]
```
- `severity`: `"low" | "medium" | "high" | "critical"`
- `status`: `"awaiting_response" | "explained" | "cleared" | "escalated"`
- `tone` (per timeline step, for the UI's colored dot): `"ok" | "warn" | "alert"`

## 5. Single case detail

`GET /api/anomalies/:batchId/:anomalyId` → same shape as one item above.

## 6. Trigger AI investigation (reasoning + web search)

`POST /api/anomalies/:anomalyId/investigate`

**Response 200**
```json
{ "explained": true, "explanation": "Matches last year's annual equipment purchase.", "sources": ["https://..."] }
```
Call this when you want the agent to actively re-run its reasoning/search
step for a case (e.g. a "re-investigate" button).

## 7. Severity check → contact finance manager

`POST /api/anomalies/:anomalyId/contact`
```json
{ "method": "email", "message": "Can you confirm this ₹9,80,000 payment?" }
```
`method`: `"email"` for low/medium severity, `"call"` for high/critical
(your backend decides the channel based on severity; the frontend just
displays whichever the case's severity implies).

**Response 200**
```json
{ "contactId": "contact-1", "method": "email", "sentAt": "2026-03-15T09:10:00Z" }
```

## 8. Feed manager's reply back into the investigation

`POST /api/anomalies/:anomalyId/response`
```json
{ "reply": "This payment was approved for the new production line." }
```

**Response 200**
```json
{ "updatedStatus": "cleared", "aiSummary": "Manager confirmed this transaction as legitimate. Case closed." }
```
`updatedStatus`: `"cleared" | "escalated"`

## 9. Final audit report

`GET /api/report/:batchId`
```json
{
  "riskLevel": "high",
  "summary": "Across 1,204 cleaned transactions...",
  "findings": ["CASE-2026-0104 — ..."],
  "actions": ["Obtain purchase order for CASE-2026-0104 before period close."]
}
```

`GET /api/report/:batchId/export?format=pdf` → should return a downloadable
file (PDF/CSV) with `Content-Disposition: attachment`.

## 10. Health check (optional but recommended)

`GET /api/health` → `{ "ok": true }`. Used to show "Connected to backend"
vs "Backend unreachable" in the sidebar.

---

## Auth

If your backend needs a bearer token, set `FINAUDIT_CONFIG.AUTH_TOKEN` in
`js/config.js` — every request in `js/api.js` already attaches it as
`Authorization: Bearer <token>`.

## CORS

Since this is a static frontend calling your API from the browser, make
sure your backend sends appropriate `Access-Control-Allow-Origin` headers
for the domain you host this frontend on.
