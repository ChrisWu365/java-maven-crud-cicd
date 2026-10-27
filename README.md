# Spring Boot Maven CRUD Example

This project is a Spring Boot and Maven CRUD example for practicing GitHub Actions CI/CD. It implements CRUD operations for `Product` and uses an H2 in-memory database, so no MySQL installation is required.

## Technology Stack

- Java 8
- Spring Boot 2.7
- Spring Web, Spring Data JPA, and Bean Validation
- Spring Boot Actuator and Micrometer Prometheus metrics
- H2 Database
- JUnit 5 and MockMvc
- GitHub Actions
- Springdoc OpenAPI / Swagger UI

## Run Locally

```bash
mvn spring-boot:run
```

After startup, visit `http://localhost:8080`. Run all tests and quality checks with:

```bash
mvn clean verify
```

The default local profile is `local`. Swagger UI is available at `http://localhost:8080/swagger-ui.html`, and the OpenAPI document is available at `http://localhost:8080/v3/api-docs`.

Profiles can be selected explicitly:

```bash
mvn spring-boot:run -Dspring-boot.run.profiles=local
mvn spring-boot:run -Dspring-boot.run.profiles=dev
mvn spring-boot:run -Dspring-boot.run.profiles=test
java -jar target/product-crud-0.0.1-SNAPSHOT.jar --spring.profiles.active=staging
java -jar target/product-crud-0.0.1-SNAPSHOT.jar --spring.profiles.active=prod
```

The project defines five profiles:

- `local`: local development with H2 and Swagger enabled
- `dev`: shared development environment with Swagger enabled
- `test`: automated tests with Swagger enabled
- `staging`: production-like environment with an external database and Swagger disabled
- `prod`: production environment with Swagger disabled

Swagger UI and OpenAPI endpoints are enabled only for `local`, `dev`, and `test`. They are explicitly disabled for `staging` and `prod`. The systemd deployment service sets `SPRING_PROFILES_ACTIVE=prod`.

The `verify` phase also runs Checkstyle. The Maven build fails when a code style violation is found:

```bash
mvn checkstyle:check
```

The project also uses SpotBugs and PMD:

- **Checkstyle**: checks code formatting, naming, imports, and readability rules
- **SpotBugs**: analyzes bytecode for potential defects such as null pointer risks, incorrect resource usage, and suspicious code
- **PMD**: analyzes source code for common errors and poor practices

All three tools are bound to the `verify` phase, so the complete command runs tests, Checkstyle, SpotBugs, and PMD:

```bash
mvn clean verify
```

They can also be run individually:

```bash
mvn checkstyle:check
mvn spotbugs:check
mvn pmd:check
```

If a tool finds a blocking issue, Maven returns a failure and GitHub Actions fails as well.

## API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/products` | List all products |
| GET | `/api/products/{id}` | Find one product |
| POST | `/api/products` | Create a product |
| PUT | `/api/products/{id}` | Update a product |
| DELETE | `/api/products/{id}` | Delete a product |

Example request body for creating or updating a product:

```json
{
  "name": "Keyboard",
  "price": 99.90,
  "description": "Mechanical keyboard"
}
```

Validation rules: `name` is required and must be at most 100 characters, `price` must be greater than 0, and `description` must be at most 500 characters.

The controller and `Product` model use OpenAPI annotations to document operation summaries, parameters, response codes, validation fields, and example values in Swagger UI.

## Deployment

The deployment examples are deliberately separated so the same application can be operated in three common ways:

| Method | Files | Runtime | Best for |
| --- | --- | --- | --- |
| Manual JAR | `scripts/manual/` | Java + systemd | Learning the host process model |
| Docker | `deployment/docker/`, `scripts/docker/` | Docker Compose | A simple single-VM container deployment |
| Kubernetes | `deployment/kubernetes/`, `scripts/kubernetes/` | Kubernetes Deployment + NodePort | Practising container orchestration and rolling updates |

The Docker image is built once by GitHub Actions and published to GHCR. Both Docker and Kubernetes deployment paths consume the immutable `sha-<commit>` image, so the runtime does not build different code from the CI artifact.

### 1. Manual JAR deployment

Build the application locally, copy the JAR and the manual deployment files to an Ubuntu VM, then run:

```bash
mvn clean package -DskipTests
scp target/product-crud-0.0.1-SNAPSHOT.jar <user>@<vm>:/home/<user>/app/
scp scripts/manual/deploy.sh scripts/manual/product-crud.service <user>@<vm>:/home/<user>/app/
ssh <user>@<vm> 'bash /home/<user>/app/deploy.sh /home/<user>/app'
```

The script installs Java 8 if needed, installs a systemd unit, and enables restart after failure or reboot. Inspect it with:

```bash
sudo systemctl status product-crud
sudo journalctl -u product-crud -f
```

### 2. Docker deployment

The multi-stage `Dockerfile` builds a Java 8 image and runs it as a non-root user. To run locally:

```bash
docker compose -f deployment/docker/docker-compose.yml up --build -d
docker compose -f deployment/docker/docker-compose.yml logs -f product-crud
docker compose -f deployment/docker/docker-compose.yml down
```

For an Ubuntu VM, install Docker with:

```bash
sudo bash scripts/docker/install-docker-ubuntu.sh
```

The remote deployment script is `scripts/docker/deploy-docker.sh <app-directory> <image-reference>`. It logs in to GHCR, pulls the immutable image, recreates the Compose service, and waits for `/actuator/health`.

### 3. Kubernetes + Docker deployment

This is the recommended learning path for the three-VM exercise:

```text
VM 1: Kubernetes control-plane
VM 2: Kubernetes worker running product-crud
VM 3: Prometheus + Grafana
```

The application is still a Docker image, but Kubernetes manages its desired state. The manifests in `deployment/kubernetes/` create one replica and expose port `30080` on each Kubernetes node. The deployment uses Actuator readiness and liveness probes and requests a small CPU/memory budget.

On the Kubernetes VM, install/configure `kubectl` and ensure it can reach the cluster. The deployment script creates a namespace and a short-lived GHCR pull secret from environment variables, applies the manifests, and waits for the rollout:

```bash
export GHCR_USERNAME=<github-username>
export GHCR_TOKEN=<read-package-token>
bash scripts/kubernetes/deploy-kubernetes.sh /home/<user>/app ghcr.io/<owner>/<repo>:sha-<commit>
```

For production, use a managed identity, an external secret store, or a carefully scoped long-lived registry credential rather than storing credentials in YAML. This example keeps the mechanism visible for learning.

### GitHub Actions CI/CD

`.github/workflows/cicd.yml` runs CI on pull requests and pushes to `main`. A push to `main` runs:

1. Maven tests and Checkstyle, SpotBugs, and PMD
2. Docker build and push to GHCR with `sha-<commit>` and `latest` tags
3. SSH deployment to Kubernetes by default

Use **Actions -> Java CI/CD with Docker -> Run workflow** to choose `kubernetes` or `docker`. The manual workflow dispatch is useful for comparing both runtime paths without changing the application code.

Configure these repository secrets:

| Secrets | Used by |
| --- | --- |
| `K8S_VM_IP`, `K8S_VM_USER`, `K8S_VM_KEY` | Default Kubernetes deployment |
| `K8S_GHCR_USERNAME`, `K8S_GHCR_TOKEN` | Persistent GHCR pull secret for Kubernetes |
| `DOCKER_VM_IP`, `DOCKER_VM_USER`, `DOCKER_VM_KEY` | Optional Docker Compose deployment |

Use a narrowly scoped GHCR token with package read permission for `K8S_GHCR_TOKEN`; do not use the short-lived `GITHUB_TOKEN` for a Kubernetes pull secret that must survive a later pod reschedule. Restrict SSH and Kubernetes NodePort access with Azure NSGs. The monitoring VM should be the only host allowed to reach the application metrics endpoint.

### Prometheus and Grafana

For Docker, scrape `<application-vm-private-ip>:8080`. For Kubernetes, scrape a Kubernetes node private IP on port `30080`:

```yaml
scrape_configs:
  - job_name: product-crud
    metrics_path: /actuator/prometheus
    static_configs:
      - targets: ["<kubernetes-node-private-ip>:30080"]
```

Confirm the target is `UP` in Prometheus **Status -> Targets**, then use Prometheus as the Grafana data source. The application exposes standard JVM, HTTP server, process, and Hikari metrics. In a larger Kubernetes setup, the usual next step is Prometheus Operator or `kube-prometheus-stack`, but a static target is intentionally used here to make the fundamentals clear.

The application API remains available at `/api/products`; health and metrics are available at `/actuator/health` and `/actuator/prometheus`.

`checkstyle.xml` defines the project's style rules, including indentation, whitespace, imports, naming, braces, and line length. SpotBugs and PMD use Maven plugin rule sets; teams commonly maintain project-specific rules and exclusions based on false-positive findings.
