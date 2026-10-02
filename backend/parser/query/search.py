#!/usr/bin/env python3
"""
Search Function - Vector search in LanceDB (JSON output for Node.js Integration)
"""
import sys
import json
from typing import List, Dict
from core.vector_encoder import VectorEncoder
from core.vector_store import VectorStore


class SearchEngine:
    def __init__(self, db_path: str = "../../data/vector_db/"):
        self.encoder = VectorEncoder()
        self.store = VectorStore(db_path=db_path)
    
    def search(self, query: str, top_k: int = 3) -> List[Dict]:
        """Convert question to vector and search database"""
        query_vector = self.encoder.encode_single(query)
        results = self.store.search(query_vector.tolist(), top_k=top_k)
        return results


def search_documents(query: str, top_k: int = 3, db_path: str = "../../data/vector_db/") -> List[Dict]:
    engine = SearchEngine(db_path=db_path)
    return engine.search(query, top_k)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Query parameter required"}))
        sys.exit(1)

    query_text = sys.argv[1]
    top_k_val = int(sys.argv[2]) if len(sys.argv) > 2 else 3

    try:
        raw_results = search_documents(query_text, top_k=top_k_val)
        formatted_results = []
        for item in raw_results:
            formatted_results.append({
                "document_name": item.get("document_name", "Unknown"),
                "page": item.get("page", 0),
                "text": item.get("text", ""),
                "score": float(item.get("score", item.get("_distance", 0.0)))
            })
        print(json.dumps({"success": True, "results": formatted_results}, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))