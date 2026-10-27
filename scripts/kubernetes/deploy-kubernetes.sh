#!/usr/bin/env bash

set -eu

APP_DIR="${1:?Usage: deploy-kubernetes.sh <app-directory> <image-reference>}"
IMAGE_REF="${2:?Usage: deploy-kubernetes.sh <app-directory> <image-reference>}"
MANIFEST_DIR="${APP_DIR}/deployment/kubernetes"
NAMESPACE="${K8S_NAMESPACE:-product-crud}"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is not installed. Run scripts/kubernetes/install-kubernetes-ubuntu.sh first." >&2
  exit 1
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

kubectl -n "${NAMESPACE}" rollout status deployment/product-crud --timeout=180s
kubectl -n "${NAMESPACE}" get deployment,service,pods -o wide
