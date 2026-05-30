#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

mkdir -p \
  "${SCRIPT_DIR}/data/mysql" \
  "${SCRIPT_DIR}/data/minio" \
  "${SCRIPT_DIR}/data/server" \
  "${SCRIPT_DIR}/server/assets" \
  "${SCRIPT_DIR}/server/modelPrompt" \
  "${SCRIPT_DIR}/server/models" \
  "${SCRIPT_DIR}/server/oss" \
  "${SCRIPT_DIR}/server/serve" \
  "${SCRIPT_DIR}/server/skills" \
  "${SCRIPT_DIR}/server/vendor" \
  "${SCRIPT_DIR}/www/app" \
  "${SCRIPT_DIR}/www/admin"

"${SCRIPT_DIR}/load-images.sh"

cd "${SCRIPT_DIR}"
docker compose up -d
