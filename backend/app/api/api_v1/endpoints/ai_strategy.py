from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.models.base import User, UserSecret
from app.core.encryption import decrypt_value
import google.generativeai as genai

router = APIRouter()

class StrategyGenRequest(BaseModel):
    prompt: str
    current_code: Optional[str] = None

class StrategyGenResponse(BaseModel):
    code: str
    explanation: str

@router.post("/generate_strategy", response_model=StrategyGenResponse)
async def generate_strategy(
    request: StrategyGenRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # 1. Fetch AI API Key (Gemini)
    result = await db.execute(select(UserSecret).where(
        UserSecret.user_id == current_user.id,
        UserSecret.provider == "gemini",
        UserSecret.is_valid == True
    ))
    secret = result.scalars().first()
    
    if not secret:
        # Fallback
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
        model_name = secret.model or 'gemini-2.5-flash'
        model = genai.GenerativeModel(model_name)
        
        # 3. Construct Prompt
        system_prompt = """You are an expert Pine Script v5 Developer.
        Your task is to generate valid, compilable Pine Script code based on the user's description.
        
        Rules:
        1. Output ONLY the code inside a ```pinescript block.
        2. Followed by a brief explanation.
        3. Use `strategy()` for strategies, `indicator()` for indicators.
        4. Include `overlay=true` if it should be on the main chart.
        5. Use strict v5 syntax.
        """
        
        user_prompt = f"User Request: {request.prompt}"
        if request.current_code:
            user_prompt += f"\n\nExisting Code:\n{request.current_code}\n\n(Modify or replace this code based on the request)"

        full_prompt = f"{system_prompt}\n\n{user_prompt}"
        
        # 4. Generate Content
        response = model.generate_content(full_prompt)
        text = response.text
        
        # 5. Parse Response (Extract Code and Explanation)
        code = ""
        explanation = text
        
        if "```pinescript" in text:
            parts = text.split("```pinescript")
            if len(parts) > 1:
                code_part = parts[1].split("```")[0]
                code = code_part.strip()
                explanation = parts[1].split("```")[1].strip() if len(parts[1].split("```")) > 1 else ""
        elif "```" in text: # Fallback if language tag is missing
            parts = text.split("```")
            if len(parts) > 1:
                code = parts[1].strip()
                explanation = parts[2].strip() if len(parts) > 2 else ""
                
        if not code:
            # If no code block found, assume the whole text is explanation or failed
            # But try to see if the model just outputted code
            if "//" in text or "strategy(" in text or "indicator(" in text:
                code = text
                explanation = "Generated based on your request."
            else:
                code = "// Could not generate valid code block."
                explanation = text

        return StrategyGenResponse(code=code, explanation=explanation)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Provider Error: {str(e)}")
