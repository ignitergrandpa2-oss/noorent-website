import { 
    getBusinessInfo, 
    getProducts, 
    getServices, 
    getCategories, 
    subscribeToProducts 
} from './data.js';

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Theme Initialization
    initTheme();

    // 2. Initial Data Fetch
    const business = await getBusinessInfo();
    const categories = await getCategories();
    const services = await getServices();
    
    // 3. Populate Content
    populateContent(business);

    // 4. Render Services
    renderServices(services);

    // 5. Setup Filter Buttons
    setupFilters(categories, business);

    // 6. Setup General Listeners (Menu/Scroll)
    setupGeneralListeners();

    // 7. Setup Advanced Features (Search/Theme/Modal)
    setupAdvancedFeatures(business);

    // 8. Lead Form Submission
    setupLeadForm();

    // 9. Real-time Product Stream
    subscribeToProducts((products) => {
        const activeFilter = document.querySelector('.filter-btn.active')?.getAttribute('data-filter') || 'all';
        renderProducts(products, activeFilter, business);
        updateSearchIndex(products, business);
    });
});

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
                await addLead({ Name: name, PhoneNumber: phone });
                
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
                        ${p.image ? `<img src="${p.image}" class="search-thumb">` : '<div class="search-thumb" style="display:flex;align-items:center;justify-content:center;background:var(--border)"><i class="fas fa-box" style="font-size:1rem;color:var(--text-muted)"></i></div>'}
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

        // Close search list on click outside
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

    document.getElementById('qv-img').src = p.image || 'https://via.placeholder.com/400?text=No+Image';
    document.getElementById('qv-brand').textContent = p.brand || 'General';
    document.getElementById('qv-name').textContent = p.name;
    document.getElementById('qv-model').textContent = p.modelNumber ? `Model: ${p.modelNumber}` : '';
    
    // Process description (simple bullet point support)
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
    // Texts
    document.querySelectorAll('#business-name, #footer-business-name').forEach(el => el.textContent = b.name);
    
    const aboutBusinessName = document.getElementById('about-business-name');
    if (aboutBusinessName) {
        let shortName = b.name.includes('(') ? b.name.split('(')[1].replace(')', '') : b.name;
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
    
    // Contact Info
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

    // Socials
    const fb = document.getElementById('contact-facebook');
    if(fb) fb.href = b.facebook;
    
    const ig = document.getElementById('contact-instagram');
    if(ig) ig.href = b.instagram;

    // Footer Year
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
}

function renderProducts(products, filter, business) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    const filtered = filter === 'all' ? products : products.filter(p => p.category === filter);
    
    if (filtered.length === 0) {
        grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 3rem 0; font-size: 1.2rem;">No products found in this category.</p>';
        return;
    }

    filtered.forEach(p => {
        const stockStatus = p.stockStatus || (p.availability ? 'In Stock' : 'Out of Stock');
        let statusClass = 'badge-instock';
        if (stockStatus === 'Out of Stock') statusClass = 'badge-outofstock';
        if (stockStatus === 'Coming Soon') statusClass = 'badge-comingsoon';
        
        let priceHtml = '';
        if (p.showPrice && p.price) {
            priceHtml = `<div class="product-price">${p.price}</div>`;
        } else {
            priceHtml = `<div style="font-size:0.9rem; font-weight: 500; color:var(--text-muted);">Contact for price</div>`;
        }

        const waMsg = encodeURIComponent(`Hi, I'm interested in the ${p.name} - ${p.modelNumber || ''}.`);
        const waLink = `https://wa.me/${business.whatsapp.replace(/[^0-9]/g, '')}?text=${waMsg}`;

        const imgHtml = p.image && p.image.trim() !== '' 
            ? `<img src="${p.image}" alt="${p.name}" loading="lazy">` 
            : `<i class="fas fa-box" style="font-size: 3rem; color: #333; opacity: 0.3;"></i>`;

        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="product-image">
                ${imgHtml}
                <div class="qv-btn-trigger">Quick View</div>
                <span class="product-badge ${statusClass}">${stockStatus}</span>
            </div>
            <div class="product-info">
                <div class="product-category">${p.category || 'General'}</div>
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
    if(!filterContainer) return;

    filterContainer.innerHTML = `<button class="filter-btn active" data-filter="all">All Products</button>`;
    
    categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'filter-btn';
        btn.setAttribute('data-filter', cat);
        btn.textContent = cat;
        filterContainer.appendChild(btn);
    });

    const newFilters = filterContainer.querySelectorAll('.filter-btn');
    newFilters.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            newFilters.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            const filter = e.target.getAttribute('data-filter');
            // Re-render will happen instantly through the state of products
            const products = await getProducts();
            renderProducts(products, filter, business);
        });
    });
}

function setupGeneralListeners() {
    // Mobile Menu
    const btn = document.getElementById('mobile-menu-btn');
    const nav = document.getElementById('desktop-nav');
    
    if (btn && nav) {
        btn.addEventListener('click', () => {
            nav.classList.toggle('active');
            const icon = btn.querySelector('i');
            if (nav.classList.contains('active')) {
                icon.className = 'fas fa-times';
            } else {
                icon.className = 'fas fa-bars';
            }
        });

        nav.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                nav.classList.remove('active');
                if (btn) btn.querySelector('i').className = 'fas fa-bars';
            });
        });
    }

    // Smooth scrolling
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if(targetId === '#') return;
            
            const target = document.querySelector(targetId);
            if (target) {
                const headerOffset = 80;
                const elementPosition = target.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
   
                window.scrollTo({
                     top: offsetPosition,
                     behavior: "smooth"
                });
            }
        });
    });
}
