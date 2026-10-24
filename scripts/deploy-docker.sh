#!/usr/bin/env bash

set -eu

APP_DIR="${1:?Usage: deploy-docker.sh <app-directory> <image-reference>}"
IMAGE_REF="${2:?Usage: deploy-docker.sh <app-directory> <image-reference>}"
COMPOSE_FILE="${APP_DIR}/docker-compose.yml"
HEALTH_URL="http://127.0.0.1:8080/actuator/health"
HEALTH_ATTEMPTS=30
HEALTH_INTERVAL_SECONDS=2

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed on the deployment host." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required on the deployment host." >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required on the deployment host for the deployment health check." >&2
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

healthy=false
for attempt in $(seq 1 "${HEALTH_ATTEMPTS}"); do
  if curl --fail --silent --show-error "${HEALTH_URL}" >/dev/null; then
    healthy=true
    break
  fi
  echo "Waiting for application health (${attempt}/${HEALTH_ATTEMPTS})..."
  sleep "${HEALTH_INTERVAL_SECONDS}"
done

if [ "${healthy}" != "true" ]; then
  echo "Application health check failed: ${HEALTH_URL}" >&2
  docker compose -f "${COMPOSE_FILE}" ps
  docker compose -f "${COMPOSE_FILE}" logs --tail 100 product-crud
  exit 1
fi

docker image prune --force

echo "Deployed ${IMAGE_REF}; health check passed."
