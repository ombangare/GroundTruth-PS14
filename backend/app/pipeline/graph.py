import os
import json
import asyncio
from typing import Dict, Any, TypedDict, AsyncGenerator
from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage
from langgraph.graph import StateGraph, END
from app.pipeline.extractors import gee_wetlands, gee_forests, gee_degradation, gee_urban_sprawl
from app.pipeline.llm_formatter import format_for_llm

# Using 8b for the heavy lifting analysis to save tokens, 70b for final report writing
llm_analysis = ChatGroq(temperature=0.2, model_name="llama-3.1-8b-instant")
llm_report = ChatGroq(temperature=0.2, model_name="llama-3.3-70b-versatile")

class GraphState(TypedDict):
    structured_payload: Dict[str, Any]
    validation_status: str
    comprehensive_analysis: str
    final_report: str

async def validate_data(state: GraphState) -> GraphState:
    payload = state.get("structured_payload", {})
    if "spatial_context" not in payload or "sdg_analysis" not in payload:
        return {"validation_status": "FAILED: Missing core context."}
    return {"validation_status": "PASSED"}

async def comprehensive_analysis(state: GraphState) -> GraphState:
    """
    PROMPT CONSOLIDATION NODE:
    To completely avoid Groq's strict 6000 TPM limit on free tiers, we consolidate 
    Insights, Correlation, Risk, SDG Assessment, and Recommendations into a SINGLE prompt.
    This reduces token usage by 80% compared to parallel node execution.
    """
    data = state["structured_payload"]
    prompt = f"""
    Analyze this geospatial data and provide a comprehensive breakdown. 
    Format your response with the following headers:
    1. Key Insights (3-4 bullets of raw numerical summaries)
    2. Correlation Analysis (Identify causal links between drivers and findings)
    3. Risk Assessment (Immediate and long-term UN risks)
    4. SDG Progress (Evaluate region's progress toward the target)
    5. Policy Recommendations (3 actionable policies)
    
    Data: {json.dumps(data)}
    """
    response = await llm_analysis.ainvoke([SystemMessage(content="You are a UN ecological data analyst."), HumanMessage(content=prompt)])
    return {"comprehensive_analysis": response.content}

async def report_generation(state: GraphState) -> GraphState:
    prompt = f"""
    Compile the following analysis into a cohesive, highly professional executive summary markdown report.
    Do not include pleasantries. Make it authoritative.
    
    Analysis to compile:
    {state.get('comprehensive_analysis')}
    """
    response = await llm_report.ainvoke([SystemMessage(content="You are the lead scientist compiler."), HumanMessage(content=prompt)])
    return {"final_report": response.content}


# --- Build LangGraph ---
workflow = StateGraph(GraphState)
workflow.add_node("validate", validate_data)
workflow.add_node("analyze", comprehensive_analysis)
# We omit report_generation from the graph and run it directly as an event stream generator to FastAPI!
# workflow.add_node("report", report_generation)

workflow.set_entry_point("validate")
workflow.add_edge("validate", "analyze")
workflow.add_edge("analyze", END)

app_graph = workflow.compile()


def _run_gee_sync(sdg_target: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Runs the synchronous Earth Engine extraction."""
    if sdg_target == "6.6.1":
        return gee_wetlands.analyze_wetland_health(
            payload["minLat"], payload["maxLat"], payload["minLon"], payload["maxLon"],
            payload.get("startYear", "2018"), payload.get("endYear", "2024")
        )
    elif sdg_target == "15.1.1":
        return gee_forests.analyze_forest_cover(
            payload["minLat"], payload["maxLat"], payload["minLon"], payload["maxLon"],
            payload.get("startYear", "2018"), payload.get("endYear", "2024")
        )
    elif sdg_target == "15.3.1":
        return gee_degradation.analyze_land_degradation(
            payload["minLat"], payload["maxLat"], payload["minLon"], payload["maxLon"],
            payload.get("startYear", "2018"), payload.get("endYear", "2024")
        )
    elif sdg_target == "11.3.1":
        return gee_urban_sprawl.analyze_urban_sprawl(
            payload["minLat"], payload["maxLat"], payload["minLon"], payload["maxLon"],
            payload.get("startYear", "2018"), payload.get("endYear", "2020")
        )
    return {"error": f"Unknown SDG target: {sdg_target}"}


async def stream_pipeline_analysis(sdg_target: str, payload: Dict[str, Any]) -> AsyncGenerator[str, None]:
    """
    Generator that yields JSON chunks as Server-Sent Events (SSE).
    """
    extracted_data = await asyncio.to_thread(_run_gee_sync, sdg_target, payload)
    
    if "error" in extracted_data and extracted_data["error"] != "Earth Engine not initialized":
        yield json.dumps({"error": extracted_data["error"]}) + "\n"
        return

    structured_payload = format_for_llm(sdg_target, extracted_data, payload)
    structured_payload["raw_gee_data"] = extracted_data
    
    yield json.dumps({"type": "raw_data", "data": structured_payload}) + "\n"

    initial_state = {
        "structured_payload": structured_payload,
        "validation_status": "", "comprehensive_analysis": "", "final_report": ""
    }
    
    # Execute the graph
    final_state = await app_graph.ainvoke(initial_state)

    # Stream Final Report using the heavy 70b model
    prompt = f"""
    Compile the following analysis into a cohesive, highly professional executive summary markdown report. 
    Do not include pleasantries.
    
    Analysis: {final_state.get('comprehensive_analysis')}
    """
    
    yield json.dumps({"type": "status", "message": "Compiling final report..."}) + "\n"
    
    async for chunk in llm_report.astream([SystemMessage(content="You are the lead scientist compiler."), HumanMessage(content=prompt)]):
        if chunk.content:
             yield json.dumps({"type": "token", "content": chunk.content}) + "\n"
             
    yield json.dumps({"type": "done"}) + "\n"


async def execute_sdg_pipeline(sdg_target: str, payload: Dict[str, Any]) -> Dict[str, Any]:
    """Legacy async endpoint handler."""
    extracted_data = await asyncio.to_thread(_run_gee_sync, sdg_target, payload)
    if "error" in extracted_data: return extracted_data
    
    structured_payload = format_for_llm(sdg_target, extracted_data, payload)
    structured_payload["raw_gee_data"] = extracted_data
    
    initial_state = {"structured_payload": structured_payload}
    
    final_state = await app_graph.ainvoke(initial_state)
    
    prompt = f"Compile this into an executive markdown report: {final_state.get('comprehensive_analysis')}"
    response = await llm_report.ainvoke([SystemMessage(content="Compile."), HumanMessage(content=prompt)])
    structured_payload["llm_analysis"] = response.content
    return structured_payload
