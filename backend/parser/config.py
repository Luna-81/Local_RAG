"""Shared runtime paths and model settings for the Python parser."""

import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def project_path(variable: str, default: Path) -> Path:
    """Resolve a configured path against the project root when it is relative."""
    configured = Path(os.environ.get(variable, str(default))).expanduser()
    return configured if configured.is_absolute() else PROJECT_ROOT / configured


DATA_DIR = project_path("APP_DATA_DIR", PROJECT_ROOT / "data")
VECTOR_DB_PATH = project_path("LANCEDB_PATH", DATA_DIR / "vector_db")
KNOWLEDGE_MAP_CACHE_DIR = project_path(
    "KNOWLEDGE_MAP_CACHE_DIR", DATA_DIR / "knowledge_maps"
)
LLAMA_API_URL = os.environ.get(
    "LLAMA_API_URL", "http://127.0.0.1:8080/v1/chat/completions"
)
LLM_REQUEST_TIMEOUT_SECONDS = int(os.environ.get("LLM_REQUEST_TIMEOUT_SECONDS", "180"))
