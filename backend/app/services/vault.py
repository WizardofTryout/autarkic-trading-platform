import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.argon2 import Argon2id
from cryptography.hazmat.primitives import hashes
from typing import Tuple

class VaultService:
    def __init__(self):
        # In a real scenario, these parameters should be carefully tuned
        self.kdf = Argon2id(
            salt=None, # Salt must be provided per derivation or fixed system-wide (less secure)
            length=32,
            iterations=4,
            lanes=4,
            memory_cost=65536,
        )

    def derive_key(self, master_password: str, salt: bytes) -> bytes:
        """
        Derive a 32-byte key from the master password using Argon2id.
        """
        kdf = Argon2id(
            salt=salt,
            length=32,
            iterations=4,
            lanes=4,
            memory_cost=65536,
        )
        return kdf.derive(master_password.encode())

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

vault_service = VaultService()
