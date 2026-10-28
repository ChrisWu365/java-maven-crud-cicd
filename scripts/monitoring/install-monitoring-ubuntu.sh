#!/usr/bin/env bash

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/../../deployment/monitoring/docker-compose.yml"
DOCKER_INSTALLER="${SCRIPT_DIR}/../docker/install-docker-ubuntu.sh"
PROMETHEUS_TARGET="${PROMETHEUS_TARGET:-host.docker.internal:8080}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script with sudo: sudo GRAFANA_ADMIN_PASSWORD='<password>' bash $0" >&2
  exit 1
fi

if [ -z "${GRAFANA_ADMIN_PASSWORD:-}" ]; then
  echo "GRAFANA_ADMIN_PASSWORD is required; choose a strong password." >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "Docker or the Compose plugin is missing; installing only the missing prerequisites."
  bash "${DOCKER_INSTALLER}"
else
  echo "Docker and Docker Compose are already installed; skipping prerequisite installation."
fi

if ! systemctl is-active --quiet docker; then
  systemctl enable --now docker
fi

cd "${SCRIPT_DIR}/../../deployment/monitoring"
export GRAFANA_ADMIN_PASSWORD
export PROMETHEUS_TARGET
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
