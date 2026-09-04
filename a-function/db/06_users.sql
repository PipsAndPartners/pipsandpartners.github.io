-- ============================================================================
-- Web console login + per-user Apify token.
-- apify_token_encrypted: Fernet ciphertext (web/crypto_utils.py), never plaintext.
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_users (
    user_id                 BIGSERIAL PRIMARY KEY,
    username                TEXT NOT NULL UNIQUE,
    password_hash           TEXT NOT NULL,
    apify_token_encrypted   TEXT NOT NULL,
    is_admin                BOOLEAN NOT NULL DEFAULT false,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
