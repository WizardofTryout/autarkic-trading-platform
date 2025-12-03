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

class UserDocument(Base):
    __tablename__ = "user_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(String, nullable=False) # Markdown content
    doc_type = Column(String, default="research_report") # research_report, strategy_note, etc.
    tags = Column(JSONB, default=[]) # e.g. ["BTC/USDT", "Bullish"]
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="documents")

    user = relationship("User", back_populates="documents")

class PaperAccount(Base):
    __tablename__ = "paper_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    balance = Column(Numeric(precision=20, scale=8), default=0)
    currency = Column(String, default="USDT")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    user = relationship("User", back_populates="paper_account")
    positions = relationship("PaperPosition", back_populates="account", cascade="all, delete-orphan")
    orders = relationship("PaperOrder", back_populates="account", cascade="all, delete-orphan")
    trades = relationship("PaperTrade", back_populates="account", cascade="all, delete-orphan")


class PaperPosition(Base):
    __tablename__ = "paper_positions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("paper_accounts.id"), nullable=False)
    symbol = Column(String, nullable=False)
    side = Column(String, nullable=False) # LONG or SHORT
    size = Column(Numeric(precision=20, scale=8), default=0)
    entry_price = Column(Numeric(precision=20, scale=8), default=0)
    leverage = Column(Integer, default=1)
    liquidation_price = Column(Numeric(precision=20, scale=8), nullable=True)
    stop_loss = Column(Numeric(precision=20, scale=8), nullable=True)
    take_profit = Column(Numeric(precision=20, scale=8), nullable=True)
    margin = Column(Numeric(precision=20, scale=8), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    account = relationship("PaperAccount", back_populates="positions")


class PaperOrder(Base):
    __tablename__ = "paper_orders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("paper_accounts.id"), nullable=False)
    symbol = Column(String, nullable=False)
    side = Column(String, nullable=False) # BUY or SELL
    type = Column(String, nullable=False) # MARKET or LIMIT
    price = Column(Numeric(precision=20, scale=8), nullable=True) # For Limit orders
    stop_loss = Column(Numeric(precision=20, scale=8), nullable=True)
    take_profit = Column(Numeric(precision=20, scale=8), nullable=True)
    amount = Column(Numeric(precision=20, scale=8), nullable=False) # In Quote Currency (USDT) usually, or Base? Let's say Size in Base Asset for simplicity, or Amount in USDT. Let's stick to Size (Base Asset) or Amount (Quote). For simplicity in UI we used USDT amount. Let's store size (BTC) and filled_size.
    # Actually, UI sends USDT amount. We should convert to size.
    quantity = Column(Numeric(precision=20, scale=8), nullable=False) # Base asset quantity (e.g. 0.1 BTC)
    filled_quantity = Column(Numeric(precision=20, scale=8), default=0)
    status = Column(String, default="OPEN") # OPEN, FILLED, CANCELLED
    leverage = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    account = relationship("PaperAccount", back_populates="orders")
    trades = relationship("PaperTrade", back_populates="order")


class PaperTrade(Base):
    __tablename__ = "paper_trades"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("paper_accounts.id"), nullable=False)
    order_id = Column(UUID(as_uuid=True), ForeignKey("paper_orders.id"), nullable=False)
    symbol = Column(String, nullable=False)
    side = Column(String, nullable=False) # BUY or SELL
    price = Column(Numeric(precision=20, scale=8), nullable=False)
    quantity = Column(Numeric(precision=20, scale=8), nullable=False)
    fee = Column(Numeric(precision=20, scale=8), default=0)
    fee_currency = Column(String, default="USDT")
    realized_pnl = Column(Numeric(precision=20, scale=8), default=0)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    account = relationship("PaperAccount", back_populates="trades")
    order = relationship("PaperOrder", back_populates="trades")

# Update User relationship
User.secrets = relationship("UserSecret", back_populates="user", cascade="all, delete-orphan")
User.documents = relationship("UserDocument", back_populates="user", cascade="all, delete-orphan")
User.paper_account = relationship("PaperAccount", back_populates="user", uselist=False, cascade="all, delete-orphan")
