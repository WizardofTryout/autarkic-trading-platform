from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta

from app.services.vault import VaultService
from app.api import deps
from app.core import security
from app.models.base import User
from app.schemas.user import UserCreate, UserResponse, Token

router = APIRouter()
vault_service = VaultService()

class VaultInitRequest(BaseModel):
    master_password: str

class VaultUnlockRequest(BaseModel):
    master_password: str

@router.post("/register", response_model=UserResponse)
async def register(user_in: UserCreate, db: AsyncSession = Depends(deps.get_db)):
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    
    # Create user
    user = User(
        email=user_in.email,
        username=user_in.username,
        hashed_password=security.get_password_hash(user_in.password),
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(deps.get_db)):
    # Authenticate user
    result = await db.execute(select(User).where(User.email == form_data.username)) # OAuth2 form uses 'username' field for email
    user = result.scalars().first()
    
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
        
    access_token_expires = timedelta(minutes=security.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = security.create_access_token(
        data={"sub": user.email}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

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
