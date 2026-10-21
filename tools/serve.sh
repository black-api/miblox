#!/usr/bin/env bash
# Preview the web layer in a desktop browser (the app is designed for 390x844).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8099}"
echo "MIBLOX preview: http://127.0.0.1:$PORT/index.html"
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$ROOT/www"
