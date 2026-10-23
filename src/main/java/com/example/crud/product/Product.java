package com.example.crud.product;

import io.swagger.v3.oas.annotations.media.Schema;

import javax.persistence.Entity;
import javax.persistence.GeneratedValue;
import javax.persistence.GenerationType;
import javax.persistence.Id;
import javax.validation.constraints.DecimalMin;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import javax.validation.constraints.Size;
import java.math.BigDecimal;

@Entity
@Schema(description = "Product available in the catalog")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Schema(description = "Unique product identifier", accessMode = Schema.AccessMode.READ_ONLY, example = "1")
    private Long id;

    @NotBlank(message = "name must not be blank")
    @Size(max = 100, message = "name must be at most 100 characters")
    @Schema(description = "Product name", required = true, example = "Keyboard")
    private String name;

    @NotNull(message = "price must not be null")
    @DecimalMin(value = "0.0", inclusive = false, message = "price must be greater than 0")
    @Schema(description = "Product price", required = true, example = "99.90")
    private BigDecimal price;

    @Size(max = 500, message = "description must be at most 500 characters")
    @Schema(description = "Optional product description", example = "Mechanical keyboard")
    private String description;

    public Product() {
    }

    public Product(String name, BigDecimal price, String description) {
        this.name = name;
        this.price = price;
        this.description = description;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public String getDescription() {
        return description;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void setName(String name) {
        this.name = name;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
