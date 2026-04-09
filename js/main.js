import { 
    getBusinessInfo, 
    getProducts, 
    getServices, 
    getCategories, 
    subscribeToProducts 
} from './data.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Theme Initialization (Local)
    initTheme();

    // 2. Initial Data Fetch (Parallel)
    const [business, categories, services, products] = await Promise.all([
        getBusinessInfo(),
        getCategories(),
        getServices(),
        getProducts()
    ]);
    
    // 3. Dynamic Branding & Colors
    applyBranding(business);

    // 4. Populate Content
    populateContent(business);

    // 5. Render Services
    renderServices(services);

    // 6. Setup Filter Buttons
    setupFilters(categories, business);

    // 7. Setup General Listeners (Menu/Scroll)
    setupGeneralListeners();

    // 8. Setup Advanced Features (Search/Theme/Modal)
    setupAdvancedFeatures(business);

    // 9. Lead Form Submission
    setupLeadForm();

    // 10. Initial Product Render (Homepage focus)
    renderProducts(products, 'all', business);
    updateSearchIndex(products, business);

    // 11. Real-time Product Stream
    subscribeToProducts((updatedProducts) => {
        const activeFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
        renderProducts(updatedProducts, activeFilter, business);
        updateSearchIndex(updatedProducts, business);
    });
});

function applyBranding(b) {
    if (b.primaryColor) document.documentElement.style.setProperty('--accent', b.primaryColor);
    if (b.secondaryColor) document.documentElement.style.setProperty('--secondary', b.secondaryColor);
    if (b.siteName) document.title = `${b.siteName} | Digital Shepherd`;
    
    const logoPlaceholder = document.getElementById('main-logo');
    if (logoPlaceholder && b.logo) {
        logoPlaceholder.innerHTML = `<img src="${b.logo}" alt="${b.siteName}" style="height: 40px; width: auto;">`;
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        const icon = toggle.querySelector('i');
        icon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
}

function setupAdvancedFeatures(business) {
    // Theme Toggle
    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme');
            const target = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', target);
            localStorage.setItem('theme', target);
            
            const icon = toggle.querySelector('i');
            icon.className = target === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        });
    }

    // Modal Close
    const qvModal = document.getElementById('qv-modal');
    const qvClose = document.getElementById('qv-close');
    if (qvClose && qvModal) {
        qvClose.addEventListener('click', () => qvModal.style.display = 'none');
        window.addEventListener('click', (e) => {
            if (e.target === qvModal) qvModal.style.display = 'none';
        });
    }
}

function setupLeadForm() {
    const leadForm = document.getElementById('lead-form');
    if (leadForm) {
        leadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = leadForm.querySelector('button');
            const originalText = submitBtn.textContent;
            
            const name = document.getElementById('lead-name').value;
            const phone = document.getElementById('lead-phone').value;

            try {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Sending...';
                
                const { addLead } = await import('./data.js');
                await addLead({ name: name, phone_number: phone });
                
                alert('Thank you! We will call you back shortly.');
                leadForm.reset();
            } catch (error) {
                alert('Oops! Something went wrong. Please try again or contact us via WhatsApp.');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        });
    }
}

let searchIndex = [];
function updateSearchIndex(products, business) {
    searchIndex = products;
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    if (searchInput && searchResults) {
        // Use a flag to avoid multiple listeners
        if (!searchInput.dataset.listener) {
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value.toLowerCase().trim();
                if (val.length < 1) {
                    searchResults.classList.remove('active');
                    return;
                }

                const matches = searchIndex.filter(p => 
                    p.name.toLowerCase().includes(val) || 
                    (p.brand && p.brand.toLowerCase().includes(val)) ||
                    (p.modelNumber && p.modelNumber.toLowerCase().includes(val))
                ).slice(0, 5);

                if (matches.length > 0) {
                    searchResults.innerHTML = matches.map(p => `
                        <div class="search-item" data-id="${p.id}">
                            ${(p.images?.[0] || p.image) ? `<img src="${p.images?.[0] || p.image}" class="search-thumb">` : '<div class="search-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--border)"><i class="fas fa-box" style="font-size:1rem;color:var(--text-muted)"></i></div>'}
                            <div class="search-info">
                                <h4>${p.name}</h4>
                                <p>${p.brand || ''} ${p.modelNumber || ''}</p>
                            </div>
                        </div>
                    `).join('');
                    searchResults.classList.add('active');

                    searchResults.querySelectorAll('.search-item').forEach(item => {
                        item.addEventListener('click', () => {
                            const id = item.getAttribute('data-id');
                            const product = matches.find(m => m.id === id);
                            openQuickView(product, business);
                            searchResults.classList.remove('active');
                            searchInput.value = '';
                        });
                    });
                } else {
                    searchResults.innerHTML = '<div style="padding: 1rem; color: var(--text-muted); font-size: 0.8rem; text-align: center;">No results found</div>';
                    searchResults.classList.add('active');
                }
            });
            searchInput.dataset.listener = "true";
        }

        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
                searchResults.classList.remove('active');
            }
        });
    }
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

    const waMsg = encodeURIComponent(`Hi, I'm interested in the ${p.brand ? p.brand : ''} ${p.name} - ${p.modelNumber ? p.modelNumber : ''}. Is it available?`);
    const waLink = `https://wa.me/${b.whatsapp.replace(/[^0-9]/g, '')}?text=${waMsg}`;
    document.getElementById('qv-wa-btn').href = waLink;

    modal.style.display = 'flex';
}

function populateContent(b) {
    document.querySelectorAll('#business-name, #footer-business-name').forEach(el => el.textContent = b.siteName || b.name);
    
    const aboutBusinessName = document.getElementById('about-business-name');
    if (aboutBusinessName) {
        const name = b.siteName || b.name;
        let shortName = name.includes('(') ? name.split('(')[1].replace(')', '') : name;
        aboutBusinessName.textContent = shortName;
    }

    const businessSlogan = document.getElementById('business-slogan');
    if (businessSlogan) businessSlogan.textContent = b.slogan;
    
    const heroHeadline = document.getElementById('hero-headline');
    if (heroHeadline) heroHeadline.textContent = b.heroHeadline || "Modern IT & POS Solutions";
    
    const heroSubtitle = document.getElementById('hero-subtitle');
    if (heroSubtitle) heroSubtitle.textContent = b.heroSubtitle || "Empowering your business with top-tier technology.";
    
    const heroImage = document.getElementById('hero-main-img');
    if (heroImage && b.heroImage) heroImage.src = b.heroImage;
    
    const waLink = `https://wa.me/${b.whatsapp.replace(/[^0-9]/g, '')}`;
    const navWa = document.getElementById('nav-whatsapp');
    if (navWa) navWa.href = waLink;
    
    const contactWa = document.getElementById('contact-whatsapp-link');
    if(contactWa) {
        contactWa.href = waLink;
        contactWa.textContent = b.whatsapp;
    }

    const contactPhones = document.getElementById('contact-phones');
    if (contactPhones) contactPhones.innerHTML = b.phones.join('<br>');

    const contactAddress = document.getElementById('contact-address');
    if (contactAddress) contactAddress.textContent = b.address;

    const fb = document.getElementById('contact-facebook');
    if(fb) fb.href = b.facebook;
    
    const ig = document.getElementById('contact-instagram');
    if(ig) ig.href = b.instagram;

    const yearSpan = document.getElementById('current-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
}

function renderProducts(products, filter, business) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    
    // Filter by Homepage visibility if on homepage (default)
    // Actually, filter by category and then by visibility
    // Logic: 
    // If 'all', show products marked for homepage.
    // If 'MainCat', show all products whose category starts with 'MainCat::' OR is exactly 'MainCat'.
    // If 'MainCat::SubCat', show only exact matches.
    
    let filtered;
    if (filter === 'all') {
        filtered = products.filter(p => p.showOnHomepage);
    } else if (!filter.includes('::')) {
        // Filter by Main Category (match both parent and children)
        filtered = products.filter(p => p.category === filter || p.category.startsWith(filter + '::'));
    } else {
        // Filter by Sub Category (exact match)
        filtered = products.filter(p => p.category === filter);
    }

    grid.innerHTML = '';
    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem 0; font-size: 1.2rem;">No products found.</p>';
        return;
    }

    filtered.forEach(p => {
        const stockStatus = p.stockStatus || (p.availability ? 'In Stock' : 'Out of Stock');
        let statusClass = 'badge-instock';
        if (stockStatus === 'Out of Stock') statusClass = 'badge-outofstock';
        if (stockStatus === 'Coming Soon') statusClass = 'badge-comingsoon';
        
        const priceHtml = (p.showPrice && p.price) ? `<div class="product-price">${p.price}</div>` : `<div style="font-size:0.9rem; font-weight: 500; color:var(--text-muted);">Contact for price</div>`;
        const waMsg = encodeURIComponent(`Hi, I'm interested in the ${p.name} - ${p.modelNumber || ''}.`);
        const waLink = `https://wa.me/${business.whatsapp.replace(/[^0-9]/g, '')}?text=${waMsg}`;
        const mainImg = p.images?.[0] || p.image || '';
        const imgHtml = mainImg ? `<img src="${mainImg}" alt="${p.name}" loading="lazy">` : `<i class="fas fa-box" style="font-size: 3rem; color: #333; opacity: 0.3;"></i>`;

        const card = document.createElement('div');
        card.className = 'product-card';
        
        // Clean category name for display
        const displayCategory = (p.category || 'General').split('::').pop();
        
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
                    <a href="${waLink}" target="_blank" class="btn btn-primary buy-btn"><i class="fab fa-whatsapp"></i> Inquire</a>
                </div>
            </div>
        `;

        card.querySelector('.qv-btn-trigger').addEventListener('click', (e) => {
            e.stopPropagation();
            openQuickView(p, business);
        });

        grid.appendChild(card);
    });
}

function renderServices(services) {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    grid.innerHTML = '';
    services.forEach(s => {
        const card = document.createElement('div');
        card.className = 'service-card';
        card.innerHTML = `
            <div class="service-icon"><i class="${s.icon}"></i></div>
            <h3>${s.title}</h3>
            <p>${s.description}</p>
        `;
        grid.appendChild(card);
    });
}

function setupFilters(categories, business) {
    const filterContainer = document.getElementById('products-filter');
    const subFilterBar = document.getElementById('sub-filter-bar');
    if(!filterContainer) return;

    // 1. Extract Unique Main Categories
    const mainCategories = [...new Set(categories.map(cat => cat.split('::')[0]))].sort();

    filterContainer.innerHTML = `<button class="filter-btn active" data-filter="all">All Products</button>`;
    mainCategories.forEach(main => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.setAttribute('data-filter', main);
        btn.textContent = main;
        filterContainer.appendChild(btn);
    });

    const buttons = filterContainer.querySelectorAll('.filter-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            buttons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            const filter = e.currentTarget.getAttribute('data-filter');
            const products = await getProducts();
            
            // Handle sub-filters appearance
            if (filter === 'all') {
                subFilterBar.classList.remove('active');
                renderProducts(products, 'all', business);
            } else {
                renderSubFilters(filter, categories, business);
                // Initially show all for this main category
                renderProducts(products, filter, business);
            }
        });
    });
}

function renderSubFilters(mainCategory, allCategories, business) {
    const subFilterBar = document.getElementById('sub-filter-bar');
    if (!subFilterBar) return;

    const subCats = allCategories
        .filter(c => c.startsWith(mainCategory + '::'))
        .map(c => c.split('::')[1]);

    if (subCats.length === 0) {
        subFilterBar.classList.remove('active');
        return;
    }

    subFilterBar.innerHTML = `<button class="sub-filter-btn active" data-sub="all">All ${mainCategory}</button>`;
    subCats.forEach(sub => {
        const btn = document.createElement('button');
        btn.className = 'sub-filter-btn';
        btn.setAttribute('data-sub', sub);
        btn.textContent = sub;
        subFilterBar.appendChild(btn);
    });

    subFilterBar.classList.add('active');

    const subButtons = subFilterBar.querySelectorAll('.sub-filter-btn');
    subButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            subButtons.forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            const subName = e.currentTarget.getAttribute('data-sub');
            const products = await getProducts();
            
            const fullFilter = subName === 'all' ? mainCategory : `${mainCategory}::${subName}`;
            renderProducts(products, fullFilter, business);
        });
    });
}

function setupGeneralListeners() {
    const btn = document.getElementById('mobile-menu-btn');
    const nav = document.getElementById('desktop-nav');
    if (btn && nav) {
        btn.addEventListener('click', () => {
            nav.classList.toggle('active');
            const icon = btn.querySelector('i');
            icon.className = nav.classList.contains('active') ? 'fas fa-times' : 'fas fa-bars';
        });
    }
}
