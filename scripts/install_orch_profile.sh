#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROFILE_SRC="$ROOT_DIR/.orchestra/profiles/en-orch.sh"
PROFILE_DIR="${CX_CONFIG_DIR:-$HOME/.config/cx/profiles}"
PROFILE_DST="$PROFILE_DIR/en.sh"

mkdir -p "$PROFILE_DIR"
cp "$PROFILE_SRC" "$PROFILE_DST"

echo "Installed profile: $PROFILE_DST"
echo "Next: ./cx up en --detached && ./cx status en"
