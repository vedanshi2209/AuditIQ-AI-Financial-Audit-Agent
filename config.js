/**
 * FinAudit AI — Frontend configuration
 * ------------------------------------
 * Point BASE_URL at your backend. Everything else in api.js is built
 * from this file, so this is the only place you should need to touch
 * when you go from demo mode to a real backend.
 */
const FINAUDIT_CONFIG = {
  // Set this to your backend's root URL
  BASE_URL: "http://localhost:8000",

  // I HAVE CHANGED THIS TO FALSE FOR YOU!
  // Now it will connect to your real FastAPI backend.
  MOCK_MODE: false,

  // If you protect your API with a bearer token / API key, set it here
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
