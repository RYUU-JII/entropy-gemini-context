#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-}"
PERSONA_SESSION="${2:-}"
EFFORT="${3:-high}"
JOB_ID="${4:-}"
JOB_FILE="${5:-}"
RESULT_FILE="${6:-}"
CONTEXT_MODE="${7:-${CX_QUEUE_CONTEXT_MODE:-fresh}}"
LOG_DIR=""
RUN_LOG=""
HEARTBEAT_SEC="${CX_QUEUE_HEARTBEAT_SEC:-8}"

if [[ -z "$ROOT_DIR" || -z "$PERSONA_SESSION" || -z "$JOB_ID" || -z "$JOB_FILE" || -z "$RESULT_FILE" ]]; then
  echo "Usage: cx_queue_worker_exec.sh <root_dir> <persona_session> <effort> <job_id> <job_file> <result_file> [fresh|resume]" >&2
  exit 2
fi

if [[ "$EFFORT" != "xhigh" ]]; then
  EFFORT="high"
fi
if [[ "$CONTEXT_MODE" != "resume" ]]; then
  CONTEXT_MODE="fresh"
fi
if ! [[ "$HEARTBEAT_SEC" =~ ^[0-9]+$ ]] || [[ "$HEARTBEAT_SEC" -lt 1 ]]; then
  HEARTBEAT_SEC=8
fi

mkdir -p "$(dirname "$RESULT_FILE")"
LOG_DIR="$ROOT_DIR/.cxflow/pool/logs"
mkdir -p "$LOG_DIR"
RUN_LOG="$LOG_DIR/${JOB_ID}.log"
cd "$ROOT_DIR"

write_blocked_result() {
  local reason="$1"
  cat > "$RESULT_FILE" <<EOF
status: BLOCKED

summary: $reason
files: none
blocker: $reason
EOF
}

has_valid_completion_status_marker() {
  node - "$RESULT_FILE" <<'NODE'
const fs = require('fs');
const file = process.argv[2];
const raw = fs.readFileSync(file, 'utf8');
const lines = String(raw).split(/\r?\n/);
let firstNonEmpty = '';
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  firstNonEmpty = trimmed;
  break;
}
const firstMatch = firstNonEmpty.match(/^status\s*:\s*(DONE|BLOCKED)$/i);
if (!firstMatch) process.exit(1);
const markerCount = lines.reduce((count, line) => (
  /^status\s*:\s*(DONE|BLOCKED)$/i.test(line.trim()) ? count + 1 : count
), 0);
if (markerCount !== 1) process.exit(1);
process.exit(0);
NODE
}

PROMPT_TEXT="$(cat <<__CX_QUEUE_PROMPT__
Job ID: $JOB_ID
Persona Session: $PERSONA_SESSION
Effort: $EFFORT
Context Mode: $CONTEXT_MODE

Read this job file first:
- $JOB_FILE

Do the requested work in the repository as needed.
Do NOT run shell commands to write the report file directly.
Your final response will be captured automatically into:
- $RESULT_FILE

Required first line:
status: DONE
or
status: BLOCKED

Keep report concise. Max 8 lines after status.
Use exactly these fields:
summary: one or two sentences
files: comma-separated changed paths, or "none"
blocker: "none" when DONE, otherwise one-line reason
__CX_QUEUE_PROMPT__
)"

run_agent_once() {
  if [[ "$CONTEXT_MODE" == "resume" ]]; then
    printf '%s' "$PROMPT_TEXT" \
      | codex exec resume \
        --dangerously-bypass-approvals-and-sandbox \
        -o "$RESULT_FILE" \
        -m gpt-5.3-codex \
        -c "model_reasoning_effort=\"$EFFORT\"" \
        "$PERSONA_SESSION" - \
        >"$RUN_LOG" 2>&1
    return $?
  fi

  printf '%s' "$PROMPT_TEXT" \
    | codex -a never -s danger-full-access exec -o "$RESULT_FILE" - \
      -m gpt-5.3-codex \
      -c "model_reasoning_effort=\"$EFFORT\"" \
      >"$RUN_LOG" 2>&1
}

run_with_heartbeat() {
  local start_ts now_ts elapsed exec_pid rc
  start_ts="$(date +%s)"
  echo "[$JOB_ID][$PERSONA_SESSION] started (effort=$EFFORT mode=$CONTEXT_MODE)"
  (
    run_agent_once
  ) &
  exec_pid=$!

  while kill -0 "$exec_pid" 2>/dev/null; do
    now_ts="$(date +%s)"
    elapsed=$((now_ts - start_ts))
    echo "[$JOB_ID][$PERSONA_SESSION] running ${elapsed}s (log: $RUN_LOG)"
    sleep "$HEARTBEAT_SEC"
  done

  if wait "$exec_pid"; then
    now_ts="$(date +%s)"
    elapsed=$((now_ts - start_ts))
    echo "[$JOB_ID][$PERSONA_SESSION] completed in ${elapsed}s"
    return 0
  fi

  rc=$?
  now_ts="$(date +%s)"
  elapsed=$((now_ts - start_ts))
  echo "[$JOB_ID][$PERSONA_SESSION] failed rc=$rc after ${elapsed}s (log: $RUN_LOG)"
  return "$rc"
}

if run_with_heartbeat; then
  :
else
  rc=$?
  write_blocked_result "codex execution failed (exit=$rc)"
  exit "$rc"
fi

if ! has_valid_completion_status_marker; then
  write_blocked_result "Missing or invalid required first-line status marker."
fi
