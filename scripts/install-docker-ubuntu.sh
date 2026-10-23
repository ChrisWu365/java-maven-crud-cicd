#!/usr/bin/env bash

set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script with sudo: sudo bash scripts/install-docker-ubuntu.sh" >&2
  exit 1
fi

if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
  DOCKER_USER="${SUDO_USER}"
else
  DOCKER_USER="${1:-}"
fi

if [ -z "${DOCKER_USER}" ]; then
  echo "Unable to determine the non-root SSH user." >&2
  echo "Run with sudo or pass the user name: sudo bash $0 <user>" >&2
  exit 1
fi

if ! id "${DOCKER_USER}" >/dev/null 2>&1; then
  echo "User does not exist: ${DOCKER_USER}" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y ca-certificates curl

install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc

ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && printf '%s' "${VERSION_CODENAME}")"
cat > /etc/apt/sources.list.d/docker.list <<EOF
deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable
EOF

apt-get update
apt-get install -y \
  docker-ce \
  docker-ce-cli \
  containerd.io \
  docker-buildx-plugin \
  docker-compose-plugin

systemctl enable --now docker
usermod -aG docker "${DOCKER_USER}"

echo
echo "Docker installation completed."
docker --version
docker compose version
echo
echo "User '${DOCKER_USER}' was added to the docker group."
echo "Log out and log in again before running Docker without sudo."
