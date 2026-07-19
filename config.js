/**
 * FinAudit AI — Frontend configuration
 * ------------------------------------
 * Point BASE_URL at your backend. Everything else in api.js is built
 * from this file, so this is the only place you should need to touch
 * when you go from demo mode to a real backend.
 */
const FINAUDIT_CONFIG = {
  // Set this to your backend's root URL, e.g. "https://api.yourdomain.com"
  BASE_URL: "http://localhost:8000",

  // While true, the frontend never calls the network — it serves data
  // from js/mock-data.js so the UI is fully demoable with no backend.
  // Set to false once your backend implements the endpoints below.
  MOCK_MODE: true,

  // If you protect your API with a bearer token / API key, set it here
  // (or load it from wherever your auth flow stores it).
  AUTH_TOKEN: null,

  // Endpoint map — see API_DOCUMENTATION.md for full request/response shapes.
  ENDPOINTS: {
    upload:            () => `/api/upload`,
    uploadStatus:      (batchId) => `/api/upload/${batchId}/status`,
    financials:        (batchId) => `/api/financials/${batchId}`,
    anomalies:         (batchId) => `/api/anomalies/${batchId}`,
    anomalyDetail:     (batchId, anomalyId) => `/api/anomalies/${batchId}/${anomalyId}`,
    investigate:       (anomalyId) => `/api/anomalies/${anomalyId}/investigate`,
    contact:           (anomalyId) => `/api/anomalies/${anomalyId}/contact`,
    submitResponse:    (anomalyId) => `/api/anomalies/${anomalyId}/response`,
    report:            (batchId) => `/api/report/${batchId}`,
    reportExport:      (batchId, format) => `/api/report/${batchId}/export?format=${format}`,
    health:            () => `/api/health`,
  }
};
