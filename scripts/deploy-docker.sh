#!/usr/bin/env bash

set -eu

APP_DIR="${1:?Usage: deploy-docker.sh <app-directory> <image-reference>}"
IMAGE_REF="${2:?Usage: deploy-docker.sh <app-directory> <image-reference>}"
COMPOSE_FILE="${APP_DIR}/docker-compose.yml"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed on the deployment host." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required on the deployment host." >&2
  exit 1
fi

if [ -z "${GHCR_USERNAME:-}" ] || [ -z "${GHCR_TOKEN:-}" ]; then
  echo "GHCR_USERNAME and GHCR_TOKEN must be provided." >&2
  exit 1
fi

printf '%s' "${GHCR_TOKEN}" | docker login ghcr.io \
  --username "${GHCR_USERNAME}" \
  --password-stdin

cd "${APP_DIR}"
IMAGE_REF="${IMAGE_REF}" docker compose -f "${COMPOSE_FILE}" pull
IMAGE_REF="${IMAGE_REF}" docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans
docker image prune --force

echo "Deployed ${IMAGE_REF}"
