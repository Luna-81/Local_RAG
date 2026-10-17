#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

javascript_files=()
while IFS= read -r source_file; do
    javascript_files+=("$source_file")
done < <(rg --files backend frontend/src -g '*.js')

for source_file in "${javascript_files[@]}"; do
    node --check "$source_file"
done
echo "JavaScript syntax OK: ${#javascript_files[@]} files"

python3 - <<'PY'
import ast
from pathlib import Path

roots = (Path("backend/parser"),)
files = [path for root in roots for path in root.rglob("*.py")]
for source_file in files:
    ast.parse(source_file.read_text(encoding="utf-8"), filename=str(source_file))
print(f"Python syntax OK: {len(files)} files")
PY

bash -n start_all.sh stop_all.sh xdp-helper.sh scripts/check_source.sh
echo "Shell syntax OK: 4 files"
