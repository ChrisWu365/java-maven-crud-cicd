#!/usr/bin/env bash

set -eu

APP_DIR="${1:?Usage: deploy.sh <app-directory>}"
APP_JAR="${APP_DIR}/app.jar"
SERVICE_NAME="product-crud"
SERVICE_TEMPLATE="${APP_DIR}/product-crud.service"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
APP_USER="$(id -un)"

mkdir -p "${APP_DIR}"

if ! command -v java >/dev/null 2>&1; then
  echo "Java is not installed. Installing Java 21 runtime..."
  sudo env DEBIAN_FRONTEND=noninteractive apt-get update
  sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openjdk-21-jre-headless
else
  echo "Java is already installed:"
  java -version
fi

sudo systemctl stop "${SERVICE_NAME}.service" 2>/dev/null || true
PID="$(pgrep -f "java -jar ${APP_JAR}" || true)"
if [ -n "${PID}" ]; then
  echo "Killing legacy Java process with PID: ${PID}"
  kill -9 ${PID}
fi

NEW_JAR="$(find "${APP_DIR}" -maxdepth 1 -type f -name '*.jar' ! -name 'app.jar' -print -quit)"
if [ -z "${NEW_JAR}" ]; then
  echo "No new application JAR found in ${APP_DIR}" >&2
  exit 1
fi

mv "${NEW_JAR}" "${APP_JAR}"

if [ ! -f "${SERVICE_TEMPLATE}" ]; then
  echo "Systemd service template not found: ${SERVICE_TEMPLATE}" >&2
  exit 1
fi

sed \
  -e "s|@APP_USER@|${APP_USER}|g" \
  -e "s|@APP_DIR@|${APP_DIR}|g" \
  "${SERVICE_TEMPLATE}" | sudo tee "${SERVICE_FILE}" >/dev/null

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}.service"
sudo systemctl restart "${SERVICE_NAME}.service"
sudo systemctl --no-pager --full status "${SERVICE_NAME}.service"
