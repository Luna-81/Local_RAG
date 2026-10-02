"""Reduce the dimension of the chunks of a book and perform clustering, then transform it into a knowledge point distribution map."""
import json
import os
import re
import argparse
from pathlib import Path

import numpy as np
import lancedb
from sklearn.cluster import KMeans

try:
    from umap import UMAP
    HAS_UMAP = True
except ImportError:
    HAS_UMAP = False

from query.generate import generate_answer

# ── path ─────────────────────────────────────────────
PARSER_DIR  = Path(__file__).resolve().parent
PROJECT_DIR = PARSER_DIR.parents[1]              # ~/576project
VECTOR_DB   = PROJECT_DIR / "data" / "vector_db"

# Multi-KB: table name from env, default to the initial KB table
TABLE_NAME  = os.environ.get("KB_TABLE", "kb_1")

# Cache is namespaced per KB to avoid filename collisions across KBs
CACHE_DIR   = PROJECT_DIR / "data" / "knowledge_maps" / TABLE_NAME
CACHE_DIR.mkdir(parents=True, exist_ok=True)

DOC_FIELD   = "document_name"

# ── LLM prompt ───────────────────────────────────────
PROMPT = """You are a knowledge extraction assistant.
Below are several text chunks from the same document that share a topic.
Extract the key knowledge point of this topic. Respond with STRICT JSON only
(no markdown, no explanation):
{{"label": "topic name (<=8 words)", "content": "80-200 word summary"}}

Chunks:
{chunks}"""


def load_chunks(doc_name: str):
    """按 document_name 从 LanceDB 取该书的全部 chunk。"""
    db = lancedb.connect(str(VECTOR_DB))

    try:
        tbl = db.open_table(TABLE_NAME)
    except Exception:
        return [], np.zeros((0, 0), dtype="float32")

    df = tbl.to_pandas()
    df = df[df[DOC_FIELD] == doc_name].reset_index(drop=True)
    if df.empty:
        return [], np.zeros((0, 0), dtype="float32")

    vectors = np.stack(df["vector"].values).astype("float32")
    records = [
        {
            "id": row["id"],
            "text": row["text"],
            "page": int(row["page"]),
            "chunk_index": int(row["chunk_index"]),
        }
        for _, row in df.iterrows()
    ]
    return records, vectors


def reduce_2d(X: np.ndarray) -> np.ndarray:
    n = len(X)
    if n < 3:
        return np.zeros((n, 2), dtype="float32")
    if HAS_UMAP and n >= 10:
        return UMAP(
            n_components=2,
            n_neighbors=min(15, n - 1),
            min_dist=0.15,
            random_state=42,
        ).fit_transform(X)
    Xc = X - X.mean(axis=0)
    U, S, _ = np.linalg.svd(Xc, full_matrices=False)
    return (U[:, :2] * S[:2]).astype("float32")


def normalize(coords: np.ndarray) -> np.ndarray:
    coords = coords - coords.min(axis=0)
    rng = coords.max(axis=0) - coords.min(axis=0)
    rng[rng == 0] = 1
    coords = coords / rng * 0.88 + 0.06
    coords += np.random.default_rng(0).normal(0, 0.006, coords.shape)
    return coords


def _parse_json(text: str) -> dict:
    if not text:
        return {}
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return {}
    try:
        return json.loads(m.group(0))
    except Exception:
        return {}


def build_map(doc_name: str) -> dict:
    chunks, vectors = load_chunks(doc_name)
    n = len(chunks)
    if n == 0:
        return {"doc_name": doc_name, "points": [], "clusters": []}

    k = max(2, min(int(round(n ** 0.5)), 12, n))
    labels = KMeans(n_clusters=k, n_init="auto", random_state=42).fit_predict(vectors)
    coords = normalize(reduce_2d(vectors))

    points = [
        {
            "x": float(coords[i, 0]),
            "y": float(coords[i, 1]),
            "cluster": int(labels[i]),
            "page": chunks[i]["page"],
            "preview": chunks[i]["text"][:120],
        }
        for i in range(n)
    ]

    clusters = []
    for lb in sorted(set(labels.tolist())):
        idx = [i for i in range(n) if labels[i] == lb]
        merged = "\n---\n".join(chunks[i]["text"] for i in idx)[:3000]
        info = _parse_json(generate_answer(PROMPT.format(chunks=merged)))
        clusters.append({
            "id": int(lb),
            "x": float(np.mean([coords[i, 0] for i in idx])),
            "y": float(np.mean([coords[i, 1] for i in idx])),
            "label": info.get("label") or f"Topic {lb + 1}",
            "content": info.get("content", ""),
            "chunk_count": len(idx),
            "pages": sorted({chunks[i]["page"] for i in idx}),
            "chunk_ids": [chunks[i]["id"] for i in idx],
        })

    return {"doc_name": doc_name, "points": points, "clusters": clusters}


def cache_file(doc_name: str) -> Path:
    safe = re.sub(r"[^\w.\-]", "_", doc_name)
    return CACHE_DIR / f"{safe}.json"


def list_documents():
    """List all unique document names in the current KB table, sorted by chunk count in descending order."""
    db = lancedb.connect(str(VECTOR_DB))

    try:
        df = db.open_table(TABLE_NAME).to_pandas()
    except Exception:
        return []

    if df.empty:
        return []

    grouped = (
        df.groupby(DOC_FIELD)
          .size()
          .reset_index(name="chunk_count")
          .sort_values("chunk_count", ascending=False)
    )
    return grouped.to_dict("records")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--doc", help="document_name")
    ap.add_argument("--list", action="store_true", help="list all documents")
    args = ap.parse_args()

    if args.list:
        print(json.dumps({"ok": True, "documents": list_documents()}))
    elif args.doc:
        result = build_map(args.doc)
        cache_file(args.doc).write_text(
            json.dumps(result, ensure_ascii=False), encoding="utf-8"
        )
        print(json.dumps({
            "ok": True, "doc": args.doc,
            "points": len(result["points"]),
            "clusters": len(result["clusters"]),
        }))
    else:
        ap.error("either --doc or --list is required")