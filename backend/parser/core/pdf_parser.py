#!/usr/bin/env python3
"""
PDF Parser - Extract text from PDF files using pypdf.PdfReader
"""
import os
from typing import List, Dict
from pypdf import PdfReader


class PDFParser:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.reader = None
        self._load_pdf()

    def _load_pdf(self):
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"PDF file not found: {self.file_path}")
        self.reader = PdfReader(self.file_path)

    def extract_text(self, include_page_numbers: bool = True) -> str:
        all_text = []
        for page_num, page in enumerate(self.reader.pages, 1):
            try:
                text = page.extract_text()
                if text and text.strip():
                    if include_page_numbers:
                        all_text.append(f"--- Page {page_num} ---")
                    all_text.append(text.strip())
            except Exception as e:
                print(f"Warning: Failed to extract page {page_num}: {e}")
        return "\n\n".join(all_text)

    def extract_pages(self) -> List[Dict]:
        pages = []
        for page_num, page in enumerate(self.reader.pages, 1):
            try:
                text = page.extract_text()
                pages.append({
                    "page": page_num,
                    "text": text.strip() if text else "",
                    "has_text": bool(text and text.strip())
                })
            except Exception as e:
                pages.append({
                    "page": page_num,
                    "text": "",
                    "has_text": False,
                    "error": str(e)
                })
        return pages

    def get_metadata(self) -> Dict:
        meta = self.reader.metadata or {}
        return {
            "title": meta.get("/Title", ""),
            "author": meta.get("/Author", ""),
            "subject": meta.get("/Subject", ""),
            "creator": meta.get("/Creator", ""),
            "producer": meta.get("/Producer", ""),
            "creation_date": str(meta.get("/CreationDate", "")),
            "modification_date": str(meta.get("/ModDate", "")),
        }

    def get_page_count(self) -> int:
        return len(self.reader.pages)


def parse_pdf(file_path: str) -> str:
    parser = PDFParser(file_path)
    return parser.extract_text()


def parse_pdf_with_metadata(file_path: str) -> Dict:
    parser = PDFParser(file_path)
    return {
        "text": parser.extract_text(),
        "pages": parser.get_page_count(),
        "metadata": parser.get_metadata(),
        "page_texts": parser.extract_pages()
    }
