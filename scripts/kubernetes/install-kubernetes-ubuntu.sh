#!/usr/bin/env bash

set -eu

K8S_MINOR_VERSION="${K8S_MINOR_VERSION:-v1.30}"
POD_NETWORK_CIDR="${POD_NETWORK_CIDR:-10.244.0.0/16}"
FLANNEL_MANIFEST_URL="https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml"
INIT_CONTROL_PLANE=false

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script with sudo: sudo bash scripts/kubernetes/install-kubernetes-ubuntu.sh" >&2
  exit 1
fi

if [ "${1:-}" = "--init-control-plane" ]; then
  INIT_CONTROL_PLANE=true
fi

if ! command -v apt-get >/dev/null 2>&1 || ! command -v systemctl >/dev/null 2>&1; then
  echo "This script supports Ubuntu with apt and systemd only." >&2
  exit 1
fi

if [ -n "${SUDO_USER:-}" ] && [ "${SUDO_USER}" != "root" ]; then
  K8S_USER="${SUDO_USER}"
else
  K8S_USER="${K8S_USER:-}"
fi

if [ -z "${K8S_USER}" ] || ! id "${K8S_USER}" >/dev/null 2>&1; then
  echo "Run with sudo from the SSH user, or set K8S_USER to an existing user." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
swapoff -a
sed -ri '/\sswap\s/s/^/#/' /etc/fstab

apt-get update
apt-get install -y ca-certificates curl gpg apt-transport-https containerd

mkdir -p /etc/containerd
containerd config default > /etc/containerd/config.toml
sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
systemctl enable --now containerd
systemctl restart containerd

install -m 0755 -d /etc/apt/keyrings
curl -fsSL "https://pkgs.k8s.io/core:/stable:/${K8S_MINOR_VERSION}/deb/Release.key" \
  | gpg --dearmor --yes -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
printf 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/%s/deb/ /\n' \
  "${K8S_MINOR_VERSION}" > /etc/apt/sources.list.d/kubernetes.list

apt-get update
apt-get install -y kubelet kubeadm kubectl
apt-mark hold kubelet kubeadm kubectl
systemctl enable kubelet

if [ "${INIT_CONTROL_PLANE}" != "true" ]; then
  echo
  echo "Kubernetes packages installed."
  echo "Next steps:"
  echo "  1. Initialize a cluster with: sudo bash $0 --init-control-plane"
  echo "  2. Or join this node to an existing cluster with kubeadm join."
  echo "  3. Verify the SSH user has a working kubeconfig before running CI/CD."
  kubectl version --client
  exit 0
fi

if [ -f /etc/kubernetes/admin.conf ]; then
  echo "A control-plane configuration already exists; skipping kubeadm init."
else
  kubeadm init --pod-network-cidr="${POD_NETWORK_CIDR}"
fi

install -d -m 0700 -o "${K8S_USER}" -g "$(id -gn "${K8S_USER}")" "/home/${K8S_USER}/.kube"
install -m 0600 -o "${K8S_USER}" -g "$(id -gn "${K8S_USER}")" \
  /etc/kubernetes/admin.conf "/home/${K8S_USER}/.kube/config"

KUBECONFIG="/home/${K8S_USER}/.kube/config" kubectl apply -f "${FLANNEL_MANIFEST_URL}"
KUBECONFIG="/home/${K8S_USER}/.kube/config" kubectl taint nodes --all \
  node-role.kubernetes.io/control-plane- || true
KUBECONFIG="/home/${K8S_USER}/.kube/config" kubectl wait --for=condition=Ready \
  node --all --timeout=180s

echo
echo "Single-node Kubernetes control-plane is ready."
echo "Verify as '${K8S_USER}': kubectl get nodes"
echo "The node is schedulable for the learning deployment."
