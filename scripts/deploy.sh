#!/usr/bin/env bash

set -eu

APP_DIR="${1:?Usage: deploy.sh <app-directory>}"
APP_JAR="${APP_DIR}/app.jar"
APP_LOG="${APP_DIR}/app.log"

mkdir -p "${APP_DIR}"

if ! command -v java >/dev/null 2>&1; then
  echo "Java is not installed. Installing Java 8 runtime..."
  sudo env DEBIAN_FRONTEND=noninteractive apt-get update
  sudo env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openjdk-8-jre-headless
else
  echo "Java is already installed:"
  java -version
fi

PID="$(pgrep -f "java -jar ${APP_JAR}" || true)"
if [ -n "${PID}" ]; then
  echo "Killing old Java process with PID: ${PID}"
  kill -9 ${PID}
else
  echo "No existing Java process found."
fi

NEW_JAR="$(find "${APP_DIR}" -maxdepth 1 -type f -name '*.jar' ! -name 'app.jar' -print -quit)"
if [ -z "${NEW_JAR}" ]; then
  echo "No new application JAR found in ${APP_DIR}" >&2
  exit 1
fi

mv "${NEW_JAR}" "${APP_JAR}"
nohup java -jar "${APP_JAR}" > "${APP_LOG}" 2>&1 &
echo "New application started with PID: $!"
