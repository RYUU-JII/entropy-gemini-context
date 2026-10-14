#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${1:-/home/ryuji/projects/Entropy}"
if [[ ! -d "$ROOT_DIR" ]]; then
  echo "Invalid ROOT_DIR: $ROOT_DIR"
  exit 1
fi

title="$(tmux display-message -p -t "${TMUX_PANE:?}" "#{pane_title}")"
session_name="$(tmux display-message -p -t "${TMUX_PANE:?}" "#{session_name}")"
worker_slot="$(tmux display-message -p -t "${TMUX_PANE:?}" "#{@cx_worker_slot}" 2>/dev/null || true)"
worker_key=""
if [[ "$worker_slot" =~ ^[0-9]+$ ]]; then
  worker_key="worker${worker_slot}"
fi
PERSONA_REGISTRY_PATH="${CX_PERSONA_REGISTRY_PATH:-$ROOT_DIR/.orchestra/personas.json}"

run_codex_resume() {
  local thread="$1"
  local effort="$2"
  local keepalive="${CX_PANE_KEEPALIVE:-1}"
  local no_alt_screen="${CX_CODEX_NO_ALT_SCREEN:-1}"
  local codex_extra_flags=""
  cd "$ROOT_DIR"
  if [[ "$no_alt_screen" == "1" ]]; then
    codex_extra_flags="--no-alt-screen"
  fi
  if [[ "$keepalive" != "1" ]]; then
    exec bash -lc "
      cd \"$ROOT_DIR\"
      set +e
      code=0
      codex -a never -s danger-full-access ${codex_extra_flags} resume \"$thread\" -m gpt-5.3-codex -c 'model_reasoning_effort=\"$effort\"'
      code=\$?
      if [[ \$code -ne 0 && \$code -ne 130 && \$code -ne 143 ]]; then
        codex -a never -s danger-full-access ${codex_extra_flags} -m gpt-5.3-codex -c 'model_reasoning_effort=\"$effort\"'
        code=\$?
      fi
      exit \$code
    "
  fi

  exec bash -lc "
    cd \"$ROOT_DIR\"
    set +e
    while true; do
      code=0
      codex -a never -s danger-full-access ${codex_extra_flags} resume \"$thread\" -m gpt-5.3-codex -c 'model_reasoning_effort=\"$effort\"'
      code=\$?
      if [[ \$code -ne 0 && \$code -ne 130 && \$code -ne 143 ]]; then
        codex -a never -s danger-full-access ${codex_extra_flags} -m gpt-5.3-codex -c 'model_reasoning_effort=\"$effort\"'
        code=\$?
      fi
      if [[ \$code -eq 0 || \$code -eq 130 || \$code -eq 143 ]]; then
        break
      fi
      echo \"[cx] codex exited (\$code). restarting in 1s...\"
      sleep 1
    done
  "
}

resolve_persona_binding() {
  local pane_title="$1"
  local registry="$PERSONA_REGISTRY_PATH"
  [[ -f "$registry" ]] || return 1
  node - "$registry" "$pane_title" <<'NODE'
const fs = require('fs');

const registryPath = process.argv[2];
const paneTitle = process.argv[3];

try {
  const raw = fs.readFileSync(registryPath, 'utf8');
  const parsed = JSON.parse(raw);
  const personas = Array.isArray(parsed.personas) ? parsed.personas : [];
  const match = personas.find((item) => item && item.pane === paneTitle && item.enabled !== false);
  if (!match || typeof match.session !== 'string' || match.session.trim() === '') {
    process.exit(1);
  }
  const session = match.session.trim();
  const effort = typeof match.effort === 'string' && match.effort ? match.effort : 'high';
  process.stdout.write(`${session}\t${effort}`);
} catch {
  process.exit(1);
}
NODE
}

default_thread_for_key() {
  local key="$1"
  case "$key" in
    main) echo "메인" ;;
    worker1|agent1) echo "${session_name}-worker1" ;;
    worker2|agent2) echo "${session_name}-worker2" ;;
    worker3|agent3) echo "${session_name}-worker3" ;;
    orch) echo "${session_name}-orch" ;;
    merge) echo "${session_name}-merge-quality" ;;
    *) echo "" ;;
  esac
}

default_effort_for_key() {
  local key="$1"
  case "$key" in
    merge) echo "xhigh" ;;
    main|orch) echo "high" ;;
    worker*|agent*) echo "high" ;;
    *) echo "high" ;;
  esac
}

if [[ "$title" == "dev" || "$title" == "git" ]]; then
  cd "$ROOT_DIR"
  exec bash -i
fi

persona_key="$title"
if [[ -n "$worker_key" ]]; then
  persona_key="$worker_key"
fi

# Workers should stay shell-idle by default; queue dispatch controls job execution lifecycle.
if [[ "$persona_key" == worker* || "$persona_key" == agent* ]]; then
  cd "$ROOT_DIR"
  exec bash -i
fi

if [[ "$persona_key" == "main" || "$persona_key" == "orch" || "$persona_key" == "merge" ]]; then
  if binding="$(resolve_persona_binding "$persona_key")"; then
    IFS=$'\t' read -r thread effort <<< "$binding"
    run_codex_resume "$thread" "$effort"
  fi
  thread="$(default_thread_for_key "$persona_key")"
  effort="$(default_effort_for_key "$persona_key")"
  if [[ -n "$thread" ]]; then
    run_codex_resume "$thread" "$effort"
  fi
fi

cd "$ROOT_DIR"
exec bash -i
