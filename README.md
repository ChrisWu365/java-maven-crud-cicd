# Spring Boot Maven CRUD 示例

这是一个适合练习 GitHub Actions CI/CD 的 Spring Boot + Maven 项目。示例实现了 `Product` 的增删改查，使用 H2 内存数据库，不需要额外安装 MySQL。

## 技术栈

- Java 8
- Spring Boot 2.7
- Spring Web、Spring Data JPA、Bean Validation
- H2 Database
- JUnit 5、MockMvc
- GitHub Actions

## 本地运行

```bash
mvn spring-boot:run
```

应用启动后访问 `http://localhost:8080`。运行全部测试：

```bash
mvn clean verify
```

`verify` 阶段还会执行 Checkstyle 静态检查。如果代码风格检查失败，Maven 构建会失败：

```bash
mvn checkstyle:check
```

项目还使用 SpotBugs 和 PMD：

- **Checkstyle**：检查代码格式、命名、导入和可读性规范
- **SpotBugs**：基于字节码分析潜在缺陷，例如空指针、错误的资源使用和可疑代码
- **PMD**：基于源码规则检查常见错误和不良实践

这三个工具都绑定在 `verify` 阶段，因此完整检查命令会同时执行测试、Checkstyle、SpotBugs 和 PMD：

```bash
mvn clean verify
```

也可以单独运行：

```bash
mvn checkstyle:check
mvn spotbugs:check
mvn pmd:check
```

任何工具发现达到阻断级别的问题，Maven 都会返回失败，GitHub Actions 也会失败。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/products` | 查询全部商品 |
| GET | `/api/products/{id}` | 查询单个商品 |
| POST | `/api/products` | 创建商品 |
| PUT | `/api/products/{id}` | 更新商品 |
| DELETE | `/api/products/{id}` | 删除商品 |

创建或更新时，请求体示例：

```json
{
  "name": "Keyboard",
  "price": 99.90,
  "description": "Mechanical keyboard"
}
```

约束：`name` 不能为空且不超过 100 个字符，`price` 必须大于 0，`description` 不超过 500 个字符。

## GitHub Actions CI

`.github/workflows/ci.yml` 会在推送到 `main` 或创建针对 `main` 的 Pull Request 时触发，依次完成：

1. 检出代码
2. 使用 Temurin Java 8，并缓存 Maven 依赖
3. 执行 `mvn --batch-mode verify`，编译代码并运行测试

你可以在 GitHub 仓库的 **Actions** 页面查看每次构建结果。这个项目先聚焦 CI；后续可以在 CI 通过后增加 Docker 镜像发布或部署到云平台的 CD job。

`checkstyle.xml` 定义了当前项目的代码规范，例如缩进、空白字符、导入、命名、花括号和单行长度。SpotBugs 与 PMD 使用 Maven 插件提供的规则集；实际团队通常会根据误报情况维护项目自己的规则集和排除配置。
