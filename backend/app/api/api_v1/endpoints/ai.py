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
            
            # New Context Fields
            if "technical_analysis" in request.context and request.context["technical_analysis"]:
                ta = request.context["technical_analysis"]
                user_context += "\n\nTechnical Analysis (Latest Candle):\n"
                user_context += f"Close: {ta.get('close')}\n"
                user_context += f"RSI (14): {ta.get('rsi')}\n"
                user_context += f"MACD: {ta.get('macd', {}).get('macd')} (Signal: {ta.get('macd', {}).get('signal')}, Hist: {ta.get('macd', {}).get('histogram')})\n"
                if ta.get('bollinger_bands'):
                    bb = ta['bollinger_bands']
                    user_context += f"Bollinger Bands: Upper={bb.get('upper')}, Middle={bb.get('middle')}, Lower={bb.get('lower')}\n"
                user_context += f"SMA (20): {ta.get('sma20')}\n"

            if "portfolio" in request.context and request.context["portfolio"]:
                p = request.context["portfolio"]
                user_context += f"\n\nPortfolio Context:\nBalance: {p.get('balance', 'N/A')}\n"
                if p.get('positions'):
                    user_context += "Open Positions:\n"
                    for pos in p['positions']:
                        # Ensure side is explicit
                        side = pos.get('side', 'UNKNOWN').upper()
                        pnl = pos.get('unrealized_pnl', 'N/A')
                        pnl_percent = pos.get('unrealized_pnl_percent', 'N/A')
                        user_context += f"- {pos.get('symbol')} {side} Size: {pos.get('size')} Entry: {pos.get('entry_price')} Current Price: {pos.get('current_price', 'N/A')} PnL: {pnl} USDT ({pnl_percent}%)\n"
                if p.get('open_orders'):
                    user_context += "Open Orders:\n"
                    for order in p['open_orders']:
                        user_context += f"- {order.get('symbol')} {order.get('side')} Type: {order.get('type')} Price: {order.get('price')}\n"

            if "recent_candles" in request.context and request.context["recent_candles"]:
                user_context += "\n\nRecent Market Data (Last 100 Candles):\n"
                # Format as a simple table or list
                user_context += "Time | Open | High | Low | Close | Volume | RSI | SMA20\n"
                for c in request.context["recent_candles"]:
                    # Simple formatting
                    time_str = c.get('time', '').split('T')[-1].split('.')[0] # Extract HH:MM:SS
                    rsi_val = f"{c.get('rsi', 'N/A'):.2f}" if isinstance(c.get('rsi'), (int, float)) else "N/A"
                    sma_val = f"{c.get('sma20', 'N/A'):.2f}" if isinstance(c.get('sma20'), (int, float)) else "N/A"
                    user_context += f"{time_str} | {c.get('open')} | {c.get('high')} | {c.get('low')} | {c.get('close')} | {c.get('volume')} | {rsi_val} | {sma_val}\n"

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
