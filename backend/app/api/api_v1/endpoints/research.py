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

class AnalysisResponse(BaseModel):
    symbol: str
    content: str # Markdown report
    timestamp: datetime

class DocumentCreate(BaseModel):
    title: str
    content: str
    doc_type: str = "research_report"
    tags: List[str] = []

class DocumentResponse(BaseModel):
    id: str
    title: str
    content: str
    doc_type: str
    tags: List[str]
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

    # 2. Fetch Market Data (Mock for now, or use MarketService if available)
    # In a real scenario, we would fetch OHLCV here.
    # For MVP, we'll ask the AI to analyze based on its knowledge + provided context if any.
    # TODO: Integrate real OHLCV fetching here.
    
    market_context = f"Symbol: {request.symbol}, Timeframe: {request.timeframe}, Date: {datetime.now().strftime('%Y-%m-%d')}"

    prompt = f"""
    You are a professional Crypto Market Analyst.
    Please provide a comprehensive daily analysis for **{request.symbol}**.
    
    Structure your report in Markdown:
    # {request.symbol} Analysis ({datetime.now().strftime('%Y-%m-%d')})
    
    ## 1. Market Sentiment
    (Bullish/Bearish/Neutral) - Explain why.
    
    ## 2. Key Levels
    - Support: ...
    - Resistance: ...
    
    ## 3. Technical Outlook
    Analyze the trend, potential patterns, and indicators (RSI, MACD) based on general market knowledge.
    
    ## 4. News & Catalysts
    Mention any recent major news or upcoming events relevant to this asset.
    
    ## 5. Trading Idea
    Suggest a potential setup (Long/Short) with entry, stop-loss, and take-profit targets.
    
    Context: {market_context}
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
        tags=doc.tags
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
            created_at=d.created_at
        ) for d in docs
    ]
