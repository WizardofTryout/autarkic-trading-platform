from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.models.base import User, UserSecret
from app.core.encryption import decrypt_value
import google.generativeai as genai

router = APIRouter()

class ChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None

class ChatResponse(BaseModel):
    response: str

@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    request: ChatRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # 1. Fetch AI API Key (Gemini)
    # We look for a valid key with provider='gemini'
    result = await db.execute(select(UserSecret).where(
        UserSecret.user_id == current_user.id,
        UserSecret.provider == "gemini",
        UserSecret.is_valid == True
    ))
    secret = result.scalars().first()
    
    if not secret:
        # Fallback: Try to find ANY gemini key even if not marked valid (e.g. if validation failed but key is correct)
        result = await db.execute(select(UserSecret).where(
            UserSecret.user_id == current_user.id,
            UserSecret.provider == "gemini"
        ))
        secret = result.scalars().first()

    if not secret:
        raise HTTPException(status_code=400, detail="AI API Key not found. Please add a Google Gemini key in Settings.")
        
    try:
        api_key = decrypt_value(secret.encrypted_value)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt API Key.")

    # 2. Configure Gemini
    try:
        genai.configure(api_key=api_key)
        # Use stored model or default
        model_name = secret.model or 'gemini-2.5-flash'
        model = genai.GenerativeModel(model_name)
        
        # 3. Construct Prompt
        system_context = """You are an expert Crypto Trading Assistant and Pine Script Developer.
        Your goal is to help the user write profitable trading strategies, debug code, and analyze market trends.
        Always provide concise, correct Pine Script (v5) code when asked.
        """
        
        user_context = ""
        if request.context:
            if "script" in request.context:
                user_context += f"\n\nCurrent Script:\n```pinescript\n{request.context['script']}\n```"
            if "symbol" in request.context:
                user_context += f"\n\nCurrent Symbol: {request.context['symbol']}"
            if "timeframe" in request.context:
                user_context += f"\nTimeframe: {request.context['timeframe']}"
            if "analysis_content" in request.context:
                user_context += f"\n\nCurrent Analysis Context:\n{request.context['analysis_content']}"

        full_prompt = f"{system_context}\n{user_context}\n\nUser: {request.message}"
        
        # 4. Generate Content
        response = model.generate_content(full_prompt)
        
        return ChatResponse(response=response.text)
        
    except Exception as e:
        print(f"AI Error with model {model_name}: {e}")
        # Attempt to list available models for debugging
        try:
            print("Available models:")
            for m in genai.list_models():
                print(f"- {m.name}")
        except Exception as list_err:
            print(f"Failed to list models: {list_err}")
            
        raise HTTPException(status_code=500, detail=f"AI Provider Error: {str(e)}")
