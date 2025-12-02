from cryptography.fernet import Fernet
from app.core.config import settings
import base64

# Ensure SECRET_KEY is 32 bytes url-safe base64-encoded for Fernet
# If settings.SECRET_KEY is just a string, we might need to derive a key or pad it.
# For simplicity in this dev environment, we'll derive a key or use a fixed one if the secret is short.
# In production, SECRET_KEY should be a proper Fernet key.

def get_fernet():
    key = settings.SECRET_KEY
    # Pad or truncate to 32 bytes for compatibility if needed, 
    # but best practice is to provide a valid 32-byte base64 key.
    # Here we'll just hash it to get 32 bytes and base64 encode it to ensure validity.
    import hashlib
    key_bytes = hashlib.sha256(key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(key_bytes)
    return Fernet(fernet_key)

def encrypt_value(value: str) -> str:
    f = get_fernet()
    return f.encrypt(value.encode()).decode()

def decrypt_value(encrypted_value: str) -> str:
    f = get_fernet()
    return f.decrypt(encrypted_value.encode()).decode()
