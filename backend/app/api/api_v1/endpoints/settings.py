from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal

router = APIRouter()

class Settings(BaseModel):
    bitgetApiKey: str = ""
    binanceApiKey: str = ""
    aiApiKey: str = ""
    ollamaUrl: str = "http://localhost:11434"
    investmentPerTrade: float = 100.0
    riskRewardRatio: str = "1:2"
    stopLoss: float = 2.0
    takeProfit: float = 4.0
    tradeDirection: Literal['Long', 'Short', 'Both'] = 'Long'
    leverage: int = 1

# In-memory storage for now (replace with DB or file storage later)
current_settings = Settings()

@router.get("/", response_model=Settings)
async def get_settings():
    return current_settings

@router.post("/", response_model=Settings)
async def save_settings(settings: Settings):
    global current_settings
    current_settings = settings
    return current_settings
