from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
from typing import List
import datetime
import uuid

# Import our LangGraph Agent
from agent import run_investigation_agent

app = FastAPI(title="AuditIQ API")

# Allow your frontend HTML file to talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory database just for the demo
db = {
    "batches": {},
    "anomalies": {}
}

@app.get("/api/health")
def health_check():
    return {"ok": True}

@app.post("/api/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    batch_id = f"batch-{uuid.uuid4().hex[:6]}"
    
    # Read the first uploaded file into pandas
    file = files[0]
    df = pd.read_csv(file.file) if file.filename.endswith('.csv') else pd.read_excel(file.file)
    
    # Basic math for financials
    amount_col = next((c for c in df.columns if "amount" in c.lower() or "value" in c.lower()), df.columns[1])
    total_amount = float(df[amount_col].sum())
    
    db["batches"][batch_id] = {
        "financials": {
            "totalRevenue": total_amount * 1.2, # Mock calculations
            "totalExpenses": total_amount,
            "profit": total_amount * 0.2,
            "tax": total_amount * 0.05,
            "cashFlow": total_amount * 0.15,
            "revenueDeltaPct": 5.0, "expenseDeltaPct": 2.0, "profitDeltaPct": 10.0,
            "trend": [{"period": "Mar", "revenue": total_amount*1.2, "expenses": total_amount}],
            "cashflow": [{"period": "Mar", "value": total_amount*0.15}],
            "ratios": {"Current ratio": 1.5}
        },
        "recordsProcessed": len(df)
    }

    # Generate a dummy anomaly from the largest transaction for the demo
    max_row = df.loc[df[amount_col].idxmax()]
    anomaly_id = f"an-{uuid.uuid4().hex[:4]}"
    
    db["anomalies"][batch_id] = [{
        "id": anomaly_id,
        "caseNumber": f"CASE-{datetime.date.today().strftime('%Y-%m')}-01",
        "date": str(max_row.get('date', '2026-03-14')),
        "time": "14:00",
        "amount": float(max_row[amount_col]),
        "baseline": float(df[amount_col].median()),
        "vendor": str(max_row.get('vendor', 'Unknown Vendor')),
        "account": "Flagged Account",
        "description": "Amount significantly higher than historical median.",
        "severity": "high",
        "status": "awaiting_response",
        "aiExplained": False,
        "confidence": 0.85,
        "timeline": [
            {"title": "Anomaly detected by Pandas", "time": "Just now", "body": "Spike detected in dataset.", "tone": "warn"}
        ],
        "raw_data": str(max_row.to_dict()) # hidden field for AI
    }]
    
    return {"batchId": batch_id, "files": [{"name": f.filename, "status": "queued"} for f in files]}

@app.get("/api/upload/{batch_id}/status")
def get_upload_status(batch_id: str):
    return {"batchId": batch_id, "steps": {"dedupe": "done", "fillna": "done", "dates": "done", "structure": "done"}, "recordsProcessed": db["batches"].get(batch_id, {}).get("recordsProcessed", 0)}

@app.get("/api/financials/{batch_id}")
def get_financials(batch_id: str):
    return db["batches"].get(batch_id, {}).get("financials", {})

@app.get("/api/anomalies/{batch_id}")
def get_anomalies(batch_id: str):
    return db["anomalies"].get(batch_id, [])

@app.get("/api/anomalies/{batch_id}/{anomaly_id}")
def get_anomaly_detail(batch_id: str, anomaly_id: str):
    anomalies = db["anomalies"].get(batch_id, [])
    for a in anomalies:
        if a["id"] == anomaly_id: return a
    return {}

@app.post("/api/anomalies/{anomaly_id}/investigate")
def investigate_anomaly(anomaly_id: str):
    # 1. Find anomaly
    target_anomaly = None
    target_batch = None
    for b_id, anomalies in db["anomalies"].items():
        for a in anomalies:
            if a["id"] == anomaly_id:
                target_anomaly = a
                target_batch = b_id
                break
    
    if not target_anomaly: return {"error": "Not found"}

    # 2. RUN THE LANGGRAPH AGENT
    agent_result = run_investigation_agent(target_anomaly["raw_data"], target_anomaly["amount"])
    
    # 3. Update the database with AI results
    target_anomaly["aiExplained"] = True
    target_anomaly["description"] = agent_result["explanation"]
    target_anomaly["severity"] = agent_result["severity"]
    target_anomaly["timeline"].append({
        "title": "AI Investigation Complete", 
        "time": "Just now", 
        "body": agent_result["explanation"], 
        "tone": "alert" if agent_result["severity"] in ["high", "critical"] else "ok"
    })
    
    return {"explained": True, "explanation": agent_result["explanation"], "sources": agent_result["sources"]}

@app.post("/api/anomalies/{anomaly_id}/response")
def human_response(anomaly_id: str, payload: dict):
    reply = payload.get("reply", "").lower()
    updated_status = "cleared" if "approve" in reply or "legit" in reply else "escalated"
    
    # Update timeline (simplified for demo)
    return {
        "updatedStatus": updated_status,
        "aiSummary": f"Human manager replied: {updated_status.upper()}"
    }

@app.get("/api/feed")
def get_feed():
    return [{"time": "Just now", "text": "Backend API connected successfully."}]

@app.get("/api/report/{batch_id}")
def get_report(batch_id: str):
    return {
        "riskLevel": "medium",
        "summary": "Audit generated by FastAPI and LangGraph backend.",
        "findings": ["1 anomaly investigated."],
        "actions": ["Review pending cases in the dashboard."]
    }