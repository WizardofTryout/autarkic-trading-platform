from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordRequestForm
from datetime import timedelta
from jose import jwt

from app.services.vault import VaultService
from app.api import deps
from app.core import security
from app.models.base import User
from app.schemas.user import UserCreate, UserResponse, Token, UserPasswordChange

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
    return {"access_token": access_token, "token_type": "bearer", "user": user}

@router.post("/password-change")
async def change_password(
    password_in: UserPasswordChange,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    if not security.verify_password(password_in.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    
    current_user.hashed_password = security.get_password_hash(password_in.new_password)
    db.add(current_user)
    await db.commit()
    return {"message": "Password updated successfully"}

    return {"message": "Password updated successfully"}

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

@router.post("/password-reset-request")
async def request_password_reset(
    request: PasswordResetRequest,
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(select(User).where(User.email == request.email))
    user = result.scalars().first()
    if user:
        # Generate a reset token (valid for 15 mins)
        reset_token = security.create_access_token(
            data={"sub": user.email, "type": "reset"},
            expires_delta=timedelta(minutes=15)
        )
        # Mock sending email - In production, use an email service
        print(f"------------ PASSWORD RESET TOKEN FOR {user.email} ------------")
        print(f"Token: {reset_token}")
        print("---------------------------------------------------------------")
        return {"message": "Password reset email sent (check console for token)"}
    
    # Always return success to prevent email enumeration
    return {"message": "Password reset email sent (check console for token)"}

@router.post("/password-reset-confirm")
async def confirm_password_reset(
    request: PasswordResetConfirm,
    db: AsyncSession = Depends(deps.get_db)
):
    try:
        payload = jwt.decode(
            request.token, security.SECRET_KEY, algorithms=[security.ALGORITHM]
        )
        email = payload.get("sub")
        token_type = payload.get("type")
        if not email or token_type != "reset":
            raise HTTPException(status_code=400, detail="Invalid token")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = security.get_password_hash(request.new_password)
    db.add(user)
    await db.commit()
    return {"message": "Password reset successfully"}

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
