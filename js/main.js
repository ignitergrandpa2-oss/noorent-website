import { 
    getBusinessInfo, 
    getProducts, 
    getServices, 
    getCategories, 
    subscribeToProducts,
    cleanWhatsApp
} from './data.js';
import { cart } from './cart.js';
import { placeOrder } from './order-handler.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initial Data Fetch (Parallel)
    const [business, categories, services, products] = await Promise.all([
        getBusinessInfo(),
        getCategories(),
        getServices(),
        getProducts()
    ]);
    
    // 2. Initialization
    initTheme();
    applyBranding(business);
    populateContent(business);
    renderServices(services);
    setupFilters(categories, business);
    setupGeneralListeners();
    setupCartUI(business);
    setupCheckoutUI(business);
    
    // Global Event Delegation for Checkout (Ensure Added Only Once)
    document.addEventListener('click', (e) => {
        if (e.target && (e.target.id === 'checkout-trigger' || e.target.closest('#checkout-trigger'))) {
            e.preventDefault();
            console.log("Global Checkout trigger clicked");
            
            // Access the modal from the global scope/DOM if needed, 
            // but we can just find the trigger's purpose
            const modal = document.getElementById('checkout-modal');
            if (modal) {
                if (cart.items.length === 0) {
                    alert("Your cart is empty!");
                    return;
                }
                document.getElementById('summary-qty').textContent = cart.getCount();
                document.getElementById('summary-total').textContent = cart.formatPrice(cart.getTotal());
                modal.style.display = 'flex';
                modal.classList.add('active');
                document.getElementById('cart-drawer').classList.remove('active');
            }
        }
    });
    
    // 3. Populate Products
    renderFeaturedProducts(products, business);
    renderProducts(products, 'all', business);
    updateSearchIndex(products, business);

    // 4. Real-time Updates
    subscribeToProducts((updatedProducts) => {
        const activeFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
        renderFeaturedProducts(updatedProducts, business);
        renderProducts(updatedProducts, activeFilter, business);
        updateSearchIndex(updatedProducts, business);
    });
});

/** UI Initializers **/

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        const icon = toggle.querySelector('i');
        icon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        
        toggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const target = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', target);
            localStorage.setItem('theme', target);
            icon.className = target === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        });
    }
}

function setupCartUI(business) {
    const trigger = document.getElementById('cart-trigger');
    const drawer = document.getElementById('cart-drawer');
    const closeBtn = document.getElementById('close-cart');
    const continueBtn = document.getElementById('continue-shopping');
    const itemList = document.getElementById('cart-items-list');

    const toggleScroll = (lock) => {
        document.body.classList.toggle('no-scroll', lock);
    };

    const toggleCart = (show) => {
        drawer.classList.toggle('active', show);
        toggleScroll(show);
    };

    trigger?.addEventListener('click', () => toggleCart(true));
    closeBtn?.addEventListener('click', () => toggleCart(false));
    continueBtn?.addEventListener('click', () => toggleCart(false));

    // Listen to Cart Changes
    cart.subscribe((items, total, count) => {
        // Update Counts
        document.querySelectorAll('#cart-count, #cart-title-count').forEach(el => {
            el.textContent = count;
        });
        
        // Update Total
        document.querySelectorAll('#cart-subtotal, #cart-total-footer').forEach(el => {
            el.textContent = cart.formatPrice(total);
        });

        // Update List
        if (itemList) {
            if (items.length === 0) {
                itemList.innerHTML = `
                    <div style="text-align:center; padding: 4rem 2rem; color:var(--text-muted);">
                        <i class="fas fa-shopping-basket" style="font-size:3rem; margin-bottom:1rem; opacity:0.2;"></i>
                        <p>Your cart is empty.</p>
                    </div>
                `;
            } else {
                itemList.innerHTML = items.map(item => `
                    <div class="cart-item">
                        <img src="${item.image || 'https://via.placeholder.com/80?text=No+Image'}" class="cart-item-img">
                        <div class="cart-item-info">
                            <h4>${item.name}</h4>
                            <p>${item.brand || ''} ${item.modelNumber || ''}</p>
                            <div class="cart-item-price">${item.price}</div>
                            <div class="cart-item-actions">
                                <div class="qty-control">
                                    <button class="qty-btn minus" data-id="${item.id}">-</button>
                                    <span class="qty-val">${item.qty}</span>
                                    <button class="qty-btn plus" data-id="${item.id}">+</button>
                                </div>
                                <span class="remove-item" data-id="${item.id}">Remove</span>
                            </div>
                        </div>
                    </div>
                `).join('');
                
                // Attach Item Listeners
                itemList.querySelectorAll('.qty-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const id = e.target.getAttribute('data-id');
                        const isPlus = e.target.classList.contains('plus');
                        const item = items.find(i => i.id === id);
                        cart.updateQty(id, isPlus ? item.qty + 1 : item.qty - 1);
                    });
                });

                itemList.querySelectorAll('.remove-item').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        cart.removeItem(e.target.getAttribute('data-id'));
                    });
                });
            }
        }
    });
}

function setupCheckoutUI(business) {
    const modal = document.getElementById('checkout-modal');
    const trigger = document.getElementById('checkout-trigger');
    const closeBtn = document.getElementById('checkout-close');
    const form = document.getElementById('checkout-form');
    const methodCards = document.querySelectorAll('.method-card');
    const addressGroup = document.getElementById('address-group');
    
    let selectedMethod = 'whatsapp';

    const openCheckout = () => {
        if (cart.items.length === 0) {
            alert("Your cart is empty!");
            return;
        }
        // Ensure modal is reset and data is correct
        document.getElementById('summary-qty').textContent = cart.getCount();
        document.getElementById('summary-total').textContent = cart.formatPrice(cart.getTotal());
        
        // Lock scroll and open modal
        document.body.classList.add('no-scroll');
        modal.style.display = 'flex';
        // Force redraw if needed for mobile
        modal.offsetHeight; 
        modal.classList.add('active');

        // Smooth scroll to top to ensure modal (bottom sheet) is focused visually on mobile
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Use static listeners for persistent elements
    closeBtn?.addEventListener('click', () => { 
        modal.style.display = 'none'; 
        modal.classList.remove('active'); 
        document.body.classList.remove('no-scroll');
    });

    methodCards.forEach(card => {
        card.addEventListener('click', () => {
            methodCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedMethod = card.getAttribute('data-method');
            addressGroup.style.display = selectedMethod === 'direct' ? 'block' : 'none';
            
            const btn = document.getElementById('btn-final-checkout');
            btn.innerHTML = selectedMethod === 'whatsapp' 
                ? 'Proceed to WhatsApp <i class="fab fa-whatsapp"></i>' 
                : 'Confirm Order Directly <i class="fas fa-check"></i>';
        });
    });

    form?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-final-checkout');
        const originalText = btn.innerHTML;

        const customerData = {
            name: document.getElementById('cust-name').value,
            phone: document.getElementById('cust-phone').value,
            address: document.getElementById('cust-address').value,
            businessWhatsapp: business.whatsapp
        };

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            
            const order = await placeOrder(customerData, selectedMethod);
            
            if (selectedMethod === 'direct') {
                alert(`Order Success! Your Order ID is #${order.id}. We will contact you shortly.`);
            }
            
            modal.style.display = 'none';
            document.getElementById('cart-drawer').classList.remove('active');
            form.reset();
        } catch (err) {
            alert("Order failed. Please try again or contact us via WhatsApp.");
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    });
}

/** Rendering Logic **/

function renderFeaturedProducts(products, business) {
    const section = document.getElementById('featured');
    const grid = document.getElementById('featured-grid');
    if (!section || !grid) return;

    const featured = products.filter(p => (p.category || '').includes('::Featured') || p.isFeatured); // Flexible check
    
    if (featured.length > 0) {
        section.style.display = 'block';
        grid.innerHTML = '';
        featured.slice(0, 3).forEach(p => {
            const card = createProductCard(p, business);
            card.classList.add('featured-card');
            grid.appendChild(card);
        });
    } else {
        section.style.display = 'none';
    }
}

function renderProducts(products, filter, business) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    
    let filtered;
    if (filter === 'all') {
        filtered = products.filter(p => p.showOnHomepage);
    } else if (!filter.includes('::')) {
        filtered = products.filter(p => p.category === filter || p.category.startsWith(filter + '::'));
    } else {
        filtered = products.filter(p => p.category === filter);
    }

    grid.innerHTML = '';
    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 5rem 0; font-size: 1.1rem;">No products found in this category.</p>';
        return;
    }

    filtered.forEach(p => {
        grid.appendChild(createProductCard(p, business));
    });
}

function createProductCard(p, business) {
    const stockStatus = p.stockStatus || (p.availability ? 'In Stock' : 'Out of Stock');
    let statusClass = 'badge-instock';
    if (stockStatus === 'Out of Stock') statusClass = 'badge-outofstock';
    if (stockStatus === 'Coming Soon') statusClass = 'badge-comingsoon';
    
    const priceHtml = (p.showPrice && p.price) ? `<div class="product-price">${p.price}</div>` : `<div style="font-size:0.9rem; font-weight: 500; color:var(--text-muted);">Contact for price</div>`;
    const mainImg = p.images?.[0] || p.image || '';
    const imgHtml = mainImg ? `<img src="${mainImg}" alt="${p.name}" loading="lazy">` : `<i class="fas fa-box" style="font-size: 3rem; color: #333; opacity: 0.1;"></i>`;

    const card = document.createElement('div');
    card.className = 'product-card';
    const displayCategory = (p.category || 'General').split('::').pop();
    
    let buttonsHtml = '';
    if (p.add_to_cart !== false) {
        buttonsHtml += `<button class="btn btn-primary buy-btn" title="Add to Cart"><i class="fas fa-cart-plus"></i></button>`;
    }
    if (p.buy_now !== false) {
        buttonsHtml += `<button class="btn btn-primary direct-buy-btn" title="Buy Now"><i class="fas fa-bolt"></i></button>`;
    }
    if (p.whatsapp_inquiry !== false) {
        buttonsHtml += `<button class="btn whatsapp-inquiry-btn" title="WhatsApp Inquiry" style="background-color:#25D366; color:white; border:none;"><i class="fab fa-whatsapp"></i></button>`;
    }

    card.innerHTML = `
        <div class="product-image">
            ${imgHtml}
            <div class="qv-btn-trigger">Quick View</div>
            <span class="product-badge ${statusClass}">${stockStatus}</span>
        </div>
        <div class="product-info">
            <div class="product-category">${displayCategory}</div>
            <h3 class="product-name">${p.name}</h3>
            <p class="product-desc">${p.description.length > 80 ? p.description.substring(0, 80) + '...' : p.description}</p>
            <div class="product-footer">
                ${priceHtml}
                <div class="product-actions" style="display:flex; gap:0.5rem; justify-content: flex-end;">
                    ${buttonsHtml}
                </div>
            </div>
        </div>
    `;

    card.querySelector('.qv-btn-trigger').addEventListener('click', (e) => {
        e.stopPropagation();
        openQuickView(p, business);
    });

    const buyBtn = card.querySelector('.buy-btn');
    if (buyBtn) {
        buyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cart.addItem(p);
            document.getElementById('cart-drawer').classList.add('active');
        });
    }

    const directBuyBtn = card.querySelector('.direct-buy-btn');
    if (directBuyBtn) {
        directBuyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cart.addItem(p);
            // Open cart drawer first to show it's added, then trigger checkout
            const drawer = document.getElementById('cart-drawer');
            if (drawer) drawer.classList.add('active');
            
            // Short delay to let drawer animation start, then open checkout
            setTimeout(() => {
                const checkoutTrigger = document.getElementById('checkout-trigger');
                if (checkoutTrigger) checkoutTrigger.click();
            }, 300);
        });
    }

    const waBtn = card.querySelector('.whatsapp-inquiry-btn');
    if (waBtn) {
        waBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const msg = `Hi there! I’m interested in your collection. Specifically, I'm looking at ${p.name}. Kindly assist me with the best options and current pricing.`;
            const waUrl = `https://wa.me/${(business.whatsapp || '').replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`;
            window.open(waUrl, '_blank');
        });
    }

    return card;
}

function openQuickView(p, b) {
    const modal = document.getElementById('qv-modal');
    if (!modal) return;

    const mainImg = p.images?.[0] || p.image || '';
    document.getElementById('qv-img').src = mainImg || 'https://via.placeholder.com/400?text=No+Image';
    document.getElementById('qv-brand').textContent = p.brand || 'General';
    document.getElementById('qv-name').textContent = p.name;
    document.getElementById('qv-model').textContent = p.modelNumber ? `Model: ${p.modelNumber}` : '';
    
    const descEl = document.getElementById('qv-desc');
    if (p.description.includes('\n') || p.description.includes('•')) {
        const lines = p.description.split(/\n|•/).filter(l => l.trim().length > 0);
        descEl.innerHTML = `<ul>${lines.map(l => `<li>${l.trim()}</li>`).join('')}</ul>`;
    } else {
        descEl.textContent = p.description;
    }

    document.getElementById('qv-warranty').textContent = p.warranty || 'N/A';
    document.getElementById('qv-status').textContent = p.stockStatus || (p.availability ? 'In Stock' : 'Out of Stock');
    
    const priceEl = document.getElementById('qv-price');
    if (p.showPrice && p.price) {
        priceEl.textContent = p.price;
        priceEl.style.display = 'block';
    } else {
        priceEl.textContent = 'Contact for price';
    }

    const footer = document.getElementById('qv-footer-actions');
    if(!footer) return; // Need to update index.html to wrap the buttons

    // Render quick view buttons dynamically
    let buttonsHtml = '';
    if (p.add_to_cart !== false) {
        buttonsHtml += `<button class="btn btn-primary" id="add-to-cart-btn"><i class="fas fa-cart-plus"></i> Add to Cart</button>`;
    }
    if (p.buy_now !== false) {
        buttonsHtml += `<button class="btn btn-outline" id="qv-buy-now-btn" style="border-color:var(--accent); color:var(--accent);"><i class="fas fa-bolt"></i> Buy Now</button>`;
    }
    if (p.whatsapp_inquiry !== false) {
        buttonsHtml += `<button class="btn" id="qv-wa-btn" style="background-color:#25D366; color:white; border:none;"><i class="fab fa-whatsapp"></i> Inquiry</button>`;
    }
    footer.innerHTML = buttonsHtml;

    const addBtn = document.getElementById('add-to-cart-btn');
    if (addBtn) {
        addBtn.addEventListener('click', () => {
            cart.addItem(p);
            modal.style.display = 'none';
            document.getElementById('cart-drawer').classList.add('active');
        });
    }
    
    const buyNowBtn = document.getElementById('qv-buy-now-btn');
    if (buyNowBtn) {
        buyNowBtn.addEventListener('click', () => {
            cart.clear();
            cart.addItem(p);
            modal.style.display = 'none';
            document.getElementById('checkout-modal').style.display = 'flex';
            document.getElementById('summary-qty').textContent = cart.getCount();
            document.getElementById('summary-total').textContent = cart.formatPrice(cart.getTotal());
        });
    }

    const waBtn = document.getElementById('qv-wa-btn');
    if (waBtn) {
        waBtn.addEventListener('click', () => {
            const cleanNumber = cleanWhatsApp(b.whatsapp);
            if (!cleanNumber) {
                alert("Store WhatsApp number is not configured.");
                return;
            }
            const msg = `Hi there! I’m interested in your collection. Specifically, I'm looking at ${p.name}. Kindly assist me with the best options and current pricing.`;
            const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`;
            window.open(waUrl, '_blank');
        });
    }

    modal.style.display = 'flex';
}

/** Static Content Populators **/

function applyBranding(b) {
    if (b.primaryColor) document.documentElement.style.setProperty('--accent', b.primaryColor);
    if (b.secondaryColor) document.documentElement.style.setProperty('--secondary', b.secondaryColor);
    if (b.siteName) document.title = b.siteName;
}

function populateContent(b) {
    document.querySelectorAll('#business-name, #footer-business-name').forEach(el => el.textContent = b.siteName || b.name);
    const heroHeadline = document.getElementById('hero-headline');
    if (heroHeadline) heroHeadline.textContent = b.heroHeadline || "Modern IT & POS Solutions";
    const heroSubtitle = document.getElementById('hero-subtitle');
    if (heroSubtitle) heroSubtitle.textContent = b.heroSubtitle || "Empowering your business with top-tier technology.";
}

function renderServices(services) {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    grid.innerHTML = services.map(s => `
        <div class="service-card">
            <div class="service-icon"><i class="${s.icon}"></i></div>
            <h3>${s.title}</h3>
            <p>${s.description}</p>
        </div>
    `).join('');
}

/** Search & Filters **/

let searchIndex = [];
function updateSearchIndex(products, business) {
    searchIndex = products;
    const input = document.getElementById('search-input');
    const results = document.getElementById('search-results');
    if (!input || !results) return;

    input.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if (val.length < 1) return results.classList.remove('active');

        const matches = searchIndex.filter(p => 
            p.name.toLowerCase().includes(val) || 
            (p.brand && p.brand.toLowerCase().includes(val))
        ).slice(0, 5);

        results.innerHTML = matches.map(p => `
            <div class="search-item" data-id="${p.id}">
                <img src="${p.images?.[0] || p.image || ''}" class="search-thumb">
                <div class="search-info">
                    <h4>${p.name}</h4>
                    <p>${p.brand || ''}</p>
                </div>
            </div>
        `).join('');
        results.classList.toggle('active', matches.length > 0);

        results.querySelectorAll('.search-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.getAttribute('data-id');
                const product = matches.find(m => m.id === id);
                openQuickView(product, business);
                results.classList.remove('active');
                input.value = '';
            });
        });
    });
}

function setupFilters(categories, business) {
    const filterContainer = document.getElementById('products-filter');
    const subFilterBar = document.getElementById('sub-filter-bar');
    if(!filterContainer) return;

    const mainCategories = [...new Set(categories.map(cat => cat.split('::')[0]))].sort();
    filterContainer.innerHTML = `<button class="filter-btn active" data-filter="all">All Solutions</button>` +
        mainCategories.map(main => `<button class="filter-btn" data-filter="${main}">${main}</button>`).join('');

    filterContainer.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            filterContainer.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filter = btn.getAttribute('data-filter');
            const products = await getProducts();
            
            if (filter === 'all') {
                subFilterBar?.classList.remove('active');
                renderProducts(products, 'all', business);
            } else {
                renderSubFilters(filter, categories, business);
                renderProducts(products, filter, business);
            }
        });
    });
}

function renderSubFilters(main, all, business) {
    const bar = document.getElementById('sub-filter-bar');
    if (!bar) return;
    const subCats = all.filter(c => c.startsWith(main + '::')).map(c => c.split('::')[1]);
    
    if (subCats.length === 0) return bar.classList.remove('active');
    
    bar.innerHTML = `<button class="sub-filter-btn active" data-sub="all">All ${main}</button>` +
        subCats.map(sub => `<button class="sub-filter-btn" data-sub="${sub}">${sub}</button>`).join('');
    bar.classList.add('active');

    bar.querySelectorAll('.sub-filter-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            bar.querySelectorAll('.sub-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const sub = btn.getAttribute('data-sub');
            const products = await getProducts();
            renderProducts(products, sub === 'all' ? main : `${main}::${sub}`, business);
        });
    });
}

function setupGeneralListeners() {
    const btn = document.getElementById('mobile-menu-btn');
    const nav = document.getElementById('desktop-nav');
    btn?.addEventListener('click', () => {
        nav?.classList.toggle('active');
        btn.querySelector('i').className = nav?.classList.contains('active') ? 'fas fa-times' : 'fas fa-bars';
    });
    
    // Modal background close
    window.addEventListener('click', (e) => {
        ['qv-modal', 'checkout-modal'].forEach(id => {
            const modal = document.getElementById(id);
            if (e.target === modal) modal.style.display = 'none';
        });
        if (e.target === document.getElementById('cart-drawer')) {
            document.getElementById('cart-drawer').classList.remove('active');
        }
    });

    const qvModal = document.getElementById('qv-modal');
    const qvClose = document.getElementById('qv-close');
    if (qvClose && qvModal) {
        qvClose.addEventListener('click', () => qvModal.style.display = 'none');
    }
}
