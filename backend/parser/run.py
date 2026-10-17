#!/usr/bin/env python3
"""Command-line interface for indexing a PDF into LanceDB."""

import argparse
import os
import sys
import traceback
from pathlib import Path
from typing import Optional, Sequence

from core.pipeline import process_pdf_file


def find_pdf_file(filename: str) -> Optional[Path]:
    """Find a PDF in the supplied location or the parser's data_raw directory."""
    requested_path = Path(filename).expanduser()
    candidates = (requested_path, Path("data_raw") / requested_path)
    return next((candidate for candidate in candidates if candidate.is_file()), None)


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Extract and index a PDF document.")
    parser.add_argument("pdf_file", help="PDF path, or a filename under data_raw/")
    parser.add_argument(
        "--chunk_size", type=int, default=500, help="Chunk size in characters"
    )
    parser.add_argument(
        "--overlap", type=int, default=50, help="Chunk overlap in characters"
    )
    parser.add_argument(
        "--original_name", help="Display name stored in the vector database"
    )
    parser.add_argument(
        "--kb_table", help="LanceDB table name; defaults to KB_TABLE or kb_1"
    )
    return parser


def print_run_summary(file_path: Path, args: argparse.Namespace) -> None:
    print("=" * 60)
    print("PDF Vectorization")
    print("=" * 60)
    print(f"  File: {file_path}")
    print(f"  Size: {file_path.stat().st_size / 1024:.1f} KB")
    print(f"  Chunk size: {args.chunk_size}")
    print(f"  Overlap: {args.overlap}")
    print(f"  Display name: {args.original_name or file_path.name}")
    print(f"  KB table: {args.kb_table or os.environ.get('KB_TABLE', 'kb_1')}")
    print("=" * 60)


def print_process_result(result: dict) -> None:
    print("\n" + "=" * 60)
    print("SUCCESS!")
    print("=" * 60)
    print(f"  Document:        {result['document_name']}")
    print(f"  Pages:           {result['total_pages']}")
    print(f"  Chunks:          {result['total_chunks']}")
    print(f"  Records stored:  {result['records_inserted']}")
    print(f"  Vector dim:      {result['vector_dim']}")
    print(f"  Text length:     {result['text_length']} chars")
    print("=" * 60)


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_argument_parser()
    args = parser.parse_args(argv)
    file_path = find_pdf_file(args.pdf_file)
    if file_path is None:
        parser.error(f"PDF file not found: {args.pdf_file}")
    if file_path.suffix.lower() != ".pdf":
        parser.error(f"Not a PDF file: {file_path}")
    if args.chunk_size <= 0 or args.overlap < 0 or args.overlap >= args.chunk_size:
        parser.error(
            "chunk_size must be positive and overlap must be between zero and chunk_size"
        )

    if args.kb_table:
        os.environ["KB_TABLE"] = args.kb_table

    print_run_summary(file_path, args)
    try:
        result = process_pdf_file(
            file_path=str(file_path),
            chunk_size=args.chunk_size,
            overlap=args.overlap,
            table_name=args.kb_table,
            original_name=args.original_name,
        )
        print_process_result(result)
        return 0
    except Exception as error:
        print(f"\nError: {error}", file=sys.stderr)
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())
