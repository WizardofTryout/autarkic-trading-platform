from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api import deps
from app.models.base import User
from pydantic import BaseModel
from typing import Dict, Any, Optional

router = APIRouter()

class UserPreferencesUpdate(BaseModel):
    preferences: Dict[str, Any]

@router.get("/me/preferences")
async def get_user_preferences(
    current_user: User = Depends(deps.get_current_user),
):
    """
    Get current user's preferences.
    """
    return current_user.preferences or {}

@router.put("/me/preferences")
async def update_user_preferences(
    prefs_in: UserPreferencesUpdate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Update user's preferences. Merges with existing preferences.
    """
    current_prefs = current_user.preferences or {}
    # Deep merge or shallow merge? Shallow for now, but per-key replacement.
    # Actually, let's just update the top-level keys.
    updated_prefs = {**current_prefs, **prefs_in.preferences}
    
    current_user.preferences = updated_prefs
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user.preferences
