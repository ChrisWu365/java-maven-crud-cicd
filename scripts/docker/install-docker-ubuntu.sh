#!/usr/bin/env bash

set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script with sudo: sudo bash scripts/docker/install-docker-ubuntu.sh" >&2
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
missing_base_packages=""
for package in ca-certificates curl; do
  if ! dpkg-query -W -f='${Status}' "${package}" 2>/dev/null | \
    grep -q "install ok installed"; then
    missing_base_packages="${missing_base_packages} ${package}"
  fi
done
if [ -n "${missing_base_packages}" ]; then
  apt-get update
  apt-get install -y ${missing_base_packages}
fi
install -m 0755 -d /etc/apt/keyrings
if [ ! -s /etc/apt/keyrings/docker.asc ]; then
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
fi
chmod a+r /etc/apt/keyrings/docker.asc
ARCH="$(dpkg --print-architecture)"
CODENAME="$(. /etc/os-release && printf '%s' "${VERSION_CODENAME}")"
cat > /etc/apt/sources.list.d/docker.list <<EOF
deb [arch=${ARCH} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${CODENAME} stable
EOF
missing_docker_packages=""
for package in docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; do
  if ! dpkg-query -W -f='${Status}' "${package}" 2>/dev/null | \
    grep -q "install ok installed"; then
    missing_docker_packages="${missing_docker_packages} ${package}"
  fi
done
if [ -n "${missing_docker_packages}" ]; then
  apt-get update
  apt-get install -y ${missing_docker_packages}
fi
systemctl enable --now docker
usermod -aG docker "${DOCKER_USER}"
docker --version
docker compose version
echo "User '${DOCKER_USER}' was added to the docker group. Log out and in again."
