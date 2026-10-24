# Spring Boot Maven CRUD Example

This project is a Spring Boot and Maven CRUD example for practicing GitHub Actions CI/CD. It implements CRUD operations for `Product` and uses an H2 in-memory database, so no MySQL installation is required.

## Technology Stack

- Java 8
- Spring Boot 2.7
- Spring Web, Spring Data JPA, and Bean Validation
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

## GitHub Actions CI/CD

`.github/workflows/cicd.yml` runs on pushes to `main` and pull requests targeting `main`. It:

1. Checks out the source code
2. Sets up Temurin Java 8 and caches Maven dependencies
3. Runs `mvn --batch-mode verify`, which compiles the project, runs tests, and performs static analysis
4. Uploads the JAR and deployment scripts to the Azure VM
5. Runs the deployment script over SSH

Build results are available on the repository's **Actions** page.

## Deployment

The deployment script uses systemd to manage the Java process. The JAR is stored in the remote server's `app` directory, and the service file is installed at `/etc/systemd/system/product-crud.service`. systemd handles process restarts and startup after reboot; application logs are managed by journald instead of being stored beside the JAR.

Use these commands on the server to inspect the service and follow its logs:

```bash
sudo systemctl status product-crud
sudo journalctl -u product-crud -f
```

## Docker Deployment

The project supports a GitHub Actions Docker CI/CD flow. The multi-stage `Dockerfile` builds the application with Maven and runs it in a smaller Java 8 JRE image as a non-root user. The container uses the `prod` profile, so Swagger remains disabled.

Build and run the image:

```bash
docker build -t product-crud:local .
docker run --name product-crud --restart unless-stopped -p 8080:8080 product-crud:local
```

Or use Docker Compose:

```bash
docker compose up --build -d
docker compose logs -f product-crud
docker compose down
```

The API is available at `http://localhost:8080/api/products`. Container logs are written to standard output and can be viewed with `docker logs` or `docker compose logs`; the application does not write logs beside the JAR.

The application exposes the Spring Boot Actuator health endpoint at `http://localhost:8080/actuator/health`. Only the health endpoint is exposed through the management web interface. The Compose healthcheck uses this endpoint, and the remote deployment script retries the endpoint from the VM for up to 60 seconds before failing the deployment.

On pushes to `main`, GitHub Actions first runs tests and static analysis, then builds and pushes an immutable `sha-<commit>` image and `latest` to GitHub Container Registry (GHCR). The deploy job logs in to GHCR on the Azure VM, pulls the immutable image, and recreates the container with Docker Compose. Pull requests run CI only and never deploy.

Before using the Docker CD job, install Docker Engine and the Docker Compose v2 plugin on the Azure VM. The GHCR package must be readable by the VM; for a private package, the workflow uses `GITHUB_TOKEN` through the remote deployment script. Configure database connection settings with environment variables or deployment secrets rather than committing credentials to `docker-compose.yml`.

### Prepare an Ubuntu Azure VM

Run the one-time host setup script as the SSH user that will execute deployments:

```bash
sudo bash scripts/install-docker-ubuntu.sh
```

The script uses Docker's official Ubuntu repository, installs Docker Engine, Buildx, and the Docker Compose v2 plugin, enables the Docker service, and adds the current SSH user to the `docker` group. Log out and log in again after it finishes so the group membership is applied. Verify the installation with:

```bash
docker --version
docker compose version
docker run --rm hello-world
```

The script targets Ubuntu VMs. Review it before execution if the VM has existing Docker packages, custom APT policies, or a non-Ubuntu distribution.

The existing systemd deployment files remain available as an alternative deployment method, but the GitHub Actions workflow now deploys the container image rather than copying and launching a JAR directly.

`checkstyle.xml` defines the project's style rules, including indentation, whitespace, imports, naming, braces, and line length. SpotBugs and PMD use Maven plugin rule sets; teams commonly maintain project-specific rules and exclusions based on false-positive findings.
