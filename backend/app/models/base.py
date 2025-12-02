from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, LargeBinary, Numeric, Integer, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True))
    preferences = Column(JSONB, default={})

    vault_keys = relationship("VaultKey", back_populates="user")
    strategies = relationship("Strategy", back_populates="user")


class VaultKey(Base):
    __tablename__ = "vault_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    exchange = Column(String, nullable=False)
    ciphertext = Column(LargeBinary, nullable=False)
    nonce = Column(LargeBinary, nullable=False)
    key_metadata = Column(JSONB, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_rotated_at = Column(DateTime(timezone=True))

    user = relationship("User", back_populates="vault_keys")


class Strategy(Base):
    __tablename__ = "strategies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    source_code = Column(String, nullable=False) # Pine-like DSL
    compiled_artifact = Column(LargeBinary) # Executable
    parameters = Column(JSONB, default={})
    status = Column(String, default="draft") # draft, testing, active, disabled
    is_favorite = Column(Boolean, default=False)
    category = Column(String, default="Personal")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="strategies")


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    prev_hash = Column(String(64), nullable=False)
    payload = Column(JSONB, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    signer_id = Column(UUID(as_uuid=True), nullable=False)
    hash = Column(String(64), unique=True, nullable=False)

class UserSecret(Base):
    __tablename__ = "user_api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    key_name = Column(String, nullable=False) # e.g. "My Gemini Key"
    provider = Column(String, nullable=False, default="gemini") # gemini, openai, anthropic, ollama, binance, bitget
    model = Column(String, nullable=True) # e.g. "gemini-1.5-pro", "claude-3-opus", "llama3"
    encrypted_value = Column(String, nullable=False)
    is_valid = Column(Boolean, default=False)
    last_validated = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="secrets")

# Update User relationship
User.secrets = relationship("UserSecret", back_populates="user", cascade="all, delete-orphan")
