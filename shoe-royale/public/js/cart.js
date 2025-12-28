// Cart specific functionality
class CartManager {
    constructor() {
        this.initializeEventListeners();
    }
    
    initializeEventListeners() {
        // Quantity changes
        document.querySelectorAll('.quantity-input').forEach(input => {
            input.addEventListener('change', (e) => this.handleQuantityChange(e));
        });
        
        // Remove buttons
        document.querySelectorAll('.remove-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleRemoveItem(e));
        });
        
        // Checkout button
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => this.handleCheckout());
        }
        
        // Continue shopping
        const continueBtn = document.getElementById('continue-shopping');
        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                window.location.href = '/products';
            });
        }
    }
    
    handleQuantityChange(e) {
        const input = e.target;
        const itemId = input.dataset.itemId;
        const quantity = parseInt(input.value);
        
        if (quantity < 1) {
            input.value = 1;
            return;
        }
        
        // Update via AJAX
        fetch(`/cart/update/${itemId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ quantity: quantity })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.updateItemTotal(itemId, quantity);
                this.updateCartSummary(data.totalAmount);
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('An error occurred', 'error');
        });
    }
    
    handleRemoveItem(e) {
        const itemId = e.target.dataset.itemId;
        
        if (confirm('Are you sure you want to remove this item?')) {
            fetch(`/cart/remove/${itemId}`, {
                method: 'DELETE'
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // Remove item from DOM
                    const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
                    if (itemElement) {
                        itemElement.remove();
                    }
                    
                    // Update cart summary
                    this.updateCartSummary(data.totalAmount);
                    
                    // Update cart count
                    updateCartCount();
                    
                    showNotification('Item removed from cart', 'success');
                    
                    // If cart is empty, show empty message
                    if (document.querySelectorAll('.cart-item').length === 0) {
                        this.showEmptyCartMessage();
                    }
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showNotification('An error occurred', 'error');
            });
        }
    }
    
    updateItemTotal(itemId, quantity) {
        const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
        if (itemElement) {
            const price = parseFloat(itemElement.dataset.price);
            const itemTotal = price * quantity;
            
            const totalElement = itemElement.querySelector('.item-total');
            if (totalElement) {
                totalElement.textContent = formatPrice(itemTotal);
            }
        }
    }
    
    updateCartSummary(totalAmount) {
        const subtotalElement = document.getElementById('cart-subtotal');
        const taxElement = document.getElementById('cart-tax');
        const shippingElement = document.getElementById('cart-shipping');
        const totalElement = document.getElementById('cart-total');
        
        if (subtotalElement) {
            subtotalElement.textContent = formatPrice(totalAmount);
        }
        
        if (taxElement) {
            const tax = totalAmount * 0.1; // 10% tax
            taxElement.textContent = formatPrice(tax);
        }
        
        if (shippingElement) {
            const shipping = totalAmount > 100 ? 0 : 10;
            shippingElement.textContent = shipping === 0 ? 'FREE' : formatPrice(shipping);
        }
        
        if (totalElement) {
            const tax = totalAmount * 0.1;
            const shipping = totalAmount > 100 ? 0 : 10;
            const grandTotal = totalAmount + tax + shipping;
            totalElement.textContent = formatPrice(grandTotal);
        }
    }
    
    handleCheckout() {
        const cartItems = document.querySelectorAll('.cart-item');
        
        if (cartItems.length === 0) {
            showNotification('Your cart is empty', 'warning');
            return;
        }
        
        window.location.href = '/checkout';
    }
    
    showEmptyCartMessage() {
        const cartContainer = document.querySelector('.cart-container');
        if (cartContainer) {
            cartContainer.innerHTML = `
                <div class="text-center py-5">
                    <i class="fas fa-shopping-cart fa-3x text-muted mb-4"></i>
                    <h4 class="mb-3">Your cart is empty</h4>
                    <p class="text-muted mb-4">Add some products to your cart and come back here!</p>
                    <a href="/products" class="btn btn-gold">
                        <i class="fas fa-shopping-bag me-2"></i>Continue Shopping
                    </a>
                </div>
            `;
        }
    }
}

// Initialize cart manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const cartManager = new CartManager();
});