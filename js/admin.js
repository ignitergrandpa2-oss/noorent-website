import { auth, db } from './firebase-config.js';
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut, 
    updatePassword 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js";
import { 
    getBusinessInfo, 
    updateBusinessInfo, 
    getProducts, 
    addProduct, 
    updateProduct, 
    deleteProduct, 
    getCategories, 
    updateCategories,
    subscribeToProducts,
    migrateFromLocalStorage
} from './data.js';

document.addEventListener('DOMContentLoaded', async () => {
    let currentEditId = null;
    let productsList = [];
    let categoriesList = [];

    // --- Auth Elements ---
    const loginContainer = document.getElementById('login-container');
    const adminWrapper = document.getElementById('admin-wrapper');
    const authForm = document.getElementById('auth-form');
    const authError = document.getElementById('auth-error');

    // --- Monitor Auth State ---
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            showDashboard();
            // Check for legacy data migration
            if (localStorage.getItem('noor_website_data')) {
                await migrateFromLocalStorage();
            }
        } else {
            showLogin();
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            authError.style.display = 'none';
        } catch (error) {
            authError.textContent = 'Invalid login credentials';
            authError.style.display = 'block';
        }
    });

    document.getElementById('btn-logout').addEventListener('click', () => {
        signOut(auth);
    });

    function showDashboard() {
        loginContainer.style.display = 'none';
        adminWrapper.style.display = 'flex';
        initDashboard();
    }

    function showLogin() {
        adminWrapper.style.display = 'none';
        loginContainer.style.display = 'flex';
    }

    // --- Tab Navigation ---
    const navLinks = document.querySelectorAll('.admin-nav a');
    const tabs = document.querySelectorAll('.tab-content');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            
            e.currentTarget.classList.add('active');
            const targetId = e.currentTarget.getAttribute('data-tab');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // --- Core Functions ---
    async function initDashboard() {
        // Load initial data
        categoriesList = await getCategories();
        updateCategoryFilter();
        populateSettingsForm();
        
        // Listen for real-time product updates
        subscribeToProducts((products) => {
            productsList = products;
            updateStats();
            renderProductsTable();
        });
    }

    function updateCategoryFilter() {
        const filterSelect = document.getElementById('admin-category-filter');
        const categoryDatalist = document.getElementById('category-list');
        
        if (filterSelect) {
            const currentValue = filterSelect.value;
            filterSelect.innerHTML = '<option value="all">All Categories</option>';
            categoriesList.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                filterSelect.appendChild(opt);
            });
            if (categoriesList.includes(currentValue)) {
                filterSelect.value = currentValue;
            } else {
                filterSelect.value = 'all';
            }
        }

        if (categoryDatalist) {
            categoryDatalist.innerHTML = '';
            categoriesList.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                categoryDatalist.appendChild(opt);
            });
        }
    }

    function showToast() {
        const toast = document.getElementById('save-toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function updateStats() {
        document.getElementById('stat-total-products').textContent = productsList.length;
        document.getElementById('stat-instock').textContent = productsList.filter(p => p.availability).length;
    }

    // --- Category Management ---
    const categoryModal = document.getElementById('category-modal');
    const categoryForm = document.getElementById('category-form');

    document.getElementById('btn-manage-categories').addEventListener('click', () => {
        renderCategoryList();
        categoryModal.classList.add('active');
    });

    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-category-name');
        const name = nameInput.value.trim();
        
        if (name && !categoriesList.includes(name)) {
            categoriesList.push(name);
            await updateCategories(categoriesList);
            renderCategoryList();
            updateCategoryFilter();
            nameInput.value = '';
            showToast();
        } else if (categoriesList.includes(name)) {
            alert("Category already exists!");
        }
    });

    function renderCategoryList() {
        const list = document.getElementById('admin-category-list-items');
        list.innerHTML = '';
        
        categoriesList.forEach(cat => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${cat}</span>
                <button class="action-btn delete" data-cat="${cat}"><i class="fas fa-trash-alt"></i></button>
            `;
            list.appendChild(li);
        });

        list.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const catToDelete = e.currentTarget.getAttribute('data-cat');
                if (confirm(`Delete category "${catToDelete}"? Existing products in this category will be moved to "General".`)) {
                    categoriesList = categoriesList.filter(c => c !== catToDelete);
                    if (!categoriesList.includes('General')) categoriesList.push('General');
                    
                    await updateCategories(categoriesList);
                    
                    // Update products locally (Firestore triggers will handle re-render)
                    for (const p of productsList) {
                        if (p.category === catToDelete) {
                            await updateProduct(p.id, { category: 'General' });
                        }
                    }
                    
                    renderCategoryList();
                    updateCategoryFilter();
                    showToast();
                }
            });
        });
    }

    // --- Products Management ---
    function renderProductsTable() {
        const tbody = document.getElementById('admin-products-list');
        const filterSelect = document.getElementById('admin-category-filter');
        const currentFilter = filterSelect ? filterSelect.value : 'all';
        
        tbody.innerHTML = '';

        const productsToShow = currentFilter === 'all' 
            ? productsList 
            : productsList.filter(p => p.category === currentFilter);

        productsToShow.forEach(p => {
            const tr = document.createElement('tr');
            
            const imgHtml = p.image && p.image.trim() !== '' 
                ? `<img src="${p.image}" class="product-thumb">` 
                : `<div class="product-thumb"><i class="fas fa-box" style="font-size: 1.5rem; color: var(--border);"></i></div>`;
            
            const stockStatus = p.stockStatus || (p.availability ? "In Stock" : "Out of Stock");
            const stockColor = stockStatus === 'In Stock' ? 'var(--success)' : (stockStatus === 'Coming Soon' ? 'var(--warning)' : '#ef4444');
            const stockBadge = `<span style="color: ${stockColor};"><i class="fas fa-circle" style="font-size: 0.6rem; vertical-align: middle; margin-right: 4px;"></i> ${stockStatus}</span>`;

            tr.innerHTML = `
                <td>${imgHtml}</td>
                <td>
                    <div style="font-weight: 600;">${p.name}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${p.brand || ''} ${p.modelNumber || ''}</div>
                </td>
                <td><span style="background: rgba(79, 142, 247, 0.1); color: var(--accent); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${p.category || 'General'}</span></td>
                <td>${p.showPrice && p.price ? p.price : '<span style="color: var(--text-muted); font-size: 0.8rem;">Contact</span>'}</td>
                <td>${stockBadge}</td>
                <td>
                    <button class="action-btn edit" data-id="${p.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" data-id="${p.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Bind Action Buttons
        document.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => openProductModal(e.currentTarget.getAttribute('data-id')));
        });
        document.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm("Are you sure you want to delete this product?")) {
                    await deleteProduct(id);
                    showToast();
                }
            });
        });
    }

    const adminFilter = document.getElementById('admin-category-filter');
    if (adminFilter) {
        adminFilter.addEventListener('change', renderProductsTable);
    }

    // Modal Logic
    const modal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');

    document.getElementById('btn-add-product').addEventListener('click', () => {
        openProductModal();
    });

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.classList.remove('active');
            categoryModal.classList.remove('active');
        });
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
        if (e.target === categoryModal) categoryModal.classList.remove('active');
    });

    function openProductModal(id = null) {
        currentEditId = id;
        productForm.reset();
        
        if (id) {
            document.getElementById('modal-title').textContent = 'Edit Product';
            const p = productsList.find(x => x.id === id);
            if (p) {
                document.getElementById('prod-id').value = p.id;
                document.getElementById('prod-name').value = p.name;
                document.getElementById('prod-brand').value = p.brand || '';
                document.getElementById('prod-model').value = p.modelNumber || '';
                document.getElementById('prod-category').value = p.category;
                document.getElementById('prod-price').value = p.price || '';
                document.getElementById('prod-show-price').checked = p.showPrice;
                document.getElementById('prod-warranty').value = p.warranty || '';
                document.getElementById('prod-desc').value = p.description;
                document.getElementById('prod-image').value = p.image || '';
                document.getElementById('prod-stock').value = p.stockStatus || (p.availability ? "In Stock" : "Out of Stock");
            }
        } else {
            document.getElementById('modal-title').textContent = 'Add New Product';
            document.getElementById('prod-stock').value = 'true';
            document.getElementById('prod-show-price').checked = true;
        }
        
        modal.classList.add('active');
    }

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const cat = document.getElementById('prod-category').value.trim();
        if (cat && !categoriesList.includes(cat)) {
            categoriesList.push(cat);
            await updateCategories(categoriesList);
            updateCategoryFilter();
        }

        const productData = {
            name: document.getElementById('prod-name').value.trim(),
            brand: document.getElementById('prod-brand').value.trim(),
            modelNumber: document.getElementById('prod-model').value.trim(),
            category: cat,
            price: document.getElementById('prod-price').value.trim(),
            showPrice: document.getElementById('prod-show-price').checked,
            warranty: document.getElementById('prod-warranty').value.trim(),
            description: document.getElementById('prod-desc').value.trim(),
            image: document.getElementById('prod-image').value.trim(),
            stockStatus: document.getElementById('prod-stock').value
        };

        if (currentEditId) {
            await updateProduct(currentEditId, productData);
        } else {
            await addProduct(productData);
        }

        modal.classList.remove('active');
        showToast();
    });

    // --- Settings Management ---
    async function populateSettingsForm() {
        const b = await getBusinessInfo();
        document.getElementById('set-name').value = b.name;
        document.getElementById('set-slogan').value = b.slogan;
        document.getElementById('set-hero-headline').value = b.heroHeadline;
        document.getElementById('set-hero-subtitle').value = b.heroSubtitle;
        const heroImgInput = document.getElementById('set-hero-image');
        if(heroImgInput) heroImgInput.value = b.heroImage || '';
        document.getElementById('set-whatsapp').value = b.whatsapp;
        document.getElementById('set-phones').value = b.phones.join(', ');
        document.getElementById('set-address').value = b.address;
        document.getElementById('set-facebook').value = b.facebook;
        document.getElementById('set-instagram').value = b.instagram;
    }

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const businessData = {
            name: document.getElementById('set-name').value.trim(),
            slogan: document.getElementById('set-slogan').value.trim(),
            heroHeadline: document.getElementById('set-hero-headline').value.trim(),
            heroSubtitle: document.getElementById('set-hero-subtitle').value.trim(),
            heroImage: document.getElementById('set-hero-image') ? document.getElementById('set-hero-image').value.trim() : '',
            whatsapp: document.getElementById('set-whatsapp').value.trim(),
            phones: document.getElementById('set-phones').value.split(',').map(s => s.trim()),
            address: document.getElementById('set-address').value.trim(),
            facebook: document.getElementById('set-facebook').value.trim(),
            instagram: document.getElementById('set-instagram').value.trim()
        };

        await updateBusinessInfo(businessData);
        showToast();
    });

    // --- Security Management ---
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPass = document.getElementById('new-password').value;
            const confirmPass = document.getElementById('confirm-password').value;

            if (newPass !== confirmPass) {
                alert("Passwords do not match!");
                return;
            }

            try {
                const user = auth.currentUser;
                await updatePassword(user, newPass);
                alert("Password updated successfully!");
                passwordForm.reset();
            } catch (error) {
                if (error.code === 'auth/requires-recent-login') {
                    alert("For security reasons, please log out and log back in before changing your password.");
                } else {
                    alert("Error updating password: " + error.message);
                }
            }
        });
    }

    // --- Export / Backup ---
    document.getElementById('btn-export').addEventListener('click', () => {
        const fullData = {
            business: {}, // Could fetch on the fly
            products: productsList,
            categories: categoriesList
        };
        const dataStr = JSON.stringify(fullData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        const exportFileDefaultName = `noorent_backup_${new Date().toISOString().slice(0,10)}.json`;
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    });
});
