import os
from dotenv import load_dotenv
from google import genai
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services import district_service

# Load environment variables from .env file
load_dotenv()

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    district_id: Optional[str] = None

def fetch_district_data(district_id: str):
    """Safely finds and invokes the district fetching function in district_service."""
    possible_fn_names = [
        "get_district", 
        "get_district_by_id", 
        "get_district_detail", 
        "get_district_data", 
        "fetch_district"
    ]
    for fn_name in possible_fn_names:
        if hasattr(district_service, fn_name):
            fn = getattr(district_service, fn_name)
            return fn(district_id)
    return None

@router.post("/chat")
async def copilot_chat(request: ChatRequest):
    # 1. Validate API Key
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_actual_gemini_api_key_here":
        print("❌ ERROR: You must put a real Gemini API Key in your backend/.env file!")
        raise HTTPException(status_code=500, detail="Invalid or missing API Key in .env")

    context = ""
    
    # 2. RAG LOGIC: Inject real satellite data if a district is selected
    if request.district_id:
        try:
            district_data = fetch_district_data(request.district_id)
            if district_data:
                name = district_data.get('name') if isinstance(district_data, dict) else getattr(district_data, 'name', '')
                state = district_data.get('state') if isinstance(district_data, dict) else getattr(district_data, 'state', '')
                score = district_data.get('health_score') if isinstance(district_data, dict) else getattr(district_data, 'health_score', 'Pending')
                severity = district_data.get('overall_severity') if isinstance(district_data, dict) else getattr(district_data, 'overall_severity', 'Unknown')
                indicators = district_data.get('indicators', {}) if isinstance(district_data, dict) else getattr(district_data, 'indicators', {})

                w_change = indicators.get('water', {}).get('pct_change', 'N/A') if isinstance(indicators, dict) else 'N/A'
                g_change = indicators.get('green_cover', {}).get('pct_change', 'N/A') if isinstance(indicators, dict) else 'N/A'
                h_change = indicators.get('urban_heat', {}).get('pct_change', 'N/A') if isinstance(indicators, dict) else 'N/A'

                context = f"""
                SYSTEM CONTEXT - GROUNDTRUTH TELEMETRY:
                The user is currently analyzing {name}, {state}.
                Overall Health Score: {score}/100.
                Severity Level: {severity}.
                
                SDG Indicators:
                - Water (SDG 6): {w_change}% change.
                - Vegetation (SDG 15): {g_change}% change.
                - Urban Heat (SDG 11): {h_change}% change.
                
                Keep your answers highly professional, scientific, and strictly based on these telemetry numbers.
                Act as the GroundTruth AI Copilot. 
                """
        except Exception as e:
            print(f"Failed to fetch district context: {e}")

    # 3. Construct final prompt
    prompt = f"{context}\n\nUSER MESSAGE: {request.message}"

    try:
        # 4. Call Gemini using the NEW SDK and 2.0 Flash Model
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt
        )
        
        return {"reply": response.text}
    except Exception as e:
        print(f"❌ GEMINI API CRASHED: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Gemini API Error: {str(e)}")