package com.example.crud;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile({"local", "dev", "test"})
public class OpenApiConfiguration {

    @Bean
    public OpenAPI productCrudOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Product CRUD API")
                        .version("v1")
                        .description("REST API for managing products"));
    }
}
