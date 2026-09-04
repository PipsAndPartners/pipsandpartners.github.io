"""Encrypt/decrypt per-user Apify tokens at rest (Fernet, key from env)."""

import os

from cryptography.fernet import Fernet


def _fernet() -> Fernet:
    key = os.environ.get("TOKEN_ENC_KEY")
    if not key:
        raise RuntimeError(
            "Missing TOKEN_ENC_KEY environment variable. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
        )
    return Fernet(key.encode())


def encrypt_token(token: str) -> str:
    return _fernet().encrypt(token.encode()).decode()


def decrypt_token(ciphertext: str) -> str:
    return _fernet().decrypt(ciphertext.encode()).decode()
