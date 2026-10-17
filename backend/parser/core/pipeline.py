#!/usr/bin/env python3
"""
Pipeline - Orchestrate the entire PDF processing workflow
"""

import os
from typing import Any, Dict, List, Tuple

from core.pdf_parser import PDFParser
from core.text_chunker import TextChunker
from core.vector_encoder import VectorEncoder
from core.vector_store import VectorStore
from config import VECTOR_DB_PATH

DEFAULT_DB_PATH = str(VECTOR_DB_PATH)


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

        full_text, pages, metadata = self._extract_document(file_path)
        if not full_text.strip():
            raise ValueError(f"PDF contains no extractable text: {file_path}")

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
        document_name = self.original_name or os.path.basename(file_path)
        records = self._build_records(chunks, vectors, pages, metadata, document_name)

        inserted = self.store.insert(records)
        print(f"  - Inserted: {inserted} records")
        print("-" * 50)

        return {
            "document_name": document_name,
            "total_pages": len(pages),
            "total_chunks": len(chunks),
            "records_inserted": inserted,
            "text_length": len(full_text),
            "vector_dim": vectors.shape[1],
        }

    @staticmethod
    def _extract_document(file_path: str) -> Tuple[str, List[Dict], Dict]:
        print("Step 1: Parsing PDF...")
        parser = PDFParser(file_path)
        pages = parser.extract_pages()
        full_text = "\n\n".join(page["text"] for page in pages if page["has_text"])
        return (
            full_text,
            pages,
            parser.get_metadata(),
        )

    def _build_records(
        self,
        chunks: List[Dict],
        vectors: Any,
        pages: List[Dict],
        metadata: Dict,
        document_name: str,
    ) -> List[Dict]:
        """Combine chunk, vector, page, and PDF metadata at the storage boundary."""
        records = []
        for index, (chunk, vector) in enumerate(zip(chunks, vectors)):
            records.append(
                {
                    "document_name": document_name,
                    "page": self._get_page_for_chunk(chunk, pages, index),
                    "chunk_index": index,
                    "text": chunk["text"],
                    "vector": vector.tolist(),
                    "metadata": {
                        "title": metadata.get("title", ""),
                        "author": metadata.get("author", ""),
                        "total_pages": len(pages),
                        "chunk_index": index,
                        "char_count": chunk["char_count"],
                        "word_count": chunk["word_count"],
                    },
                }
            )
        return records

    def _get_page_for_chunk(
        self, chunk_info: Dict, pages: List[Dict], chunk_index: int
    ) -> int:
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


def search_pdf_content(
    query: str, db_path: str = DEFAULT_DB_PATH, top_k: int = 5
) -> List[Dict]:
    pipeline = PDFPipeline(db_path=db_path)
    return pipeline.search(query, top_k)
