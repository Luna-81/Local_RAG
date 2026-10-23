#!/usr/bin/env bash
# Start the local model server, API, and React development server.
set -Eeuo pipefail

PROJECT_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/backend/.env"
RUNTIME_DIR="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/576project-${UID}"
mkdir -p "$RUNTIME_DIR"

# Read simple KEY=value entries without executing the environment file.
env_value() {
  local key="$1" value
  value="$(sed -n "s/^${key}=//p" "$ENV_FILE" 2>/dev/null | tail -n 1)"
  value="${value%$'\r'}"
  if [[ "$value" == \"*\" ]]; then value="${value#\"}"; value="${value%\"}"; fi
  if [[ "$value" == \'*\' ]]; then value="${value#\'}"; value="${value%\'}"; fi
  printf '%s' "$value"
}

configured() { local value; value="$(env_value "$1")"; printf '%s' "${value:-$2}"; }
LLAMA_SERVER="$(configured LLAMA_SERVER_BIN 3rdparty/llama.cpp/build/bin/llama-server)"
MODEL_PATH="$(configured LLAMA_MODEL_PATH data/models/gemma-2-2b-it-q4_k_m.gguf)"
LLAMA_HOST="$(configured LLAMA_HOST 127.0.0.1)"
LLAMA_PORT="$(configured LLAMA_PORT 8080)"
LLAMA_GPU_LAYERS="$(configured LLAMA_GPU_LAYERS 99)"
LLAMA_DEVICE="$(env_value LLAMA_DEVICE)"
API_PORT="$(configured API_PORT 3000)"
FRONTEND_PORT="$(configured FRONTEND_PORT 3001)"

[[ "$LLAMA_SERVER" = /* ]] || LLAMA_SERVER="$PROJECT_ROOT/$LLAMA_SERVER"
[[ "$MODEL_PATH" = /* ]] || MODEL_PATH="$PROJECT_ROOT/$MODEL_PATH"
[[ -x "$LLAMA_SERVER" ]] || { echo "llama-server not executable: $LLAMA_SERVER" >&2; exit 1; }
[[ -f "$MODEL_PATH" ]] || { echo "Model file not found: $MODEL_PATH" >&2; exit 1; }

for service in llama backend frontend; do
  pid_file="$RUNTIME_DIR/$service.pid"
  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo "$service already appears to be running (PID $(cat "$pid_file")). Stop it first." >&2
    exit 1
  fi
done

start_service() {
  local name="$1" log_file="$RUNTIME_DIR/$1.log"
  shift
  setsid "$@" >"$log_file" 2>&1 < /dev/null &
  echo "$!" > "$RUNTIME_DIR/$name.pid"
  echo "$name started (PID $!, log: $log_file)"
}

llama_args=("$LLAMA_SERVER" -m "$MODEL_PATH" --host "$LLAMA_HOST" --port "$LLAMA_PORT" -ngl "$LLAMA_GPU_LAYERS")
if [[ -n "$LLAMA_DEVICE" ]]; then llama_args+=(--device "$LLAMA_DEVICE"); fi
start_service llama "${llama_args[@]}"
start_service backend env "API_PORT=$API_PORT" npm --prefix "$PROJECT_ROOT/backend" start
start_service frontend env "PORT=$FRONTEND_PORT" npm --prefix "$PROJECT_ROOT/frontend" start

echo "Services are starting. Logs and PID files: $RUNTIME_DIR"
