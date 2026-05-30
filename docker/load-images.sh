#!/bin/sh
set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
IMAGE_DIR="${SCRIPT_DIR}/images"

if ! ls "${IMAGE_DIR}"/*.tar >/dev/null 2>&1; then
  echo "No image tar files found in ${IMAGE_DIR}" >&2
  exit 1
fi

for image_tar in "${IMAGE_DIR}"/*.tar; do
  echo "Loading ${image_tar}"
  docker load -i "${image_tar}"
done
