#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
BUILD=$(mktemp -d)
trap 'rm -rf "$BUILD"' EXIT HUP INT TERM
if [ -x "$ROOT/frontend/node_modules/.bin/tsc" ]; then TSC="$ROOT/frontend/node_modules/.bin/tsc"; else TSC=tsc; fi
"$TSC" --target ES2020 --module commonjs --strict --skipLibCheck --outDir "$BUILD" \
  "$ROOT/frontend/src/components/CommandCenter/graphModel.ts" \
  "$ROOT/frontend/src/components/CommandCenter/executionProtocol.ts"
MC_CORE_BUILD="$BUILD" node --test "$ROOT/tests/test_graph_core.cjs"
