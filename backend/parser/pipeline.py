#!/usr/bin/env python3
"""
Pipeline - Orchestrate the entire PDF processing workflow
"""
import os
from typing import Dict, List, Any

from pdf_parser import PDFParser
from text_chunker import TextChunker
from vector_encoder import VectorEncoder
from vector_store import VectorStore

# Resolve project root dynamically (576project/data/vector_db)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DEFAULT_DB_PATH = os.path.join(BASE_DIR, "data", "vector_db")


class PDFPipeline:
    def __init__(
        self,
        db_path: str = DEFAULT_DB_PATH,
        model_name: str = "BAAI/bge-small-zh-v1.5",
        chunk_size: int = 500,
        overlap: int = 50,
        chunk_method: str = "paragraph",
        table_name: str = None,
        original_name: str = None,
    ):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.chunk_method = chunk_method
        self.original_name = original_name

        self.encoder = VectorEncoder(model_name)
        self.store = VectorStore(db_path, self.encoder.dimension, table_name=table_name)
        self.chunker = TextChunker(chunk_size, overlap)

    def process(self, file_path: str) -> Dict[str, Any]:
        print(f"\nProcessing file: {os.path.basename(file_path)}")
        print("-" * 50)

        print("Step 1: Parsing PDF...")
        parser = PDFParser(file_path)
        full_text = parser.extract_text(include_page_numbers=False)
        pages = parser.extract_pages()
        metadata = parser.get_metadata()

        print(f"  - Pages: {len(pages)}")
        print(f"  - Text length: {len(full_text)} characters")

        print("Step 2: Chunking text...")
        chunks = self.chunker.chunk_text(full_text, method=self.chunk_method)
        chunk_texts = [c["text"] for c in chunks]

        print(f"  - Chunks: {len(chunks)}")
        print(f"  - Method: {self.chunk_method}")

        print("Step 3: Encoding vectors...")
        vectors = self.encoder.encode(chunk_texts)
        print(f"  - Vector dimension: {vectors.shape[1]}")

        print("Step 4: Storing in LanceDB...")
        # Prefer the caller-provided display name; fall back to stored filename
        document_name = self.original_name or os.path.basename(file_path)

        records = []
        for i, (chunk_info, vector) in enumerate(zip(chunks, vectors)):
            records.append({
                "document_name": document_name,
                "page": self._get_page_for_chunk(chunk_info, pages, i),
                "chunk_index": i,
                "text": chunk_info["text"],
                "vector": vector.tolist(),
                "metadata": {
                    "title": metadata.get("title", ""),
                    "author": metadata.get("author", ""),
                    "total_pages": len(pages),
                    "chunk_index": i,
                    "char_count": chunk_info["char_count"],
                    "word_count": chunk_info["word_count"]
                }
            })

        inserted = self.store.insert(records)
        print(f"  - Inserted: {inserted} records")
        print("-" * 50)

        return {
            "document_name": document_name,
            "total_pages": len(pages),
            "total_chunks": len(chunks),
            "records_inserted": inserted,
            "text_length": len(full_text),
            "vector_dim": vectors.shape[1]
        }

    def _get_page_for_chunk(self, chunk_info: Dict, pages: List[Dict], chunk_index: int) -> int:
        total_chunks = chunk_info["total_chunks"]
        total_pages = len(pages)

        if total_pages == 0:
            return 0

        page_idx = (chunk_index * total_pages) // total_chunks
        return min(page_idx + 1, total_pages)

    def search(self, query: str, top_k: int = 5) -> List[Dict]:
        print(f"\nSearching: {query[:50]}...")
        results = self.store.search_by_text(query, self.encoder, top_k)
        return results

    def get_stats(self) -> Dict:
        return self.store.get_stats()


def process_pdf_file(
    file_path: str,
    db_path: str = DEFAULT_DB_PATH,
    chunk_size: int = 500,
    overlap: int = 50,
    table_name: str = None,
    original_name: str = None,
) -> Dict:
    pipeline = PDFPipeline(
        db_path=db_path,
        chunk_size=chunk_size,
        overlap=overlap,
        table_name=table_name,
        original_name=original_name,
    )
    return pipeline.process(file_path)


def search_pdf_content(query: str, db_path: str = DEFAULT_DB_PATH, top_k: int = 5) -> List[Dict]:
    pipeline = PDFPipeline(db_path=db_path)
    return pipeline.search(query, top_k)