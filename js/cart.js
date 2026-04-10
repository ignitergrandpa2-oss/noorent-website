/**
 * Cart State Management for NOORENTERPRISES
 * Pursues a clean, modular approach with localStorage persistence.
 */

class Cart {
    constructor() {
        this.items = JSON.parse(localStorage.getItem('noorent_cart')) || [];
        this.listeners = [];
        this.init();
    }

    init() {
        this.notify();
    }

    addItem(product, qty = 1) {
        const existing = this.items.find(item => item.id === product.id);
        if (existing) {
            existing.qty += qty;
        } else {
            this.items.push({
                id: product.id,
                name: product.name,
                brand: product.brand,
                modelNumber: product.modelNumber,
                price: product.price,
                numericPrice: this.parsePrice(product.price),
                image: product.image,
                qty: qty
            });
        }
        this.save();
        this.notify();
    }

    removeItem(productId) {
        this.items = this.items.filter(item => item.id !== productId);
        this.save();
        this.notify();
    }

    updateQty(productId, qty) {
        const item = this.items.find(item => item.id === productId);
        if (item) {
            item.qty = Math.max(1, qty);
            this.save();
            this.notify();
        }
    }

    clear() {
        this.items = [];
        this.save();
        this.notify();
    }

    save() {
        localStorage.setItem('noorent_cart', JSON.stringify(this.items));
    }

    getTotal() {
        return this.items.reduce((sum, item) => sum + (item.numericPrice * item.qty), 0);
    }

    getCount() {
        return this.items.reduce((sum, item) => sum + item.qty, 0);
    }

    parsePrice(priceStr) {
        if (!priceStr) return 0;
        // Extracts digits from strings like 'Rs. 45,000' or '45000'
        const num = parseFloat(priceStr.replace(/[^0-9.]/g, ''));
        return isNaN(num) ? 0 : num;
    }

    formatPrice(num) {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0
        }).format(num).replace('PKR', 'Rs.');
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notify() {
        this.listeners.forEach(callback => callback(this.items, this.getTotal(), this.getCount()));
    }

    generateWhatsAppMessage(businessName = 'NOORENTERPRISES') {
        let msg = `*New Order from ${businessName}*\n`;
        msg += `--------------------------\n`;
        this.items.forEach((item, index) => {
            msg += `${index + 1}. *${item.name}*\n`;
            msg += `   Qty: ${item.qty} x ${item.price}\n`;
        });
        msg += `--------------------------\n`;
        msg += `*Total Amount:* ${this.formatPrice(this.getTotal())}\n\n`;
        msg += `Please confirm my order. Thank you!`;
        return encodeURIComponent(msg);
    }
}

export const cart = new Cart();
