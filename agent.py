import os
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from langchain_groq import ChatGroq
from duckduckgo_search import DDGS
from dotenv import load_dotenv

load_dotenv()

# Initialize Groq LLM (Super fast, great for agents)
llm = ChatGroq(
    api_key="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", 
    temperature=0, 
    model_name="llama3-8b-8192"
)

# Define the State our graph will pass around
class AgentState(TypedDict):
    anomaly_data: str
    amount: float
    explanation: str
    needs_search: bool
    search_query: str
    search_results: str
    severity: str

# --- NODES ---

def reasoning_node(state: AgentState):
    """Agent analyzes the transaction and decides if it can self-explain."""
    prompt = f"""
    You are an AI Financial Auditor. Analyze this anomalous transaction:
    Details: {state['anomaly_data']}
    Amount: {state['amount']}
    
    Can this be easily explained by common business practices (e.g., annual rent, tax)?
    If YES, provide the explanation.
    If NO, you must search the web. Provide a search query.
    
    Format your response EXACTLY like this:
    NEEDS_SEARCH: TRUE or FALSE
    TEXT: [Your explanation or your search query]
    """
    response = llm.invoke(prompt).content
    
    needs_search = "TRUE" in response.upper()
    text = response.split("TEXT:")[-1].strip()
    
    if needs_search:
        return {"needs_search": True, "search_query": text, "explanation": ""}
    else:
        return {"needs_search": False, "search_query": "", "explanation": text, "severity": "low"}

def web_search_node(state: AgentState):
    """Agent searches the web for context (e.g. GST deadlines, material price spikes)."""
    query = state['search_query']
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=2))
        search_results = "\n".join([r['body'] for r in results])
    except Exception:
        search_results = "Search failed or blocked."
        
    return {"search_results": search_results}

def final_evaluation_node(state: AgentState):
    """Agent makes a final decision after web search."""
    prompt = f"""
    You are an AI Financial Auditor. 
    Transaction: {state['anomaly_data']}
    Web Search Results: {state['search_results']}
    
    Based on the search, can you explain the transaction?
    Provide a brief explanation, and classify severity as LOW, MEDIUM, HIGH, or CRITICAL.
    
    Format EXACTLY:
    SEVERITY: [LOW/MEDIUM/HIGH/CRITICAL]
    EXPLANATION: [Your explanation]
    """
    response = llm.invoke(prompt).content
    
    severity = "HIGH" # fallback
    if "SEVERITY:" in response:
        severity = response.split("SEVERITY:")[1].split("\n")[0].strip().lower()
        
    explanation = response.split("EXPLANATION:")[-1].strip()
    
    return {"severity": severity, "explanation": explanation}

# --- EDGES (Routing) ---
def should_search(state: AgentState):
    if state["needs_search"]:
        return "web_search"
    return "end"

# --- BUILD THE LANGGRAPH ---
workflow = StateGraph(AgentState)

workflow.add_node("reasoning", reasoning_node)
workflow.add_node("web_search", web_search_node)
workflow.add_node("final_evaluation", final_evaluation_node)

workflow.set_entry_point("reasoning")
workflow.add_conditional_edges("reasoning", should_search, {"web_search": "web_search", "end": END})
workflow.add_edge("web_search", "final_evaluation")
workflow.add_edge("final_evaluation", END)

# Compile the agent
audit_agent = workflow.compile()

def run_investigation_agent(anomaly_data: str, amount: float):
    """Helper function to trigger the graph from our API."""
    initial_state = {
        "anomaly_data": anomaly_data,
        "amount": amount,
        "explanation": "",
        "needs_search": False,
        "search_query": "",
        "search_results": "",
        "severity": "medium"
    }
    result = audit_agent.invoke(initial_state)
    return {
        "explanation": result.get("explanation"),
        "severity": result.get("severity", "medium"),
        "sources": [result.get("search_query")] if result.get("search_query") else []
    }