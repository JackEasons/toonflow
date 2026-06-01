#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." >/dev/null 2>&1 && pwd)"
DOCKER_DIR="${ROOT_DIR}/docker"
IMAGE_DIR="${DOCKER_DIR}/images"
LOG_FILE="${SCRIPT_DIR}/build-local-docker-image.log"

TAG="${TAG:-latest}"
TARGET_PLATFORM="${TARGET_PLATFORM:-linux/amd64}"
SAFE_TAG="$(printf '%s' "${TAG}" | tr '/:' '__')"
SERVER_IMAGE="drama-studio-t-server:${TAG}"
APP_IMAGE="drama-studio-t-app:${TAG}"
MYSQL_IMAGE="${MYSQL_IMAGE:-mysql:8.0}"
MINIO_IMAGE="${MINIO_IMAGE:-minio/minio:latest}"
AUTOHEAL_IMAGE="${AUTOHEAL_IMAGE:-docker:27-cli}"
INCLUDE_MYSQL_IMAGE="${INCLUDE_MYSQL_IMAGE:-1}"
INCLUDE_MINIO_IMAGE="${INCLUDE_MINIO_IMAGE:-1}"
INCLUDE_AUTOHEAL_IMAGE="${INCLUDE_AUTOHEAL_IMAGE:-1}"

log() {
  printf '[drama-studio-t-docker] %s\n' "$*" | tee -a "${LOG_FILE}"
}

run() {
  log "$*"
  "$@" 2>&1 | tee -a "${LOG_FILE}"
}

ensure_image() {
  local image="$1"
  local actual_platform

  actual_platform="$(
    docker image inspect --format '{{.Os}}/{{.Architecture}}{{if .Variant}}/{{.Variant}}{{end}}' "${image}" 2>/dev/null | head -n 1 || true
  )"

  if [[ "${actual_platform}" == "${TARGET_PLATFORM}" ]]; then
    log "reuse local image: ${image} (${actual_platform})"
  else
    if [[ -n "${actual_platform}" ]]; then
      log "replace local image: ${image} (${actual_platform} -> ${TARGET_PLATFORM})"
    fi
    run docker pull --platform "${TARGET_PLATFORM}" "${image}"
  fi
}

copy_app_static_assets() {
  local container_id
  container_id="$(docker create --platform "${TARGET_PLATFORM}" "${APP_IMAGE}")"
  trap 'docker rm -f "${container_id}" >/dev/null 2>&1 || true' RETURN

  rm -rf "${DOCKER_DIR}/www/app" "${DOCKER_DIR}/www/admin"
  mkdir -p "${DOCKER_DIR}/www/app" "${DOCKER_DIR}/www/admin"

  run docker cp "${container_id}:/opt/drama-studio-t/static/app/." "${DOCKER_DIR}/www/app/"
  run docker cp "${container_id}:/opt/drama-studio-t/static/admin/." "${DOCKER_DIR}/www/admin/"
}

copy_server_static_assets() {
  local container_id
  local static_dir
  container_id="$(docker create --platform "${TARGET_PLATFORM}" "${SERVER_IMAGE}")"
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
    if docker cp "${container_id}:/opt/drama-studio-t/server-data/${static_dir}/." "${DOCKER_DIR}/server/${static_dir}/" 2>>"${LOG_FILE}"; then
      log "docker cp ${container_id}:/opt/drama-studio-t/server-data/${static_dir}/. ${DOCKER_DIR}/server/${static_dir}/"
    else
      log "skip missing server static dir: ${static_dir}"
    fi
  done

  mkdir -p "${DOCKER_DIR}/server/serve"
  run docker cp "${container_id}:/opt/drama-studio-t/server-serve/." "${DOCKER_DIR}/server/serve/"
}

prepare_release_dir() {
  mkdir -p "${IMAGE_DIR}" "${DOCKER_DIR}/data/minio" "${DOCKER_DIR}/server" "${DOCKER_DIR}/www"
  cp "${ROOT_DIR}/apps/server/data/mysql-init.sql" "${DOCKER_DIR}/data/mysql-init.sql"
  cat >"${DOCKER_DIR}/.env" <<EOF
DRAMA_STUDIO_T_VERSION=${TAG}
DRAMA_STUDIO_T_PLATFORM=${TARGET_PLATFORM}
MYSQL_IMAGE=${MYSQL_IMAGE}
MINIO_IMAGE=${MINIO_IMAGE}
AUTOHEAL_IMAGE=${AUTOHEAL_IMAGE}
EOF
}

save_images() {
  rm -f \
    "${IMAGE_DIR}/drama-studio-t-server-"*.tar \
    "${IMAGE_DIR}/drama-studio-t-app-"*.tar \
    "${IMAGE_DIR}/"*"-server-"*.tar \
    "${IMAGE_DIR}/"*"-app-"*.tar \
    "${IMAGE_DIR}/mysql_"*.tar \
    "${IMAGE_DIR}/minio_"*.tar \
    "${IMAGE_DIR}/docker_"*.tar
  run docker save --platform "${TARGET_PLATFORM}" -o "${IMAGE_DIR}/drama-studio-t-server-${SAFE_TAG}.tar" "${SERVER_IMAGE}"
  run docker save --platform "${TARGET_PLATFORM}" -o "${IMAGE_DIR}/drama-studio-t-app-${SAFE_TAG}.tar" "${APP_IMAGE}"

  if [[ "${INCLUDE_MYSQL_IMAGE}" == "1" ]]; then
    local mysql_file
    mysql_file="$(printf '%s' "${MYSQL_IMAGE}" | tr '/:' '__')"
    ensure_image "${MYSQL_IMAGE}"
    run docker save --platform "${TARGET_PLATFORM}" -o "${IMAGE_DIR}/${mysql_file}.tar" "${MYSQL_IMAGE}"
  fi

  if [[ "${INCLUDE_MINIO_IMAGE}" == "1" ]]; then
    local minio_file
    minio_file="$(printf '%s' "${MINIO_IMAGE}" | tr '/:' '__')"
    ensure_image "${MINIO_IMAGE}"
    run docker save --platform "${TARGET_PLATFORM}" -o "${IMAGE_DIR}/${minio_file}.tar" "${MINIO_IMAGE}"
  fi

  if [[ "${INCLUDE_AUTOHEAL_IMAGE}" == "1" ]]; then
    local autoheal_file
    autoheal_file="$(printf '%s' "${AUTOHEAL_IMAGE}" | tr '/:' '__')"
    ensure_image "${AUTOHEAL_IMAGE}"
    run docker save --platform "${TARGET_PLATFORM}" -o "${IMAGE_DIR}/${autoheal_file}.tar" "${AUTOHEAL_IMAGE}"
  fi
}

: >"${LOG_FILE}"
log "release dir: ${DOCKER_DIR}"
log "target platform: ${TARGET_PLATFORM}"
prepare_release_dir

run docker build "${ROOT_DIR}" --platform "${TARGET_PLATFORM}" --target server -t "${SERVER_IMAGE}"
run docker build "${ROOT_DIR}" --platform "${TARGET_PLATFORM}" --target app -t "${APP_IMAGE}"
copy_server_static_assets
copy_app_static_assets
save_images

log "release package is ready"
log "upload '${DOCKER_DIR}' to the server, then run: cd docker && ./up.sh"
