package com.example.crud.product;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Optional;

import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Unit test: does not start the Spring container or connect to a database. It uses a Mockito
 * Repository mock to verify ProductService business logic in isolation, making it fast and easy to diagnose.
 */
@ExtendWith(MockitoExtension.class)
class ProductServiceUnitTest {

    @Mock
    private ProductRepository productRepository;

    @InjectMocks
    private ProductService productService;

    private Product keyboard;

    @BeforeEach
    void setUp() {
        keyboard = new Product("Keyboard", new BigDecimal("99.90"), "Mechanical keyboard");
        keyboard.setId(1L);
    }

    @Test
    void shouldReturnAllProducts() {
        Product mouse = new Product("Mouse", new BigDecimal("20.00"), "Wireless mouse");
        when(productRepository.findAll()).thenReturn(Arrays.asList(keyboard, mouse));

        assertThat(productService.findAll(), contains(keyboard, mouse));

        verify(productRepository).findAll();
    }

    @Test
    void shouldCreateProductAndClearClientProvidedId() {
        keyboard.setId(99L);
        when(productRepository.save(any(Product.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Product result = productService.create(keyboard);

        assertThat(result.getId(), is((Long) null));
        verify(productRepository).save(keyboard);
    }

    @Test
    void shouldUpdateExistingProduct() {
        Product request = new Product("Gaming Keyboard", new BigDecimal("129.90"), "Updated");
        when(productRepository.findById(1L)).thenReturn(Optional.of(keyboard));
        when(productRepository.save(keyboard)).thenReturn(keyboard);

        Product result = productService.update(1L, request);

        assertEquals("Gaming Keyboard", result.getName());
        assertEquals(new BigDecimal("129.90"), result.getPrice());
        assertEquals("Updated", result.getDescription());
        verify(productRepository).save(keyboard);
    }

    @Test
    void shouldDeleteExistingProduct() {
        when(productRepository.findById(1L)).thenReturn(Optional.of(keyboard));

        productService.delete(1L);

        verify(productRepository).delete(keyboard);
    }

    @Test
    void shouldThrowNotFoundWhenProductDoesNotExist() {
        when(productRepository.findById(1L)).thenReturn(Optional.empty());

        ResponseStatusException exception = assertThrows(
                ResponseStatusException.class, () -> productService.findById(1L));

        assertThat(exception.getReason(), is("Product not found"));
        verify(productRepository, never()).save(any(Product.class));
        verify(productRepository, never()).delete(any(Product.class));
    }
}
