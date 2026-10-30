package com.example.crud;

import com.example.crud.product.Product;
import com.example.crud.product.ProductRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.context.annotation.Import;

import java.math.BigDecimal;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Integration test: starts the complete Spring application context and uses the real Controller,
 * Service, Repository, and H2 database to verify HTTP behavior and component collaboration through MockMvc.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(JacksonConfig.class)
class ProductControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ProductRepository productRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void cleanDatabase() {
        productRepository.deleteAll();
    }

    @Test
    void shouldCreateAndReadProduct() throws Exception {
        Product product = new Product("Keyboard", new BigDecimal("99.90"), "Mechanical keyboard");

        mockMvc.perform(post("/api/products")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(product)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.name", is("Keyboard")))
                .andExpect(jsonPath("$.price", is(99.90)));

        mockMvc.perform(get("/api/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void shouldUpdateAndDeleteProduct() throws Exception {
        Product saved = productRepository.save(
                new Product("Mouse", new BigDecimal("20.00"), "Wireless mouse"));
        Product update = new Product("Gaming Mouse", new BigDecimal("35.00"), "Updated");

        mockMvc.perform(put("/api/products/" + saved.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name", is("Gaming Mouse")));

        mockMvc.perform(delete("/api/products/" + saved.getId()))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/products/" + saved.getId()))
                .andExpect(status().isNotFound());
    }

//    @Test
//    void shouldRejectInvalidProduct() throws Exception {
//        Product invalid = new Product("", BigDecimal.ZERO, null);
//
//        mockMvc.perform(post("/api/products")
//                        .contentType(MediaType.APPLICATION_JSON)
//                        .content(objectMapper.writeValueAsString(invalid)))
//                .andExpect(status().isBadRequest());
//    }

    @Test
    void shouldExposeOpenApiDocumentInTestProfile() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.info.title", is("Product CRUD API")));
    }

    @Test
    void shouldExposeActuatorHealthEndpoint() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("UP")));
    }

    @Test
    void shouldExposePrometheusMetricsEndpoint() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_PLAIN))
                .andExpect(content().string(org.hamcrest.Matchers.containsString("jvm_memory_used_bytes")));
    }

}
