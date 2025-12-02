from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional

from app.api import deps
from app.models.base import User, UserSecret
from app.core.encryption import encrypt_value, decrypt_value

router = APIRouter()

class SettingsSchema(BaseModel):
    bitgetApiKey: Optional[str] = ""
    binanceApiKey: Optional[str] = ""
    aiApiKey: Optional[str] = ""
    ollamaUrl: Optional[str] = "http://localhost:11434"
    investmentPerTrade: Optional[float] = 100.0
    riskRewardRatio: Optional[str] = "1:2"
    stopLoss: Optional[float] = 2.0
    takeProfit: Optional[float] = 4.0
    tradeDirection: Optional[str] = "Long"
    leverage: Optional[float] = 1.0

@router.get("/", response_model=SettingsSchema)
async def get_settings(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Load preferences
    prefs = current_user.preferences or {}
    
    # Load secrets
    result = await db.execute(select(UserSecret).where(UserSecret.user_id == current_user.id))
    secrets = result.scalars().all()
    secret_map = {s.key_name: s.encrypted_value for s in secrets}

    # Helper to check if key exists (mask it)
    def get_masked(key):
        return "********" if key in secret_map else ""

    return SettingsSchema(
        bitgetApiKey=get_masked("BITGET_API_KEY"),
        binanceApiKey=get_masked("BINANCE_API_KEY"),
        aiApiKey=get_masked("AI_API_KEY"),
        ollamaUrl=prefs.get("ollamaUrl", "http://localhost:11434"),
        investmentPerTrade=prefs.get("investmentPerTrade", 100.0),
        riskRewardRatio=prefs.get("riskRewardRatio", "1:2"),
        stopLoss=prefs.get("stopLoss", 2.0),
        takeProfit=prefs.get("takeProfit", 4.0),
        tradeDirection=prefs.get("tradeDirection", "Long"),
        leverage=prefs.get("leverage", 1.0)
    )

@router.post("/", response_model=SettingsSchema)
async def save_settings(
    settings_in: SettingsSchema,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Update preferences (non-sensitive)
    prefs = current_user.preferences or {}
    prefs.update({
        "ollamaUrl": settings_in.ollamaUrl,
        "investmentPerTrade": settings_in.investmentPerTrade,
        "riskRewardRatio": settings_in.riskRewardRatio,
        "stopLoss": settings_in.stopLoss,
        "takeProfit": settings_in.takeProfit,
        "tradeDirection": settings_in.tradeDirection,
        "leverage": settings_in.leverage
    })
    current_user.preferences = prefs
    db.add(current_user)

    # Update secrets (sensitive)
    async def update_secret(key_name: str, value: str):
        if not value: return # Don't update if empty
        if value == "********": return # Don't update if masked (unchanged)
        
        # Check existing
        result = await db.execute(select(UserSecret).where(
            UserSecret.user_id == current_user.id,
            UserSecret.key_name == key_name
        ))
        secret = result.scalars().first()
        
        encrypted = encrypt_value(value)
        
        if secret:
            secret.encrypted_value = encrypted
        else:
            secret = UserSecret(
                user_id=current_user.id,
                key_name=key_name,
                encrypted_value=encrypted
            )
            db.add(secret)

    await update_secret("BITGET_API_KEY", settings_in.bitgetApiKey)
    await update_secret("BINANCE_API_KEY", settings_in.binanceApiKey)
    await update_secret("AI_API_KEY", settings_in.aiApiKey)

    await db.commit()
    
    # Return masked values
    return await get_settings(current_user, db)
