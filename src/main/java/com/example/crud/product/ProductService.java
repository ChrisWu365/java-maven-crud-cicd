package com.example.crud.product;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

@Service
public class ProductService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ProductService.class);

    private final ProductRepository productRepository;

    public ProductService(ProductRepository productRepository) {
        this.productRepository = productRepository;
    }

    public List<Product> findAll() {
        List<Product> products = productRepository.findAll();
        if (LOGGER.isDebugEnabled()) {
            LOGGER.debug("Found {} products", products.size());
        }
        return products;
    }

    public Product findById(Long id) {
        return productRepository.findById(id)
                .orElseThrow(() -> {
                    LOGGER.warn("Product not found with id={}", id);
                    return new ResponseStatusException(HttpStatus.NOT_FOUND, "Product not found");
                });
    }

    public Product create(Product product) {
        product.setId(null);
        Product savedProduct = productRepository.save(product);
        if (LOGGER.isDebugEnabled()) {
            LOGGER.debug("Created product with id={}", savedProduct.getId());
        }
        return savedProduct;
    }

    public Product update(Long id, Product request) {
        Product product = findById(id);
        product.setName(request.getName());
        product.setPrice(request.getPrice());
        product.setDescription(request.getDescription());
        Product updatedProduct = productRepository.save(product);
        if (LOGGER.isDebugEnabled()) {
            LOGGER.debug("Updated product with id={}", updatedProduct.getId());
        }
        return updatedProduct;
    }

    public void delete(Long id) {
        Product product = findById(id);
        productRepository.delete(product);
        if (LOGGER.isDebugEnabled()) {
            LOGGER.debug("Deleted product with id={}", id);
        }
    }
}
