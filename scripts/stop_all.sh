#!/usr/bin/env bash
# Stop only service process groups created by start_all.sh for this user.
set -uo pipefail

RUNTIME_DIR="${XDG_RUNTIME_DIR:-${TMPDIR:-/tmp}}/576project-${UID}"
stopped=0

for service in frontend backend llama; do
  pid_file="$RUNTIME_DIR/$service.pid"
  [[ -f "$pid_file" ]] || continue
  pid="$(cat "$pid_file")"
  if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
    # start_all.sh uses setsid, so the leader PID is also the process-group ID.
    if [[ "$(ps -o pgid= -p "$pid" | tr -d ' ')" == "$pid" ]]; then
      kill -TERM -- "-$pid" 2>/dev/null || true
      for _ in {1..30}; do
        kill -0 "$pid" 2>/dev/null || break
        sleep 0.2
      done
      if kill -0 "$pid" 2>/dev/null; then kill -KILL -- "-$pid" 2>/dev/null || true; fi
      echo "$service stopped (PID $pid)"
      stopped=1
    else
      echo "Leaving $service untouched: PID $pid is no longer its original process group." >&2
    fi
  else
    echo "$service was not running"
  fi
  rm -f -- "$pid_file"
done

(( stopped )) || echo "No managed services were running."
