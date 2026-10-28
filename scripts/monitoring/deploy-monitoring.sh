#!/usr/bin/env bash

set -eu

APP_DIR="${1:?Usage: deploy-monitoring.sh <app-directory>}"
COMPOSE_FILE="${APP_DIR}/deployment/monitoring/docker-compose.yml"
DOCKER_INSTALLER="${APP_DIR}/scripts/docker/install-docker-ubuntu.sh"
PROMETHEUS_TARGET="${PROMETHEUS_TARGET:-host.docker.internal:8080}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script with sudo: sudo bash $0 <app-directory>" >&2
  exit 1
fi

if [ -z "${GRAFANA_ADMIN_PASSWORD:-}" ]; then
  echo "GRAFANA_ADMIN_PASSWORD is required; configure it in the GitHub Environment." >&2
  exit 1
fi

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "Monitoring Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  if [ ! -f "${DOCKER_INSTALLER}" ]; then
    echo "Docker is missing and its installer was not copied to: ${DOCKER_INSTALLER}" >&2
    exit 1
  fi
  echo "Docker or the Compose plugin is missing; installing only the missing prerequisites."
  bash "${DOCKER_INSTALLER}"
else
  echo "Docker and Docker Compose are already installed; skipping prerequisite installation."
fi

if ! systemctl is-active --quiet docker; then
  systemctl enable --now docker
fi

export GRAFANA_ADMIN_PASSWORD
export PROMETHEUS_TARGET
cd "${APP_DIR}"

if docker ps -a --format '{{.Names}}' | grep -qx 'product-crud-prometheus'; then
  echo "Prometheus container already exists; Docker Compose will reconcile it."
else
  echo "Prometheus is not installed; Docker Compose will install it."
fi
if docker ps -a --format '{{.Names}}' | grep -qx 'product-crud-grafana'; then
  echo "Grafana container already exists; Docker Compose will reconcile it."
else
  echo "Grafana is not installed; Docker Compose will install it."
fi

docker compose -f "${COMPOSE_FILE}" up -d
docker compose -f "${COMPOSE_FILE}" ps

echo
echo "Monitoring is ready:"
echo "  Prometheus: http://<host>:9090"
echo "  Grafana:    http://<host>:3000"
echo "  Target:     ${PROMETHEUS_TARGET}"
