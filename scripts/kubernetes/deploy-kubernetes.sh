#!/usr/bin/env bash

set -eu

APP_DIR="${1:?Usage: deploy-kubernetes.sh <app-directory> <product-image> [spring-profile] [inspection-api-image] [inspection-web-image]}"
IMAGE_REF="${2:?Usage: deploy-kubernetes.sh <app-directory> <product-image> [spring-profile] [inspection-api-image] [inspection-web-image]}"
SPRING_PROFILE="${3:-prod}"
INSPECTION_API_IMAGE="${4:-}"
INSPECTION_WEB_IMAGE="${5:-}"
MANIFEST_DIR="${APP_DIR}/deployment/kubernetes"
MONITORING_DIR="${APP_DIR}/deployment/monitoring"
NAMESPACE="${K8S_NAMESPACE:-product-crud}"

case "${SPRING_PROFILE}" in
  dev|staging|prod)
    ;;
  *)
    echo "Unsupported Spring profile: ${SPRING_PROFILE}. Use dev, staging, or prod." >&2
    exit 1
    ;;
esac

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
  echo "kubectl is not installed; installing Kubernetes prerequisites and initializing a single-node cluster..."
  if ! sudo -n bash "${INSTALL_SCRIPT}" --init-control-plane; then
    echo "Automatic Kubernetes installation failed. The SSH user must have passwordless sudo." >&2
    exit 1
  fi
fi

if ! kubectl cluster-info >/dev/null 2>&1; then
  INSTALL_SCRIPT="${APP_DIR}/scripts/kubernetes/install-kubernetes-ubuntu.sh"
  if [ ! -f "${INSTALL_SCRIPT}" ]; then
    echo "Kubernetes installer not found: ${INSTALL_SCRIPT}" >&2
    exit 1
  fi
  if ! sudo -n bash "${INSTALL_SCRIPT}" --init-control-plane; then
    echo "Kubernetes cluster is unreachable and automatic single-node initialization failed." >&2
    echo "For an existing multi-node cluster, configure kubeconfig and verify: kubectl get nodes" >&2
    exit 1
  fi
  if ! kubectl cluster-info >/dev/null 2>&1; then
    echo "Kubernetes cluster is still unreachable after initialization." >&2
    echo "Verify the SSH user's kubeconfig: kubectl get nodes" >&2
    exit 1
  fi
fi

if [ -z "${GHCR_USERNAME:-}" ] || [ -z "${GHCR_TOKEN:-}" ]; then
  echo "GHCR_USERNAME and GHCR_TOKEN must be provided." >&2
  exit 1
fi

if [ ! -f "${MANIFEST_DIR}/product-crud-deployment.yml" ] || \
  [ ! -f "${MANIFEST_DIR}/product-crud-service.yml" ] || \
  [ ! -f "${MANIFEST_DIR}/monitoring.yml" ]; then
  echo "Kubernetes manifests not found in ${MANIFEST_DIR}." >&2
  exit 1
fi
for monitoring_file in prometheus-rules.yml grafana/dashboards/product-crud.json \
  grafana/provisioning/dashboards/dashboards.yml; do
  if [ ! -f "${MONITORING_DIR}/${monitoring_file}" ]; then
    echo "Monitoring file not found: ${MONITORING_DIR}/${monitoring_file}" >&2
    exit 1
  fi
done

kubectl create namespace "${NAMESPACE}" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "${NAMESPACE}" create secret docker-registry ghcr-credentials \
  --docker-server=ghcr.io \
  --docker-username="${GHCR_USERNAME}" \
  --docker-password="${GHCR_TOKEN}" \
  --dry-run=client -o yaml | kubectl apply -f -

sed "s|IMAGE_REF|${IMAGE_REF}|g; s|__SPRING_PROFILE__|${SPRING_PROFILE}|g; s|namespace: product-crud|namespace: ${NAMESPACE}|g" \
  "${MANIFEST_DIR}/product-crud-deployment.yml" | kubectl apply -n "${NAMESPACE}" -f -
sed "s|namespace: product-crud|namespace: ${NAMESPACE}|g" \
  "${MANIFEST_DIR}/product-crud-service.yml" | kubectl apply -n "${NAMESPACE}" -f -

if [ -z "${INSPECTION_API_IMAGE}" ] || [ -z "${INSPECTION_WEB_IMAGE}" ]; then
  echo "Inspection API and web image references are required." >&2
  exit 1
fi
if [ -z "${JWT_SECRET:-}" ]; then
  echo "JWT_SECRET must be provided for the inspection API." >&2
  exit 1
fi
if [ ! -f "${MANIFEST_DIR}/inspection.yml" ]; then
  echo "Inspection Kubernetes manifest not found: ${MANIFEST_DIR}/inspection.yml" >&2
  exit 1
fi
kubectl -n "${NAMESPACE}" create secret generic inspection-secrets \
  --from-literal=jwt-secret="${JWT_SECRET}" \
  --from-literal=ai-api-key="${AI_API_KEY:-}" \
  --from-literal=ai-provider-url="${AI_PROVIDER_URL:-}" \
  --from-literal=ai-model="${AI_MODEL:-}" \
  --dry-run=client -o yaml | kubectl apply -f -
sed "s|INSPECTION_API_IMAGE|${INSPECTION_API_IMAGE}|g; s|INSPECTION_WEB_IMAGE|${INSPECTION_WEB_IMAGE}|g; s|namespace: product-crud|namespace: ${NAMESPACE}|g" \
  "${MANIFEST_DIR}/inspection.yml" | kubectl apply -n "${NAMESPACE}" -f -

if [ -z "${GRAFANA_ADMIN_PASSWORD:-}" ]; then
  echo "GRAFANA_ADMIN_PASSWORD must be provided for Kubernetes monitoring." >&2
  exit 1
fi
kubectl -n "${NAMESPACE}" create secret generic grafana-admin \
  --from-literal=password="${GRAFANA_ADMIN_PASSWORD}" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "${NAMESPACE}" create configmap prometheus-rules \
  --from-file=prometheus-rules.yml="${MONITORING_DIR}/prometheus-rules.yml" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "${NAMESPACE}" create configmap grafana-dashboard-provider \
  --from-file=dashboards.yml="${MONITORING_DIR}/grafana/provisioning/dashboards/dashboards.yml" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "${NAMESPACE}" create configmap grafana-dashboards \
  --from-file=product-crud.json="${MONITORING_DIR}/grafana/dashboards/product-crud.json" \
  --dry-run=client -o yaml | kubectl apply -f -
sed "s|namespace: product-crud|namespace: ${NAMESPACE}|g" \
  "${MANIFEST_DIR}/monitoring.yml" | kubectl apply -n "${NAMESPACE}" -f -

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
for monitoring_deployment in prometheus grafana; do
  if ! kubectl -n "${NAMESPACE}" rollout status \
    "deployment/${monitoring_deployment}" --timeout=180s; then
    echo "Monitoring deployment rollout failed: ${monitoring_deployment}" >&2
    kubectl -n "${NAMESPACE}" get "deployment/${monitoring_deployment}" -o wide >&2 || true
    kubectl -n "${NAMESPACE}" get pods -l "app=${monitoring_deployment}" -o wide >&2 || true
    kubectl -n "${NAMESPACE}" describe pods -l "app=${monitoring_deployment}" >&2 || true
    kubectl -n "${NAMESPACE}" get events --sort-by=.lastTimestamp >&2 || true
    for pod in $(kubectl -n "${NAMESPACE}" get pods -l "app=${monitoring_deployment}" \
      -o jsonpath='{.items[*].metadata.name}'); do
      echo "Logs for pod ${pod}:" >&2
      kubectl -n "${NAMESPACE}" logs "${pod}" --all-containers=true --tail=200 >&2 || true
    done
    exit 1
  fi
done
for inspection_deployment in inspection-api inspection-web; do
  if ! kubectl -n "${NAMESPACE}" rollout status \
    "deployment/${inspection_deployment}" --timeout=180s; then
    echo "Inspection deployment rollout failed: ${inspection_deployment}" >&2
    kubectl -n "${NAMESPACE}" get "deployment/${inspection_deployment}" -o wide >&2 || true
    kubectl -n "${NAMESPACE}" describe pods -l "app=${inspection_deployment}" >&2 || true
    kubectl -n "${NAMESPACE}" get events --sort-by=.lastTimestamp >&2 || true
    exit 1
  fi
done
kubectl -n "${NAMESPACE}" get deployment,service,pods -o wide
