# WORKER_CONTRACT.md

Worker result contract for queue jobs.

## Required Output Shape
First non-empty line must be exactly one:
- `status: DONE`
- `status: BLOCKED`

Then provide only these fields:
- `summary: ...`
- `files: ...`
- `blocker: ...`

## Field Rules
- `summary`: 1-2 sentences, concrete outcome only.
- `files`: comma-separated changed paths, or `none`.
- `blocker`: `none` when DONE; one-line actionable reason when BLOCKED.

## Size Rules
- Keep output short (target: <= 4 lines after `status`).
- No long narrative sections (`changed_files`, `decisions`, `risks`, `next_action`, etc.).

## Behavior Rules
- Do the task first, then report once.
- Do not stream progress through model messages for visibility.
- Runtime visibility is handled by shell heartbeat/logs, not verbose model text.
