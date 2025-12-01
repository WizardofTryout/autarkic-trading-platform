from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.services.vault import VaultService

router = APIRouter()
vault_service = VaultService()

class VaultInitRequest(BaseModel):
    master_password: str

class VaultUnlockRequest(BaseModel):
    master_password: str

@router.get("/vault/status")
async def get_vault_status():
    return {
        "initialized": vault_service.is_initialized(),
        "unlocked": vault_service.is_unlocked()
    }

@router.post("/vault/init")
async def init_vault(request: VaultInitRequest):
    try:
        vault_service.initialize(request.master_password)
        return {"message": "Vault initialized successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/vault/unlock")
async def unlock_vault(request: VaultUnlockRequest):
    try:
        vault_service.unlock(request.master_password)
        return {"message": "Vault unlocked successfully"}
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid password or vault not initialized")
