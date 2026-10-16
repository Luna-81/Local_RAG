#!/usr/bin/env python3
"""
Vector Encoder - Using BGE model via sentence-transformers
"""
import os

# Optional offline mode: set EMBED_OFFLINE=1 to force local cache only.
if os.environ.get("EMBED_OFFLINE") == "1":
    os.environ.setdefault("HF_HUB_OFFLINE", "1")
    os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")

import warnings
from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

warnings.filterwarnings("ignore")


class VectorEncoder:
    def __init__(self, model_name: str = "BAAI/bge-small-zh-v1.5", use_fp16: bool = True):
        print(f"Loading embedding model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_embedding_dimension()
        print(f"✅ Model loaded. Dimension: {self.dimension}")

    def encode(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.array([])

        print(f"Encoding {len(texts)} text chunks...")
        return self.model.encode(texts, convert_to_numpy=True, normalize_embeddings=True)

    def encode_single(self, text: str) -> np.ndarray:
        return self.encode([text])[0]


def encode_texts(texts: List[str], model_name: str = "BAAI/bge-small-zh-v1.5") -> np.ndarray:
    encoder = VectorEncoder(model_name)
    return encoder.encode(texts)
