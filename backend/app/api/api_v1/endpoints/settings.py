from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import httpx
import google.generativeai as genai

from app.api import deps
from app.models.base import User, UserSecret
from app.core.encryption import encrypt_value, decrypt_value

router = APIRouter()

# --- Schemas ---

class APIKeyBase(BaseModel):
    key_name: str
    provider: str # gemini, openai, anthropic, ollama, binance, bitget
    model: Optional[str] = None # e.g. gemini-1.5-pro, claude-3-opus

class APIKeyCreate(APIKeyBase):
    api_key: str

class APIKeyResponse(APIKeyBase):
    id: str
    masked_key: str
    is_valid: bool
    last_validated: Optional[datetime]

    class Config:
        from_attributes = True

class ValidationRequest(BaseModel):
    provider: str
    api_key: str
    model: Optional[str] = None
    ollama_url: Optional[str] = None

class SettingsSchema(BaseModel):
    # Trading Parameters (kept from old schema)
    ollamaUrl: Optional[str] = "http://localhost:11434"

# --- Helper Functions ---

def mask_key(key: str) -> str:
    if len(key) <= 8:
        return "*" * len(key)
    return f"{key[:4]}...{key[-4:]}"

async def validate_provider_key(provider: str, api_key: str, model: str = None, ollama_url: str = None) -> bool:
    try:
        if provider == "gemini":
            genai.configure(api_key=api_key)
            # Try to generate content to verify key and model
            model_name = model or "gemini-2.5-flash"
            m = genai.GenerativeModel(model_name)
            response = await m.generate_content_async("Test")
            return True
        elif provider == "openai":
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"}
                )
                return resp.status_code == 200
        elif provider == "anthropic":
            async with httpx.AsyncClient() as client:
                resp = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={
                        "x-api-key": api_key,
                        "anthropic-version": "2023-06-01"
                    }
                )
                return resp.status_code == 200
        elif provider == "ollama":
            url = ollama_url or "http://localhost:11434"
            async with httpx.AsyncClient() as client:
                # If model is specified, check if it exists
                if model:
                    resp = await client.post(f"{url}/api/show", json={"name": model})
                    return resp.status_code == 200
                else:
                    resp = await client.get(f"{url}/api/tags")
                    return resp.status_code == 200
        elif provider in ["binance", "bitget"]:
            # TODO: Implement exchange validation if needed
            return True
        return False
    except Exception as e:
        print(f"Validation failed for {provider}: {e}")
        return False

# --- Endpoints ---

@router.get("/keys", response_model=List[APIKeyResponse])
async def get_api_keys(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    print(f"DEBUG: Fetching keys for user {current_user.id}")
    try:
        result = await db.execute(select(UserSecret).where(UserSecret.user_id == current_user.id))
        secrets = result.scalars().all()
        print(f"DEBUG: Found {len(secrets)} secrets")
    except Exception as e:
        print(f"DEBUG: Error fetching keys: {e}")
        raise e
    
    response = []
    for s in secrets:
        decrypted = decrypt_value(s.encrypted_value)
        response.append(APIKeyResponse(
            key_name=s.key_name,
            provider=s.provider,
            model=s.model,
            id=str(s.id),
            masked_key=mask_key(decrypted),
            is_valid=s.is_valid,
            last_validated=s.last_validated
        ))
    return response

@router.post("/keys", response_model=APIKeyResponse)
async def add_api_key(
    key_in: APIKeyCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Validate first
    is_valid = await validate_provider_key(key_in.provider, key_in.api_key, key_in.model)
    
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Validation failed for {key_in.provider} key")

    encrypted = encrypt_value(key_in.api_key)
    
    secret = UserSecret(
        user_id=current_user.id,
        key_name=key_in.key_name,
        provider=key_in.provider,
        model=key_in.model,
        encrypted_value=encrypted,
        is_valid=is_valid,
        last_validated=datetime.utcnow() if is_valid else None
    )
    db.add(secret)
    await db.commit()
    await db.refresh(secret)
    
    return APIKeyResponse(
        key_name=secret.key_name,
        provider=secret.provider,
        model=secret.model,
        id=str(secret.id),
        masked_key=mask_key(key_in.api_key),
        is_valid=secret.is_valid,
        last_validated=secret.last_validated
    )

@router.delete("/keys/{key_id}")
async def delete_api_key(
    key_id: str,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(select(UserSecret).where(
        UserSecret.id == key_id,
        UserSecret.user_id == current_user.id
    ))
    secret = result.scalars().first()
    if not secret:
        raise HTTPException(status_code=404, detail="Key not found")
        
    await db.delete(secret)
    await db.commit()
    return {"message": "Key deleted"}

@router.post("/keys/validate")
async def validate_key(
    request: ValidationRequest
):
    is_valid = await validate_provider_key(request.provider, request.api_key, request.model, request.ollama_url)
    return {"is_valid": is_valid}

# --- Legacy/General Settings Endpoints ---

@router.get("/", response_model=SettingsSchema)
async def get_settings(
    current_user: User = Depends(deps.get_current_user),
):
    prefs = current_user.preferences or {}
    return SettingsSchema(
        ollamaUrl=prefs.get("ollamaUrl", "http://localhost:11434")
    )

@router.post("/", response_model=SettingsSchema)
async def save_settings(
    settings_in: SettingsSchema,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    prefs = current_user.preferences or {}
    prefs.update({
        "ollamaUrl": settings_in.ollamaUrl
    })
    current_user.preferences = prefs
    db.add(current_user)
    await db.commit()
    return settings_in
