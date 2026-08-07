import os
import json
from dotenv import load_dotenv
from groq import Groq
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
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("❌ ERROR: You must put a real GROQ_API_KEY in your backend/.env file!")
        raise HTTPException(status_code=500, detail="Invalid or missing GROQ_API_KEY in .env")

    context_str = "You are GroundTruth Copilot, an AI assistant analyzing district telemetry in India."
    
    # 2. RAG LOGIC: Inject real satellite data for the current district
    if request.district_id:
        try:
            district_data = fetch_district_data(request.district_id)
            if district_data:
                # Convert the district data to a JSON string to serve as "master_json" for this map
                if hasattr(district_data, "dict"):
                    district_dict = district_data.dict()
                elif hasattr(district_data, "model_dump"):
                    district_dict = district_data.model_dump()
                else:
                    district_dict = district_data
                
                context_str += f"\n\nHere is the master_json telemetry data for the currently displayed district:\n{json.dumps(district_dict, indent=2)}"
                context_str += "\n\nUse this data to answer the user's questions accurately in real-time."
        except Exception as e:
            print(f"Failed to fetch district context: {e}")
    else:
        # If no specific district is selected, give a brief overview of the system capabilities
        context_str += "\n\nThe user is currently looking at the national overview map. No specific district is selected. Ask them to select a district for detailed telemetry data."

    try:
        # 3. Call Groq API
        client = Groq(api_key=api_key)
        
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": context_str
                },
                {
                    "role": "user",
                    "content": request.message
                }
            ],
            model="llama-3.1-8b-instant",
            temperature=0.5,
            max_tokens=1024,
        )
        
        return {"reply": chat_completion.choices[0].message.content}
    except Exception as e:
        print(f"❌ GROQ API CRASHED: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Groq API Error: {str(e)}")
