#!/usr/bin/env python3
"""
PDF Vectorization Tool
Usage: python run.py <pdf_file_path>
"""
import os
import sys
from pipeline import process_pdf_file


def find_pdf_file(filename):
    """Find PDF file in data_raw/ or current directory"""
    if os.path.exists(filename):
        return filename

    data_raw_path = os.path.join('./data_raw', filename)
    if os.path.exists(data_raw_path):
        return data_raw_path

    if os.path.exists('./' + filename):
        return './' + filename

    return None


def main():
    if len(sys.argv) < 2:
        print("=" * 60)
        print("PDF Vectorization Tool")
        print("=" * 60)
        print("\nUsage:")
        print("  python run.py <pdf_file_path>")
        print("\nExamples:")
        print("  python run.py Report_bridNet.pdf")
        print("  python run.py ./data_raw/test.pdf")
        print("  python run.py /path/to/your/document.pdf")
        print("\nOptions:")
        print("  --chunk_size     Chunk size in characters (default: 500)")
        print("  --overlap        Overlap size in characters (default: 50)")
        print("  --original_name  Display name stored in DB (default: basename)")
        print("  --kb_table       LanceDB table name (default: env KB_TABLE or kb_1)")
        sys.exit(1)

    file_path = sys.argv[1]

    actual_path = find_pdf_file(file_path)

    if not actual_path:
        print(f"Error: File not found: {file_path}")
        print(f"\nSearched in:")
        print(f"  - {file_path}")
        print(f"  - ./data_raw/{file_path}")
        print(f"  - ./{file_path}")
        sys.exit(1)

    if not actual_path.lower().endswith('.pdf'):
        print(f"Error: Not a PDF file: {actual_path}")
        sys.exit(1)

    chunk_size = 500
    overlap = 50
    original_name = None
    kb_table = None

    i = 2
    while i < len(sys.argv):
        if sys.argv[i] == '--chunk_size' and i + 1 < len(sys.argv):
            chunk_size = int(sys.argv[i + 1]); i += 2
        elif sys.argv[i] == '--overlap' and i + 1 < len(sys.argv):
            overlap = int(sys.argv[i + 1]); i += 2
        elif sys.argv[i] == '--original_name' and i + 1 < len(sys.argv):
            original_name = sys.argv[i + 1]; i += 2
        elif sys.argv[i] == '--kb_table' and i + 1 < len(sys.argv):
            kb_table = sys.argv[i + 1]; i += 2
        else:
            i += 1

    # Prefer CLI --kb_table; otherwise VectorStore falls back to env KB_TABLE / kb_1
    if kb_table:
        os.environ["KB_TABLE"] = kb_table

    print("=" * 60)
    print("PDF Vectorization")
    print("=" * 60)
    print(f"  File: {actual_path}")
    print(f"  Size: {os.path.getsize(actual_path) / 1024:.1f} KB")
    print(f"  Chunk size: {chunk_size}")
    print(f"  Overlap: {overlap}")
    print(f"  Display name: {original_name or os.path.basename(actual_path)}")
    print(f"  KB table: {kb_table or os.environ.get('KB_TABLE', 'kb_1')}")
    print("=" * 60)

    try:
        result = process_pdf_file(
            file_path=actual_path,
            chunk_size=chunk_size,
            overlap=overlap,
            table_name=kb_table,
            original_name=original_name,
        )

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

    except Exception as e:
        print(f"\nError: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()