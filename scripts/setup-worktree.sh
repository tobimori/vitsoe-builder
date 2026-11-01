#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile

main="$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")"

if [[ "$main" != "$(pwd -P)" && -d "$main/docs" && ! -e docs ]]; then
  ln -s "$main/docs" docs
fi
