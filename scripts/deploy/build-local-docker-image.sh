#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." >/dev/null 2>&1 && pwd)"
DOCKER_DIR="${ROOT_DIR}/docker"
IMAGE_DIR="${DOCKER_DIR}/images"
LOG_FILE="${SCRIPT_DIR}/build-local-docker-image.log"

TAG="${TAG:-latest}"
SAFE_TAG="$(printf '%s' "${TAG}" | tr '/:' '__')"
SERVER_IMAGE="drama-studio-server:${TAG}"
APP_IMAGE="drama-studio-app:${TAG}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.0}"
MINIO_IMAGE="${MINIO_IMAGE:-minio/minio:latest}"
AUTOHEAL_IMAGE="${AUTOHEAL_IMAGE:-docker:27-cli}"
INCLUDE_MYSQL_IMAGE="${INCLUDE_MYSQL_IMAGE:-1}"
INCLUDE_MINIO_IMAGE="${INCLUDE_MINIO_IMAGE:-1}"
INCLUDE_AUTOHEAL_IMAGE="${INCLUDE_AUTOHEAL_IMAGE:-1}"

log() {
  printf '[drama-studio-docker] %s\n' "$*" | tee -a "${LOG_FILE}"
}

run() {
  log "$*"
  "$@" 2>&1 | tee -a "${LOG_FILE}"
}

copy_app_static_assets() {
  local container_id
  container_id="$(docker create "${APP_IMAGE}")"
  trap 'docker rm -f "${container_id}" >/dev/null 2>&1 || true' RETURN

  rm -rf "${DOCKER_DIR}/www/app" "${DOCKER_DIR}/www/admin"
  mkdir -p "${DOCKER_DIR}/www/app" "${DOCKER_DIR}/www/admin"

  run docker cp "${container_id}:/opt/drama-studio/static/app/." "${DOCKER_DIR}/www/app/"
  run docker cp "${container_id}:/opt/drama-studio/static/admin/." "${DOCKER_DIR}/www/admin/"
}

copy_server_static_assets() {
  local container_id
  local static_dir
  container_id="$(docker create "${SERVER_IMAGE}")"
  trap 'docker rm -f "${container_id}" >/dev/null 2>&1 || true' RETURN

  rm -rf \
    "${DOCKER_DIR}/server/assets" \
    "${DOCKER_DIR}/server/modelPrompt" \
    "${DOCKER_DIR}/server/models" \
    "${DOCKER_DIR}/server/oss" \
    "${DOCKER_DIR}/server/serve" \
    "${DOCKER_DIR}/server/skills" \
    "${DOCKER_DIR}/server/vendor"

  for static_dir in assets modelPrompt models oss skills vendor; do
    mkdir -p "${DOCKER_DIR}/server/${static_dir}"
    if docker cp "${container_id}:/opt/drama-studio/server-data/${static_dir}/." "${DOCKER_DIR}/server/${static_dir}/" 2>>"${LOG_FILE}"; then
      log "docker cp ${container_id}:/opt/drama-studio/server-data/${static_dir}/. ${DOCKER_DIR}/server/${static_dir}/"
    else
      log "skip missing server static dir: ${static_dir}"
    fi
  done

  mkdir -p "${DOCKER_DIR}/server/serve"
  run docker cp "${container_id}:/opt/drama-studio/server-serve/." "${DOCKER_DIR}/server/serve/"
}

prepare_release_dir() {
  mkdir -p "${IMAGE_DIR}" "${DOCKER_DIR}/data/minio" "${DOCKER_DIR}/server" "${DOCKER_DIR}/www"
  cp "${ROOT_DIR}/apps/server/data/mysql-init.sql" "${DOCKER_DIR}/data/mysql-init.sql"
  cat >"${DOCKER_DIR}/.env" <<EOF
DRAMA_STUDIO_VERSION=${TAG}
MYSQL_IMAGE=${MYSQL_IMAGE}
MINIO_IMAGE=${MINIO_IMAGE}
AUTOHEAL_IMAGE=${AUTOHEAL_IMAGE}
EOF
}

save_images() {
  rm -f \
    "${IMAGE_DIR}/drama-studio-server-"*.tar \
    "${IMAGE_DIR}/drama-studio-app-"*.tar \
    "${IMAGE_DIR}/"*"-server-"*.tar \
    "${IMAGE_DIR}/"*"-app-"*.tar \
    "${IMAGE_DIR}/minio_"*.tar \
    "${IMAGE_DIR}/docker_"*.tar
  run docker save -o "${IMAGE_DIR}/drama-studio-server-${SAFE_TAG}.tar" "${SERVER_IMAGE}"
  run docker save -o "${IMAGE_DIR}/drama-studio-app-${SAFE_TAG}.tar" "${APP_IMAGE}"

  if [[ "${INCLUDE_MYSQL_IMAGE}" == "1" ]]; then
    local mysql_file
    mysql_file="$(printf '%s' "${MYSQL_IMAGE}" | tr '/:' '__')"
    run docker pull "${MYSQL_IMAGE}"
    run docker save -o "${IMAGE_DIR}/${mysql_file}.tar" "${MYSQL_IMAGE}"
  fi

  if [[ "${INCLUDE_MINIO_IMAGE}" == "1" ]]; then
    local minio_file
    minio_file="$(printf '%s' "${MINIO_IMAGE}" | tr '/:' '__')"
    run docker pull "${MINIO_IMAGE}"
    run docker save -o "${IMAGE_DIR}/${minio_file}.tar" "${MINIO_IMAGE}"
  fi

  if [[ "${INCLUDE_AUTOHEAL_IMAGE}" == "1" ]]; then
    local autoheal_file
    autoheal_file="$(printf '%s' "${AUTOHEAL_IMAGE}" | tr '/:' '__')"
    run docker pull "${AUTOHEAL_IMAGE}"
    run docker save -o "${IMAGE_DIR}/${autoheal_file}.tar" "${AUTOHEAL_IMAGE}"
  fi
}

: >"${LOG_FILE}"
log "release dir: ${DOCKER_DIR}"
prepare_release_dir

run docker build "${ROOT_DIR}" --target server -t "${SERVER_IMAGE}"
run docker build "${ROOT_DIR}" --target app -t "${APP_IMAGE}"
copy_server_static_assets
copy_app_static_assets
save_images

log "release package is ready"
log "upload '${DOCKER_DIR}' to the server, then run: cd docker && ./up.sh"
