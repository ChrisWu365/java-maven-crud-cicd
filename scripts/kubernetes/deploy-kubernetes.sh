#!/usr/bin/env bash

set -eu

APP_DIR="${1:?Usage: deploy-kubernetes.sh <app-directory> <image-reference>}"
IMAGE_REF="${2:?Usage: deploy-kubernetes.sh <app-directory> <image-reference>}"
MANIFEST_DIR="${APP_DIR}/deployment/kubernetes"
NAMESPACE="${K8S_NAMESPACE:-product-crud}"

if ! command -v kubectl >/dev/null 2>&1; then
  INSTALL_SCRIPT="${APP_DIR}/scripts/kubernetes/install-kubernetes-ubuntu.sh"
  if [ ! -f "${INSTALL_SCRIPT}" ]; then
    echo "Kubernetes installer not found: ${INSTALL_SCRIPT}" >&2
    exit 1
  fi
  if ! command -v sudo >/dev/null 2>&1; then
    echo "kubectl is not installed and sudo is unavailable." >&2
    exit 1
  fi
  echo "kubectl is not installed; installing Kubernetes prerequisites..."
  if ! sudo -n bash "${INSTALL_SCRIPT}"; then
    echo "Automatic Kubernetes installation failed. The SSH user must have passwordless sudo." >&2
    exit 1
  fi
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  echo "kubectl cannot reach a Kubernetes cluster with the current kubeconfig." >&2
  echo "Initialize or join a cluster, then verify: kubectl get nodes" >&2
  exit 1
fi

if [ -z "${GHCR_USERNAME:-}" ] || [ -z "${GHCR_TOKEN:-}" ]; then
  echo "GHCR_USERNAME and GHCR_TOKEN must be provided." >&2
  exit 1
fi

if [ ! -f "${MANIFEST_DIR}/product-crud-deployment.yml" ] || \
  [ ! -f "${MANIFEST_DIR}/product-crud-service.yml" ]; then
  echo "Kubernetes manifests not found in ${MANIFEST_DIR}." >&2
  exit 1
fi

kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "${NAMESPACE}" create secret docker-registry ghcr-credentials \
  --docker-server=ghcr.io \
  --docker-username="${GHCR_USERNAME}" \
  --docker-password="${GHCR_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f -

sed "s|IMAGE_REF|${IMAGE_REF}|g; s|namespace: product-crud|namespace: ${NAMESPACE}|g" \
  "${MANIFEST_DIR}/product-crud-deployment.yml" | kubectl apply -n "${NAMESPACE}" -f -
sed "s|namespace: product-crud|namespace: ${NAMESPACE}|g" \
  "${MANIFEST_DIR}/product-crud-service.yml" | kubectl apply -n "${NAMESPACE}" -f -

if ! kubectl -n "${NAMESPACE}" rollout status deployment/product-crud --timeout=180s; then
  echo "Deployment rollout failed. Collecting Kubernetes diagnostics..." >&2
  kubectl -n "${NAMESPACE}" get deployment/product-crud -o wide >&2 || true
  kubectl -n "${NAMESPACE}" get pods -l app=product-crud -o wide >&2 || true
  kubectl -n "${NAMESPACE}" describe deployment/product-crud >&2 || true
  kubectl -n "${NAMESPACE}" describe pods -l app=product-crud >&2 || true
  kubectl -n "${NAMESPACE}" get events --sort-by=.lastTimestamp >&2 || true
  for pod in $(kubectl -n "${NAMESPACE}" get pods -l app=product-crud \
    -o jsonpath='{.items[*].metadata.name}'); do
    echo "Logs for pod ${pod}:" >&2
    kubectl -n "${NAMESPACE}" logs "${pod}" --all-containers=true --tail=200 >&2 || true
    kubectl -n "${NAMESPACE}" logs "${pod}" --all-containers=true --previous --tail=200 >&2 || true
  done
  exit 1
fi
kubectl -n "${NAMESPACE}" get deployment,service,pods -o wide
