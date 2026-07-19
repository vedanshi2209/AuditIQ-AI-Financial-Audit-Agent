/**
 * FinAudit AI — API layer
 * -----------------------
 * Every function here corresponds 1:1 to an endpoint in API_DOCUMENTATION.md.
 * Swap FINAUDIT_CONFIG.MOCK_MODE to false and set BASE_URL to run against
 * a real backend — no other file needs to change.
 */
const Api = (() => {

  async function request(path, options = {}) {
    const url = `${FINAUDIT_CONFIG.BASE_URL}${path}`;
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (FINAUDIT_CONFIG.AUTH_TOKEN) headers["Authorization"] = `Bearer ${FINAUDIT_CONFIG.AUTH_TOKEN}`;

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${res.status} on ${path}: ${text}`);
    }
    return res.status === 204 ? null : res.json();
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  return {
    // ---- Health check, used for the connection dot in the sidebar ----
    async health() {
      if (FINAUDIT_CONFIG.MOCK_MODE) { await delay(300); return { ok: true, mode: "mock" }; }
      return request(FINAUDIT_CONFIG.ENDPOINTS.health());
    },

    // ---- 1. Upload financial documents ----
    // files: File[] from an <input type=file multiple>
    async upload(files) {
      if (FINAUDIT_CONFIG.MOCK_MODE) {
        await delay(600);
        return {
          batchId: MOCK.batchId,
          files: files.map((f, i) => ({ id: `f-${i}`, name: f.name, type: f.type || "unknown", status: "queued" }))
        };
      }
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      return request(FINAUDIT_CONFIG.ENDPOINTS.upload(), { method: "POST", body: form, headers: {} });
    },

    // ---- 2. Poll data cleaning agent progress ----
    async getUploadStatus(batchId) {
      if (FINAUDIT_CONFIG.MOCK_MODE) {
        await delay(400);
        return { batchId, steps: { dedupe: "done", fillna: "done", dates: "done", structure: "done" }, recordsProcessed: 1204 };
      }
      return request(FINAUDIT_CONFIG.ENDPOINTS.uploadStatus(batchId));
    },

    // ---- 3. Financial calculations ----
    async getFinancials(batchId) {
      if (FINAUDIT_CONFIG.MOCK_MODE) { await delay(300); return MOCK.financials; }
      return request(FINAUDIT_CONFIG.ENDPOINTS.financials(batchId));
    },

    // ---- 4. Anomaly list ----
    async getAnomalies(batchId) {
      if (FINAUDIT_CONFIG.MOCK_MODE) { await delay(300); return MOCK.anomalies; }
      return request(FINAUDIT_CONFIG.ENDPOINTS.anomalies(batchId));
    },

    async getAnomaly(batchId, anomalyId) {
      if (FINAUDIT_CONFIG.MOCK_MODE) {
        await delay(200);
        return MOCK.anomalies.find((a) => a.id === anomalyId);
      }
      return request(FINAUDIT_CONFIG.ENDPOINTS.anomalyDetail(batchId, anomalyId));
    },

    // ---- 5. Trigger AI investigation (reasoning + web search) on one case ----
    async investigate(anomalyId) {
      if (FINAUDIT_CONFIG.MOCK_MODE) {
        await delay(900);
        return { explained: false, explanation: null, sources: [] };
      }
      return request(FINAUDIT_CONFIG.ENDPOINTS.investigate(anomalyId), { method: "POST" });
    },

    // ---- 6. Severity check / contact — email for low-medium, call for high-critical ----
    async contact(anomalyId, method, message) {
      if (FINAUDIT_CONFIG.MOCK_MODE) {
        await delay(500);
        return { contactId: `contact-${Date.now()}`, method, sentAt: new Date().toISOString() };
      }
      return request(FINAUDIT_CONFIG.ENDPOINTS.contact(anomalyId), {
        method: "POST",
        body: JSON.stringify({ method, message }),
      });
    },

    // ---- 7 & 8. Feed the manager's reply back into the investigation ----
    async submitResponse(anomalyId, replyText) {
      if (FINAUDIT_CONFIG.MOCK_MODE) {
        await delay(700);
        const approved = /approve|ok|fine|confirm|match/i.test(replyText);
        return {
          updatedStatus: approved ? "cleared" : "escalated",
          aiSummary: approved
            ? "Manager confirmed this transaction as legitimate. Case closed."
            : "Manager flagged this as suspicious. Escalating to full fraud review.",
        };
      }
      return request(FINAUDIT_CONFIG.ENDPOINTS.submitResponse(anomalyId), {
        method: "POST",
        body: JSON.stringify({ reply: replyText }),
      });
    },

    // ---- 9. Final audit report ----
    async getReport(batchId) {
      if (FINAUDIT_CONFIG.MOCK_MODE) { await delay(300); return MOCK.report; }
      return request(FINAUDIT_CONFIG.ENDPOINTS.report(batchId));
    },

    async getReportExportUrl(batchId, format = "pdf") {
      if (FINAUDIT_CONFIG.MOCK_MODE) return null;
      return `${FINAUDIT_CONFIG.BASE_URL}${FINAUDIT_CONFIG.ENDPOINTS.reportExport(batchId, format)}`;
    },

    async getFeed() {
      if (FINAUDIT_CONFIG.MOCK_MODE) { await delay(150); return MOCK.feed; }
      return request(`/api/feed`);
    }
  };
})();
