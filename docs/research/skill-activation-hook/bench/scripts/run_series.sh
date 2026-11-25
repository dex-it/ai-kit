#!/usr/bin/env bash
# Серия S1-S4 по 3 прогона, по 4 параллельно: run_series.sh <каталог прогонов> <кит> [модель]
# SETTINGS и EFFORT передаются в run_headless.sh.
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
runs=$1; kit=$2; model=${3:-sonnet}
mkdir -p "$runs"
printf '%s\n' S1-1 S1-2 S1-3 S2-1 S2-2 S2-3 S3-1 S3-2 S3-3 S4-1 S4-2 S4-3 \
  | xargs -P 4 -I{} "$here/run_headless.sh" "$runs" {} "$kit" "$model"
python3 "$here/headless_report.py" "$runs"
