FROM maven:3.9.9-eclipse-temurin-8 AS build

WORKDIR /workspace
COPY pom.xml .
COPY checkstyle.xml spotbugs-exclude.xml ./
COPY src ./src

RUN mvn --batch-mode clean package -DskipTests

FROM eclipse-temurin:8-jre-jammy

WORKDIR /app
RUN useradd --system --create-home --uid 10001 appuser
COPY --from=build /workspace/target/*.jar /app/app.jar

USER 10001
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
