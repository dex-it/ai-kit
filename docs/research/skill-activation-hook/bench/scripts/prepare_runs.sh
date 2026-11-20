#!/usr/bin/env bash
# Готовит копии песочницы под прогоны: prepare_runs.sh <каталог прогонов> <id>...
# Каждый сабагент правит свою копию, исходная cart/ не меняется.
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
out=$1; shift
for id in "$@"; do
  rm -rf "$out/$id"
  mkdir -p "$out/$id"
  cp -r "$here/cart" "$out/$id/cart"
done
