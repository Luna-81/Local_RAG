#!/usr/bin/env python3
import sys
import os
import json
import lancedb

# 基于当前文件动态定位项目根目录 (576project/data/vector_db)
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
            tables_info.append({
                "name": name,
                "vector_count": count
            })

        result = {
            "storage_directory": os.path.relpath(DB_PATH, BASE_DIR),
            "total_tables": len(table_names),
            "total_vectors": total_vectors,
            "tables": tables_info
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
                "message": f"Table '{table_name}' dropped successfully."
            }
        else:
            result = {
                "success": False,
                "message": f"Table '{table_name}' does not exist."
            }
        print(json.dumps(result))
    except Exception as e:
        sys.stderr.write(f"Error dropping table '{table_name}': {str(e)}\n")
        sys.exit(1)

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
    else:
        sys.stderr.write(f"Unknown command: {command}\n")
        sys.exit(1)