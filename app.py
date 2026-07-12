"""
AuditIQ — AI Financial Audit & Fraud Investigation Agent
Frontend: Gradio
Flow: Upload -> Clean -> Calculate -> Detect Anomalies -> Self-Explain Check
      -> Web Search -> Severity Check -> Escalate (Email/Call) -> Wait for
      Human -> Resume -> Final Report

This file is a runnable MVP skeleton. Twilio/SendGrid calls are mocked by
default (printed to console / shown in UI) so it runs without live API keys.
Swap the mock functions for real Twilio/SendGrid calls once credentials are
ready (see README.md).
"""

import os
import io
import json
import datetime as dt

import pandas as pd
import gradio as gr
from dotenv import load_dotenv

load_dotenv()

# Optional real integrations - only activate if keys are present
USE_REAL_SEARCH = True
try:
    from duckduckgo_search import DDGS
except ImportError:
    USE_REAL_SEARCH = False

TWILIO_SID = os.getenv("TWILIO_SID")
TWILIO_AUTH = os.getenv("TWILIO_AUTH")
SENDGRID_KEY = os.getenv("SENDGRID_API_KEY")


# ---------------------------------------------------------------------------
# STEP 2: Data Cleaning Agent
# ---------------------------------------------------------------------------
def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Standardize date column if present
    for col in df.columns:
        if "date" in col:
            df[col] = pd.to_datetime(df[col], errors="coerce", dayfirst=True)

    # Standardize amount column
    for col in df.columns:
        if "amount" in col or "value" in col:
            df[col] = (
                df[col]
                .astype(str)
                .str.replace(",", "", regex=False)
                .str.replace("₹", "", regex=False)
                .str.replace("$", "", regex=False)
                .str.strip()
            )
            df[col] = pd.to_numeric(df[col], errors="coerce")

    before = len(df)
    df = df.drop_duplicates()
    df = df.dropna(how="all")
    after = len(df)

    df.attrs["cleaning_notes"] = f"Removed {before - after} duplicate/empty rows."
    return df


# ---------------------------------------------------------------------------
# STEP 3: Financial Calculation Agent
# ---------------------------------------------------------------------------
def calculate_financials(df: pd.DataFrame) -> dict:
    amount_col = next((c for c in df.columns if "amount" in c or "value" in c), None)
    type_col = next((c for c in df.columns if "type" in c or "category" in c), None)

    results = {}
    if amount_col is None:
        results["error"] = "No amount column detected."
        return results

    total = df[amount_col].sum()
    results["total_transactions"] = len(df)
    results["total_amount"] = round(float(total), 2)
    results["average_amount"] = round(float(df[amount_col].mean()), 2)
    results["max_amount"] = round(float(df[amount_col].max()), 2)
    results["min_amount"] = round(float(df[amount_col].min()), 2)

    if type_col:
        revenue = df[df[type_col].astype(str).str.lower().str.contains("credit|revenue|income", na=False)][amount_col].sum()
        expense = df[df[type_col].astype(str).str.lower().str.contains("debit|expense|payment", na=False)][amount_col].sum()
        results["revenue"] = round(float(revenue), 2)
        results["expense"] = round(float(expense), 2)
        results["profit_loss"] = round(float(revenue - expense), 2)

    return results


# ---------------------------------------------------------------------------
# STEP 4: Anomaly Detection Agent (rule-based, easy to extend with LLM)
# ---------------------------------------------------------------------------
def detect_anomalies(df: pd.DataFrame) -> list:
    amount_col = next((c for c in df.columns if "amount" in c or "value" in c), None)
    if amount_col is None:
        return []

    anomalies = []
    # Median/IQR-based detection is more robust than mean/std for small
    # samples, since a single large outlier otherwise inflates std and can
    # mask itself.
    median = df[amount_col].median()
    q1 = df[amount_col].quantile(0.25)
    q3 = df[amount_col].quantile(0.75)
    iqr = (q3 - q1) or 1
    mad = (df[amount_col] - median).abs().median() or 1  # median absolute deviation, fallback signal

    for idx, row in df.iterrows():
        amt = row[amount_col]
        iqr_multiple = (amt - median) / iqr
        # Flag if far outside IQR fence, OR simply a large multiple of the
        # typical (median) transaction size — catches spikes in small datasets.
        ratio_to_median = amt / median if median else 0
        if abs(iqr_multiple) > 3 or (median > 0 and ratio_to_median > 5):
            anomalies.append({
                "row": int(idx),
                "amount": float(amt),
                "reason": (f"Amount is {round(ratio_to_median, 1)}x the typical (median) "
                           f"transaction of ₹{round(median, 2)}."),
                "z_score": round(float(iqr_multiple), 2),
                "data": {k: str(v) for k, v in row.to_dict().items()},
            })

    # Duplicate payment check
    dup_cols = [c for c in df.columns if "amount" in c or "vendor" in c or "payee" in c]
    if len(dup_cols) >= 1:
        dup_rows = df[df.duplicated(subset=dup_cols, keep=False)]
        for idx, row in dup_rows.iterrows():
            anomalies.append({
                "row": int(idx),
                "amount": float(row.get(amount_col, 0)),
                "reason": "Possible duplicate payment (matching amount/vendor).",
                "z_score": None,
                "data": {k: str(v) for k, v in row.to_dict().items()},
            })

    return anomalies


# ---------------------------------------------------------------------------
# STEP 5: Self-Explanation Check
# ---------------------------------------------------------------------------
KNOWN_PATTERNS = [
    "annual equipment purchase", "yearly bonus", "quarterly tax payment",
    "insurance premium", "rent renewal",
]

def self_explain(anomaly: dict) -> str | None:
    # Placeholder heuristic — in production, compare against historical
    # records / prior-year same-period transactions.
    text = json.dumps(anomaly["data"]).lower()
    for pattern in KNOWN_PATTERNS:
        if pattern.split()[0] in text:
            return f"Matches known recurring pattern: '{pattern}'."
    return None


# ---------------------------------------------------------------------------
# STEP 6: Web Search Tool (self-investigate before escalating)
# ---------------------------------------------------------------------------
def web_search_investigate(anomaly: dict) -> str | None:
    query = f"unusual business transaction ₹{anomaly['amount']} explanation India {dt.datetime.now().year}"
    if not USE_REAL_SEARCH:
        return None
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=3))
        if results:
            snippet = results[0].get("body", "")[:200]
            return f"Web search context found: {snippet}..." if snippet else None
    except Exception:
        return None
    return None


# ---------------------------------------------------------------------------
# STEP 7: Severity Check
# ---------------------------------------------------------------------------
def classify_severity(anomaly: dict) -> str:
    amt = abs(anomaly["amount"])
    z = anomaly.get("z_score") or 0
    if amt >= 500000 or abs(z) > 5:
        return "critical"
    if amt >= 100000 or abs(z) > 3.5:
        return "high"
    if amt >= 20000:
        return "medium"
    return "low"


def escalate(anomaly: dict, severity: str) -> str:
    if severity in ("low", "medium"):
        # MOCK SendGrid email
        msg = (f"[EMAIL SENT - mock] To: finance.manager@company.com | "
               f"Subject: Clarification needed on ₹{anomaly['amount']} transaction (row {anomaly['row']})")
        return msg
    else:
        # MOCK Twilio call
        msg = (f"[PHONE CALL TRIGGERED - mock] Calling finance manager re: "
               f"CRITICAL anomaly ₹{anomaly['amount']} (row {anomaly['row']})")
        return msg


# ---------------------------------------------------------------------------
# STEP 8 & 9: Resume investigation with human response, generate report
# ---------------------------------------------------------------------------
def build_report(cleaning_notes, financials, investigated_anomalies) -> str:
    lines = []
    lines.append("=" * 60)
    lines.append("AUDITIQ — FINANCIAL AUDIT REPORT")
    lines.append(f"Generated: {dt.datetime.now().strftime('%Y-%m-%d %H:%M')}")
    lines.append("=" * 60)
    lines.append("\n1. DATA CLEANING SUMMARY")
    lines.append(cleaning_notes or "No issues found.")

    lines.append("\n2. FINANCIAL SUMMARY")
    for k, v in financials.items():
        lines.append(f"   - {k.replace('_', ' ').title()}: {v}")

    lines.append("\n3. ANOMALY INVESTIGATION")
    if not investigated_anomalies:
        lines.append("   No anomalies detected.")
    for i, a in enumerate(investigated_anomalies, 1):
        lines.append(f"\n   Anomaly #{i} (row {a['row']}, amount ₹{a['amount']})")
        lines.append(f"      Reason flagged: {a['reason']}")
        lines.append(f"      Severity: {a['severity'].upper()}")
        lines.append(f"      Self-explained: {a.get('self_explanation') or 'No'}")
        lines.append(f"      Web search finding: {a.get('search_finding') or 'None'}")
        lines.append(f"      Escalation: {a.get('escalation_msg') or 'Not escalated'}")
        lines.append(f"      Human response: {a.get('human_response') or 'Pending'}")
        lines.append(f"      Final status: {a.get('final_status') or 'Under review'}")

    lines.append("\n4. RECOMMENDED ACTIONS")
    critical_count = sum(1 for a in investigated_anomalies if a["severity"] == "critical")
    if critical_count:
        lines.append(f"   - {critical_count} critical anomaly(ies) require immediate management review.")
    else:
        lines.append("   - No critical anomalies. Routine follow-up recommended for flagged items.")

    lines.append("\n" + "=" * 60)
    lines.append("END OF REPORT")
    return "\n".join(lines)


def save_report_pdf(report_text: str, path: str):
    from fpdf import FPDF
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Courier", size=10)
    for line in report_text.split("\n"):
        pdf.multi_cell(0, 5, line)
    pdf.output(path)


# ---------------------------------------------------------------------------
# GRADIO APP — orchestrates the full pipeline with human-in-the-loop
# ---------------------------------------------------------------------------
def run_pipeline(file):
    if file is None:
        return "Please upload a file.", None, gr.update(visible=False), []

    if file.name.endswith(".csv"):
        df = pd.read_csv(file.name)
    else:
        df = pd.read_excel(file.name)

    cleaned = clean_data(df)
    financials = calculate_financials(cleaned)
    raw_anomalies = detect_anomalies(cleaned)

    investigated = []
    pending_for_human = []

    for a in raw_anomalies:
        explanation = self_explain(a)
        if explanation:
            a["self_explanation"] = explanation
            a["final_status"] = "Resolved automatically (self-explained)"
            a["severity"] = "n/a"
            investigated.append(a)
            continue

        finding = web_search_investigate(a)
        if finding:
            a["search_finding"] = finding
            a["final_status"] = "Resolved automatically (web search match)"
            a["severity"] = "n/a"
            investigated.append(a)
            continue

        severity = classify_severity(a)
        a["severity"] = severity
        a["escalation_msg"] = escalate(a, severity)
        a["final_status"] = "Awaiting human response"
        investigated.append(a)
        pending_for_human.append(a)

    summary_lines = [
        f"Rows processed: {len(cleaned)}",
        f"Anomalies detected: {len(raw_anomalies)}",
        f"Auto-resolved: {len(investigated) - len(pending_for_human)}",
        f"Escalated (need human input): {len(pending_for_human)}",
    ]
    summary = "\n".join(summary_lines)

    report_preview = build_report(cleaned.attrs.get("cleaning_notes", ""), financials, investigated)

    # State passed forward for the "resume" step
    state = {
        "cleaning_notes": cleaned.attrs.get("cleaning_notes", ""),
        "financials": financials,
        "investigated": investigated,
    }

    if pending_for_human:
        return summary, report_preview, gr.update(visible=True), state
    else:
        return summary, report_preview, gr.update(visible=False), state


def resume_with_human_input(human_text, state):
    if not state:
        return "Run the pipeline first.", None

    investigated = state["investigated"]
    for a in investigated:
        if a.get("final_status") == "Awaiting human response":
            a["human_response"] = human_text
            lowered = human_text.lower()
            if "approve" in lowered or "legit" in lowered or "authorized" in lowered:
                a["final_status"] = "Cleared — approved by finance manager"
            elif "suspicious" in lowered or "fraud" in lowered or "not authorized" in lowered:
                a["final_status"] = "CONFIRMED ISSUE — flagged for further action"
            else:
                a["final_status"] = f"Noted: {human_text}"

    final_report = build_report(state["cleaning_notes"], state["financials"], investigated)

    out_path = "/tmp/auditiq_report.pdf"
    try:
        save_report_pdf(final_report, out_path)
    except Exception:
        out_path = None

    return final_report, out_path


with gr.Blocks(title="AuditIQ — AI Financial Audit Agent") as demo:
    gr.Markdown("# 🔍 AuditIQ — AI Financial Audit & Fraud Investigation Agent")
    gr.Markdown(
        "Upload financial data → automatic cleaning, calculation, anomaly "
        "detection, self-investigation (reasoning + web search), and "
        "escalation only when truly needed."
    )

    pipeline_state = gr.State()

    with gr.Row():
        file_input = gr.File(label="Upload CSV / Excel", file_types=[".csv", ".xlsx", ".xls"])
        run_btn = gr.Button("Run Audit Pipeline", variant="primary")

    summary_box = gr.Textbox(label="Pipeline Summary", lines=4)
    report_box = gr.Textbox(label="Investigation Report (live)", lines=18)

    with gr.Group(visible=False) as human_input_group:
        gr.Markdown("### ⚠️ Human Input Required — one or more anomalies were escalated")
        human_response = gr.Textbox(
            label="Finance Manager Response",
            placeholder="e.g. 'This payment was approved' or 'That payment is suspicious'",
        )
        resume_btn = gr.Button("Submit & Resume Investigation", variant="stop")

    final_report_box = gr.Textbox(label="Final Audit Report", lines=20)
    pdf_output = gr.File(label="Download PDF Report")

    run_btn.click(
        run_pipeline,
        inputs=[file_input],
        outputs=[summary_box, report_box, human_input_group, pipeline_state],
    )

    resume_btn.click(
        resume_with_human_input,
        inputs=[human_response, pipeline_state],
        outputs=[final_report_box, pdf_output],
    )

if __name__ == "__main__":
    demo.launch()
