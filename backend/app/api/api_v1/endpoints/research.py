from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime
import google.generativeai as genai

from app.api import deps
from app.models.base import User, UserSecret, UserDocument
from app.core.encryption import decrypt_value
from app.services.market_service import MarketService

router = APIRouter()

# --- Schemas ---

class AnalysisRequest(BaseModel):
    symbol: str
    timeframe: str = "1d"
    prompt_type: str = "trend" # trend, news, custom
    custom_prompt: Optional[str] = None

class AnalysisResponse(BaseModel):
    symbol: str
    content: str # Markdown report
    timestamp: datetime

class DocumentCreate(BaseModel):
    title: str
    content: str
    doc_type: str = "research_report"
    tags: List[str] = []
    folder: str = "General"

class DocumentResponse(BaseModel):
    id: str
    title: str
    content: str
    doc_type: str
    tags: List[str]
    folder: str
    created_at: datetime

# --- Endpoints ---

@router.post("/analyze", response_model=AnalysisResponse)
async def generate_analysis(
    request: AnalysisRequest,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Generate AI analysis for a symbol based on market data.
    """
    # 1. Get Gemini Key
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
        raise HTTPException(status_code=400, detail="Please add a valid Google Gemini API Key in Settings first.")

    try:
        api_key = decrypt_value(secret.encrypted_value)
        genai.configure(api_key=api_key)
        model_name = secret.model or 'gemini-2.5-flash'
        model = genai.GenerativeModel(model_name)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to configure AI: {str(e)}")

    # 2. Fetch Market Data
    market_service = MarketService()
    try:
        # Default limit to 100 candles for analysis
        limit = 100
        ohlcv_data = await market_service.get_ohlcv(request.symbol, request.timeframe, limit=limit)
        
        if not ohlcv_data:
            raise HTTPException(status_code=404, detail=f"No market data found for {request.symbol}")

        # Convert to DataFrame for analysis
        import pandas as pd
        
        df = pd.DataFrame(ohlcv_data)
        df.set_index('timestamp', inplace=True)
        
        # Calculate Indicators (Manual Implementation to avoid pandas_ta dependency issues)
        if len(df) > 20:
            # SMA 20
            df['sma_20'] = df['close'].rolling(window=20).mean()
            
            # EMA 50
            df['ema_50'] = df['close'].ewm(span=50, adjust=False).mean()
            
            # RSI 14
            delta = df['close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
            rs = gain / loss
            df['rsi'] = 100 - (100 / (1 + rs))
            
            # MACD (12, 26, 9)
            exp1 = df['close'].ewm(span=12, adjust=False).mean()
            exp2 = df['close'].ewm(span=26, adjust=False).mean()
            macd = exp1 - exp2
            signal = macd.ewm(span=9, adjust=False).mean()
            
            df['MACD_12_26_9'] = macd
            df['MACDs_12_26_9'] = signal
            df['MACDh_12_26_9'] = macd - signal

        # Prepare Data Summary for LLM
        # We send the last 20 candles as detailed context, and the last candle as "Current State"
        last_candle = df.iloc[-1]
        recent_history = df.tail(20).to_markdown()
        
        current_price = last_candle['close']
        rsi_val = last_candle.get('rsi', 'N/A')
        
        market_context = f"""
        Symbol: {request.symbol}
        Timeframe: {request.timeframe}
        Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
        
        Current Price: {current_price}
        RSI (14): {rsi_val}
        
        Recent Market Data (Last 20 Candles):
        {recent_history}
        """

    except Exception as e:
        print(f"Error preparing market data: {e}")
        # Fallback if data fetching fails, but we should probably error out or warn
        market_context = f"Symbol: {request.symbol}, Timeframe: {request.timeframe}. Error fetching detailed data: {str(e)}"
    finally:
        await market_service.close()

    # Construct Prompt based on Type
    base_prompt = ""
    if request.prompt_type == "news":
        base_prompt = f"""
        You are a Crypto News Analyst.
        Please summarize the recent market sentiment and any major news for **{request.symbol}**.
        Focus on:
        1. Recent headlines (if known).
        2. Impact of macro events.
        3. Sentiment derived from the price action (Volume, Volatility).
        """
    elif request.prompt_type == "custom" and request.custom_prompt:
        base_prompt = f"""
        You are a Crypto Market Expert.
        User Question: "{request.custom_prompt}"
        
        Please answer the user's question specifically for **{request.symbol}** ({request.timeframe}).
        Use the provided technical data to support your answer.
        """
    else: # Default to "trend"
        base_prompt = f"""
        You are a professional Crypto Market Analyst.
        Please provide a comprehensive analysis for **{request.symbol}** ({request.timeframe}).
        
        Structure:
        1. Market Sentiment (Bullish/Bearish)
        2. Key Levels (Support/Resistance)
        3. Technical Outlook (Indicators)
        4. Trading Idea (Entry/Stop/Target)
        """

    prompt = f"""
    {base_prompt}
    
    Context Data:
    {market_context}
    """

    try:
        response = await model.generate_content_async(prompt)
        return AnalysisResponse(
            symbol=request.symbol,
            content=response.text,
            timestamp=datetime.now()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Generation failed: {str(e)}")

@router.post("/documents", response_model=DocumentResponse)
async def save_document(
    doc: DocumentCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """Save a generated report or note."""
    new_doc = UserDocument(
        user_id=current_user.id,
        title=doc.title,
        content=doc.content,
        doc_type=doc.doc_type,
        tags=doc.tags,
        folder=doc.folder
    )
    db.add(new_doc)
    await db.commit()
    await db.refresh(new_doc)
    
    return DocumentResponse(
        id=str(new_doc.id),
        title=new_doc.title,
        content=new_doc.content,
        doc_type=new_doc.doc_type,
        tags=new_doc.tags,
        folder=new_doc.folder,
        created_at=new_doc.created_at
    )

@router.get("/documents", response_model=List[DocumentResponse])
async def list_documents(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """List all saved documents for the user."""
    result = await db.execute(select(UserDocument).where(
        UserDocument.user_id == current_user.id
    ).order_by(UserDocument.created_at.desc()))
    
    docs = result.scalars().all()
    return [
        DocumentResponse(
            id=str(d.id),
            title=d.title,
            content=d.content,
            doc_type=d.doc_type,
            tags=d.tags,
            folder=d.folder,
            created_at=d.created_at
        ) for d in docs
    ]
