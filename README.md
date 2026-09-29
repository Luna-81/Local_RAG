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