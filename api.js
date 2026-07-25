const Api = (() => {

  async function request(path, options = {}) {
    const url = `${FINAUDIT_CONFIG.BASE_URL}${path}`;
    const headers = { ...(options.headers || {}) };
    
    // CRITICAL FIX: If uploading a file, let the browser handle all headers.
    // If we force it, the file gets corrupted in transit.
    if (options.body instanceof FormData) {
      delete headers["Content-Type"];
    } else if (!headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }
    
    if (FINAUDIT_CONFIG.AUTH_TOKEN) headers["Authorization"] = `Bearer ${FINAUDIT_CONFIG.AUTH_TOKEN}`;

    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`API Error: ${res.status}`, text);
      throw new Error(`API ${res.status} on ${path}: ${text}`);
    }
    return res.status === 204 ? null : res.json();
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  return {
    async health() {
      if (FINAUDIT_CONFIG.MOCK_MODE) { await delay(300); return { ok: true, mode: "mock" }; }
      return request(FINAUDIT_CONFIG.ENDPOINTS.health());
    },

    async upload(files) {
      if (FINAUDIT_CONFIG.MOCK_MODE) {
        await delay(600);
        return { batchId: "batch-2026-03", files: files.map((f, i) => ({ id: `f-${i}`, name: f.name, type: f.type || "unknown", status: "queued" })) };
      }
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      // Send the file properly
      return request(FINAUDIT_CONFIG.ENDPOINTS.upload(), { method: "POST", body: form });
    },

    async getUploadStatus(batchId) {
      if (FINAUDIT_CONFIG.MOCK_MODE) {
        await delay(400);
        return { batchId, steps: { dedupe: "done", fillna: "done", dates: "done", structure: "done" }, recordsProcessed: 1204 };
      }
      return request(FINAUDIT_CONFIG.ENDPOINTS.uploadStatus(batchId));
    },

    async getFinancials(batchId) {
      if (FINAUDIT_CONFIG.MOCK_MODE) { await delay(300); return MOCK.financials; }
      return request(FINAUDIT_CONFIG.ENDPOINTS.financials(batchId));
    },

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

    async investigate(anomalyId) {
      if (FINAUDIT_CONFIG.MOCK_MODE) {
        await delay(900);
        return { explained: false, explanation: null, sources: [] };
      }
      return request(FINAUDIT_CONFIG.ENDPOINTS.investigate(anomalyId), { method: "POST" });
    },

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

    async submitResponse(anomalyId, replyText) {
      if (FINAUDIT_CONFIG.MOCK_MODE) {
        await delay(700);
        const approved = /approve|ok|fine|confirm|match/i.test(replyText);
        return { updatedStatus: approved ? "cleared" : "escalated", aiSummary: approved ? "Manager confirmed this transaction as legitimate. Case closed." : "Manager flagged this as suspicious." };
      }
      return request(FINAUDIT_CONFIG.ENDPOINTS.submitResponse(anomalyId), {
        method: "POST",
        body: JSON.stringify({ reply: replyText }),
      });
    },

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
