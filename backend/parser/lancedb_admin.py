#!/usr/bin/env python3
import sys
import os
import json
import re
from pathlib import Path
import lancedb

# Resolve the project root relative to this file.
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "data", "vector_db")


def get_db():
    if not os.path.exists(DB_PATH):
        os.makedirs(DB_PATH, exist_ok=True)
    return lancedb.connect(DB_PATH)


def get_stats():
    try:
        db = get_db()
        table_names = db.table_names()

        tables_info = []
        total_vectors = 0

        for name in table_names:
            tbl = db.open_table(name)
            count = len(tbl)
            total_vectors += count
            tables_info.append({"name": name, "vector_count": count})

        result = {
            "storage_directory": os.path.relpath(DB_PATH, BASE_DIR),
            "total_tables": len(table_names),
            "total_vectors": total_vectors,
            "tables": tables_info,
        }
        print(json.dumps(result))
    except Exception as e:
        sys.stderr.write(f"Error fetching stats: {str(e)}\n")
        sys.exit(1)


def clear_table(table_name):
    try:
        db = get_db()
        table_names = db.table_names()

        if table_name in table_names:
            db.drop_table(table_name)
            result = {
                "success": True,
                "message": f"Table '{table_name}' dropped successfully.",
            }
        else:
            result = {
                "success": False,
                "message": f"Table '{table_name}' does not exist.",
            }
        print(json.dumps(result))
    except Exception as e:
        sys.stderr.write(f"Error dropping table '{table_name}': {str(e)}\n")
        sys.exit(1)


def delete_document(table_name, stored_name, original_name):
    """Remove a PDF's vectors, including records written by older importers."""
    if not re.fullmatch(r"[A-Za-z0-9_]+", table_name):
        raise ValueError("Invalid table name")

    db = get_db()
    names = {stored_name, original_name}
    if table_name in db.list_tables().tables:
        table = db.open_table(table_name)
        for name in names:
            # LanceDB uses SQL predicates; double apostrophes escape string values.
            table.delete("document_name = '" + name.replace("'", "''") + "'")

    cache_dir = Path(BASE_DIR) / "data" / "knowledge_maps" / table_name
    for name in names:
        cache_name = re.sub(r"[^\w.\-]", "_", name) + ".json"
        (cache_dir / cache_name).unlink(missing_ok=True)
    print(json.dumps({"success": True}))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: python3 lancedb_admin.py <stats|clear> [table_name]\n")
        sys.exit(1)

    command = sys.argv[1]

    if command == "stats":
        get_stats()
    elif command == "clear":
        if len(sys.argv) < 3:
            sys.stderr.write("Error: Table name required for 'clear' command.\n")
            sys.exit(1)
        clear_table(sys.argv[2])
    elif command == "delete-document":
        if len(sys.argv) != 5:
            sys.stderr.write(
                "Usage: lancedb_admin.py delete-document <table> <stored_name> <original_name>\n"
            )
            sys.exit(1)
        try:
            delete_document(sys.argv[2], sys.argv[3], sys.argv[4])
        except Exception as exc:
            sys.stderr.write(f"Error deleting document: {exc}\n")
            sys.exit(1)
    else:
        sys.stderr.write(f"Unknown command: {command}\n")
        sys.exit(1)
