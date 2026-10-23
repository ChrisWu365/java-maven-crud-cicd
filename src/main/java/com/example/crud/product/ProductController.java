package com.example.crud.product;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import javax.validation.Valid;
import java.util.List;

@RestController
@RequestMapping("/api/products")
@Tag(name = "Products", description = "Product catalog CRUD operations")
public class ProductController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ProductController.class);

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    @GetMapping
    @Operation(summary = "List products", description = "Returns all products in the catalog")
    public List<Product> findAll() {
        LOGGER.info("Received request to list products");
        return productService.findAll();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Find a product", description = "Returns a product by its identifier")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Product found"),
        @ApiResponse(responseCode = "404", description = "Product not found")
    })
    public Product findById(@Parameter(description = "Product identifier", example = "1")
                            @PathVariable Long id) {
        LOGGER.info("Received request to find product with id={}", id);
        return productService.findById(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create a product", description = "Adds a product to the catalog")
    @ApiResponse(responseCode = "201", description = "Product created")
    public Product create(@Valid @RequestBody Product product) {
        LOGGER.info("Received request to create product");
        return productService.create(product);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Update a product", description = "Updates an existing product")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Product updated"),
        @ApiResponse(responseCode = "404", description = "Product not found")
    })
    public Product update(@Parameter(description = "Product identifier", example = "1")
                          @PathVariable Long id, @Valid @RequestBody Product product) {
        LOGGER.info("Received request to update product with id={}", id);
        return productService.update(id, product);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "Delete a product", description = "Removes a product from the catalog")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Product deleted"),
        @ApiResponse(responseCode = "404", description = "Product not found")
    })
    public void delete(@Parameter(description = "Product identifier", example = "1")
                       @PathVariable Long id) {
        LOGGER.info("Received request to delete product with id={}", id);
        productService.delete(id);
    }
}
