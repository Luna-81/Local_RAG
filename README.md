# Local_RAG

A local retrieval-augmented generation system for PDF question answering.

## Features
- Multi knowledge base with physical isolation
- PDF upload with SHA-256 content dedup
- Vector search powered by LanceDB
- Local LLM inference via llama.cpp
- Knowledge map visualization (UMAP + KMeans + LLM)
- XDP-based kernel-level protection

## Stack
- Backend: Node.js + Express + better-sqlite3
- Frontend: React
- Vector DB: LanceDB
- Embedding: BAAI/bge-small-zh-v1.5
- LLM: llama.cpp (gemma-2-2b)
## Authentication setup

Copy `backend/.env.example` to `backend/.env` and start the backend from the `backend` directory. Set `JWT_SECRET` to a cryptographically random value of at least 32 bytes (generate with `openssl rand -hex 32`). On a fresh database, set `INITIAL_ADMIN_PASSWORD` to a password with at least 12 characters and at most 72 bytes; the initial username is `admin`. No registration page is required: administrators create users.

Existing plaintext passwords are migrated to bcrypt on startup; existing JWTs become invalid. Existing administrator passwords are preserved, so change any old default password through user management. Tokens expire after one hour. Logout invalidates all sessions for that user; password and role changes also invalidate existing sessions. Keep the signing secret stable across restarts.
