#!/bin/bash
set -e
PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")"
fail() { echo "$1"; if [ "${LUT_EXPLORER_NO_OPEN:-0}" != 1 ]; then read -r -p 'Press Return to close.' || true; fi; exit 1; }
if [ ! -x /usr/bin/perl ]; then fail 'This Mac launcher needs /usr/bin/perl to read recorded camera metadata.'; fi
if ! command -v node >/dev/null || ! command -v npm >/dev/null; then fail 'Install Node.js 22 or newer from https://nodejs.org, then open this launcher again.'; fi
if ! node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)'; then fail 'Update to Node.js 22 or newer, then open this launcher again.'; fi
if ! node -e 'for(const [name,version] of Object.entries(require("./package.json").dependencies)){if(JSON.parse(require("fs").readFileSync(require("path").join("node_modules",name,"package.json"))).version!==version)process.exit(1)}require("./src/media.cjs")' >/dev/null 2>&1; then
  echo 'Setting up the local video tools. This first run needs internet access.'
  if ! npm ci --no-audit --no-fund; then fail 'Setup did not finish. Check your internet connection and free disk space, then open the launcher again.'; fi
fi
lut_port="${LUT_EXPLORER_PORT:-53631}"
if ! [[ "$lut_port" =~ ^[0-9]+$ ]] || [ "$lut_port" -lt 1 ] || [ "$lut_port" -gt 65535 ]; then fail 'Choose a local port from 1 through 65535.'; fi
lut_url="http://127.0.0.1:$lut_port"
lut_expected="${LUT_EXPLORER_DATA:-$HOME/Documents/LUT Explorer Library}"
if node scripts/check-running.cjs "$lut_url" "$lut_expected"; then
  echo "LUT Buddy is already running: $lut_url"
  if [ "${LUT_EXPLORER_NO_OPEN:-0}" != 1 ]; then open "$lut_url"; fi
  exit 0
else
  lut_existing=$?
  if [ "$lut_existing" != 1 ]; then fail 'Your saved work is unchanged. Restart after closing the service described above.'; fi
fi
node src/server.cjs &
lut_pid=$!
cleanup() { kill "$lut_pid" 2>/dev/null || true; wait "$lut_pid" 2>/dev/null || true; }
trap cleanup EXIT
trap 'exit 0' INT TERM
lut_ready=0
for attempt in {1..50}; do
  if ! kill -0 "$lut_pid" 2>/dev/null; then wait "$lut_pid" || true; fail 'The local service did not start. Read its message above and try again.'; fi
  if node scripts/check-running.cjs "$lut_url" "$lut_expected" >/dev/null 2>&1; then lut_ready=1; break; fi
  sleep 0.2
done
if [ "$lut_ready" != 1 ]; then fail 'The local service did not become ready. Close this window and try again.'; fi
if [ "${LUT_EXPLORER_NO_OPEN:-0}" != 1 ]; then open "$lut_url"; fi
wait "$lut_pid"
