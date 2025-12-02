import os
import json
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from argon2.low_level import hash_secret_raw, Type
from typing import Tuple, Optional

VAULT_FILE = "/app/vault.dat"

class VaultService:
    def __init__(self):
        self._master_key: Optional[bytes] = None

    def derive_key(self, master_password: str, salt: bytes) -> bytes:
        """
        Derive a 32-byte key from the master password using Argon2id.
        """
        return hash_secret_raw(
            secret=master_password.encode(),
            salt=salt,
            time_cost=4,
            memory_cost=65536,
            parallelism=4,
            hash_len=32,
            type=Type.ID
        )

    def encrypt(self, plaintext: str, master_key: bytes) -> Tuple[bytes, bytes]:
        """
        Encrypt plaintext using AES-256-GCM.
        Returns (ciphertext, nonce).
        """
        aesgcm = AESGCM(master_key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), None)
        return ciphertext, nonce

    def decrypt(self, ciphertext: bytes, nonce: bytes, master_key: bytes) -> str:
        """
        Decrypt ciphertext using AES-256-GCM.
        """
        aesgcm = AESGCM(master_key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode()

    def is_initialized(self) -> bool:
        return os.path.exists(VAULT_FILE)

    def is_unlocked(self) -> bool:
        return self._master_key is not None

    def initialize(self, master_password: str):
        if self.is_initialized():
            raise Exception("Vault already initialized")
        
        salt = os.urandom(16)
        key = self.derive_key(master_password, salt)
        
        # Encrypt a verification string
        ciphertext, nonce = self.encrypt("VERIFIED", key)
        
        data = {
            "salt": salt.hex(),
            "nonce": nonce.hex(),
            "ciphertext": ciphertext.hex()
        }
        
        with open(VAULT_FILE, "w") as f:
            json.dump(data, f)
            
        self._master_key = key

    def unlock(self, master_password: str):
        if not self.is_initialized():
            raise Exception("Vault not initialized")
            
        with open(VAULT_FILE, "r") as f:
            data = json.load(f)
            
        salt = bytes.fromhex(data["salt"])
        nonce = bytes.fromhex(data["nonce"])
        ciphertext = bytes.fromhex(data["ciphertext"])
        
        key = self.derive_key(master_password, salt)
        
        try:
            plaintext = self.decrypt(ciphertext, nonce, key)
            if plaintext != "VERIFIED":
                raise Exception("Invalid password")
            self._master_key = key
        except Exception:
            raise Exception("Invalid password or corrupted vault")

vault_service = VaultService()
