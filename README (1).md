# AuditIQ — Setup & Run Guide 

## What you have
- `app.py` — full Gradio frontend + working pipeline for all 9 steps
- `sample_transactions.csv` — test data 
- Twilio calls and SendGrid emails are **mocked** (printed/shown in UI) so
  the app runs end-to-end with zero API keys tonight. Real integration is a
  small swap later (see "Going live" below).

## Step 1 — Environment setup 
```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install gradio pandas duckduckgo-search fpdf2 python-dotenv
```

## Step 2 — Run it
```bash
python app.py
```
Gradio will print a local URL (usually `http://127.0.0.1:7860`). Open it in
your browser.

## Step 3 — Demo flow 
1. Upload `sample_transactions.csv`
2. Click **Run Audit Pipeline** — watch it clean data, calculate financials,
   detect the ₹9,80,000 anomaly, and show it was escalated as CRITICAL
   because self-explanation and web search couldn't resolve it
3. A **Human Input Required** box appears — type something like
   `"This payment was approved, it was a scheduled machinery purchase"`
4. Click **Submit & Resume Investigation** — the graph doesn't restart, it
   resumes with your answer folded into the same anomaly record
5. Final report appears in the text box AND as a downloadable PDF

This demo sequence directly shows your two differentiators: **self-search
before escalating** and **resume, not restart**. Say both explicitly when
presenting — judges won't infer it just from clicking buttons.

## Step 4 — Team split for the rest of this week
- **Data/Calc person**: tune `clean_data()` and `calculate_financials()`
  for your actual invoice/statement formats (multiple date formats,
  multi-currency, tax columns)
- **Investigation/search person**: improve `detect_anomalies()` (add
  Benford's Law, time-of-day checks, missing invoice detection) and
  `web_search_investigate()` (better query construction, extract structured
  facts instead of raw snippets)
- **Comms/UI/report person**: replace mocked `escalate()` with real Twilio
  + SendGrid calls, polish the Gradio UI, and improve `save_report_pdf()`
  with a proper letterhead/branding

## Going live with real integrations later

### SendGrid (email)
```python
import sendgrid
from sendgrid.helpers.mail import Mail

def send_email(to, subject, body):
    sg = sendgrid.SendGridAPIClient(api_key=os.getenv("SENDGRID_API_KEY"))
    msg = Mail(from_email="audit@yourcompany.com", to_emails=to,
               subject=subject, plain_text_content=body)
    sg.send(msg)
```

### Twilio (phone call with text-to-speech alert)
```python
from twilio.rest import Client

def make_call(to_number, message):
    client = Client(os.getenv("TWILIO_SID"), os.getenv("TWILIO_AUTH"))
    client.calls.create(
        to=to_number,
        from_=os.getenv("TWILIO_FROM_NUMBER"),
        twiml=f"<Response><Say>{message}</Say></Response>",
    )
```

Add both to a `.env` file (never commit it):
```
SENDGRID_API_KEY=...
TWILIO_SID=...
TWILIO_AUTH=...
TWILIO_FROM_NUMBER=...
```

## Migrating this to real LangGraph (after tomorrow)
Right now `run_pipeline()` and `resume_with_human_input()` are plain Python
functions simulating the flow — good enough for a demo. To make it a true
LangGraph agent later:
1. Wrap each function (`clean_data`, `calculate_financials`,
   `detect_anomalies`, `self_explain`, `web_search_investigate`,
   `classify_severity`, `escalate`) as a LangGraph **node**
2. Use conditional edges for the self-explain and severity branches
3. Replace the manual `pending_for_human` list with LangGraph's
   `interrupt()` + a checkpointer (`MemorySaver` or `SqliteSaver`) so the
   graph actually pauses and resumes via `thread_id`, instead of Python
   just holding state in a dict
4. Swap Groq in as the LLM for the self-explain reasoning step (currently
   a keyword heuristic) so it can reason over transaction context instead
   of pattern-matching

