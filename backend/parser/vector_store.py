#!/usr/bin/env python3
"""
Vector Store - LanceDB vector database operations

Multi-KB support: table name is passed via the KB_TABLE environment variable.
Each knowledge base maps to one physical LanceDB table at
data/vector_db/<table_name>.lance, providing physical isolation.
Falls back to "kb_1" when unspecified.
"""
import json
import os
import re
import uuid
import sys
from typing import List, Dict, Any
import lancedb
import pyarrow as pa
import numpy as np

# Resolve project root dynamically (576project/data/vector_db)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "data", "vector_db")

# Default table name — must match the initial KB created in backend/config/db.js
DEFAULT_TABLE_NAME = "kb_1"

# Table name validation: alphanumerics and underscore only
_TABLE_NAME_RE = re.compile(r"^[A-Za-z0-9_]+$")


def _resolve_table_name(explicit: str = None) -> str:
    """Priority: explicit arg > KB_TABLE env var > default"""
    name = explicit or os.environ.get("KB_TABLE") or DEFAULT_TABLE_NAME
    if not _TABLE_NAME_RE.match(name):
        raise ValueError(
            f"Invalid KB table name: {name!r}. Only [A-Za-z0-9_] allowed."
        )
    return name


class VectorStore:
    def __init__(
        self,
        db_path: str = DEFAULT_DB_PATH,
        embedding_dim: int = 512,
        table_name: str = None,
    ):
        self.db_path = db_path
        self.db = lancedb.connect(db_path)
        self.embedding_dim = embedding_dim
        self.table_name = _resolve_table_name(table_name)

        self._init_table()

    def _init_table(self):
        schema = pa.schema([
            pa.field("id", pa.string()),
            pa.field("document_name", pa.string()),
            pa.field("page", pa.int32()),
            pa.field("chunk_index", pa.int32()),
            pa.field("text", pa.string()),
            pa.field("vector", pa.list_(pa.float32(), self.embedding_dim)),
            pa.field("metadata", pa.string())
        ])

        if self.table_name not in self.db.table_names():
            self.db.create_table(self.table_name, schema=schema)
            print(f"Created LanceDB table: {self.table_name}", file=sys.stderr)

        self.table = self.db.open_table(self.table_name)

    def insert(self, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0

        prepared_records = []
        for record in records:
            if "id" not in record:
                record["id"] = str(uuid.uuid4())

            if "metadata" in record and isinstance(record["metadata"], dict):
                record["metadata"] = json.dumps(record["metadata"])

            if "vector" in record and isinstance(record["vector"], np.ndarray):
                record["vector"] = record["vector"].tolist()

            prepared_records.append(record)

        self.table.add(prepared_records)
        print(f"Added {len(prepared_records)} records to [{self.table_name}]", file=sys.stderr)

        try:
            if hasattr(self.table, '_dataset') and self.table._dataset:
                self.table._dataset.checkpoint()
                print("Checkpoint completed", file=sys.stderr)
            else:
                _ = self.table.to_pandas()
                print("Triggered read to flush cache", file=sys.stderr)
        except Exception as e:
            print(f"Commit warning: {e}", file=sys.stderr)

        row_count = len(self.table)
        print(f"Table [{self.table_name}] now has {row_count} records", file=sys.stderr)

        return len(prepared_records)

    def search(self, query_vector: List[float], top_k: int = 5) -> List[Dict]:
        try:
            results = self.table.search(
                query_vector,
                vector_column_name="vector"
            ).limit(top_k).to_list()
            return results
        except Exception as e:
            print(f"Search error in [{self.table_name}]: {e}", file=sys.stderr)
            return []

    def search_by_text(self, text: str, encoder, top_k: int = 5) -> List[Dict]:
        query_vector = encoder.encode_single(text)
        return self.search(query_vector.tolist(), top_k)

    def get_all(self) -> List[Dict]:
        return self.table.to_pandas().to_dict('records')

    def get_by_document(self, document_name: str) -> List[Dict]:
        df = self.table.to_pandas()
        return df[df["document_name"] == document_name].to_dict('records')

    def delete_by_document(self, document_name: str) -> int:
        df = self.table.to_pandas()
        df_filtered = df[df["document_name"] != document_name]

        self.db.drop_table(self.table_name)
        self._init_table()

        if not df_filtered.empty:
            records = df_filtered.to_dict('records')
            self.table.add(records)

        return len(df) - len(df_filtered)

    def count(self) -> int:
        return len(self.table)

    def clear(self):
        self.db.drop_table(self.table_name)
        self._init_table()

    def get_stats(self) -> Dict:
        return {
            "total_records": self.count(),
            "table_name": self.table_name,
            "db_path": self.db_path,
            "embedding_dim": self.embedding_dim
        }


def create_store(db_path: str = DEFAULT_DB_PATH, table_name: str = None) -> VectorStore:
    return VectorStore(db_path, table_name=table_name)


if __name__ == "__main__":
    store = VectorStore()
    print(json.dumps(store.get_stats(), ensure_ascii=False))