import { supabase } from './supabase-config.js';
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

    // --- Monitor Auth State (Supabase) ---
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
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
            const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
            if (error) throw error;
            authError.style.display = 'none';
        } catch (error) {
            authError.textContent = 'Invalid login: ' + error.message;
            authError.style.display = 'block';
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await supabase.auth.signOut();
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
            
            // Update header title
            document.querySelector('.admin-header h2').textContent = e.currentTarget.textContent.trim();
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

    function showToast(msg = "Changes saved successfully!") {
        const toast = document.getElementById('save-toast');
        toast.textContent = msg;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function updateStats() {
        document.getElementById('stat-total-products').textContent = productsList.length;
        document.getElementById('stat-instock').textContent = productsList.filter(p => p.availability).length;
    }

    // --- Image Handling & Optimization ---
    
    /**
     * Compresses image using Canvas API
     */
    async function compressImage(file, { maxWidth = 1200, quality = 0.75 }) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height = (maxWidth / width) * height;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob((blob) => {
                        resolve(blob);
                    }, 'image/jpeg', quality);
                };
            };
        });
    }

    /**
     * Handles file input change, compresses and uploads to Supabase
     */
    async function handleFileUpload(file, progressId, previewId, hiddenInputId, folder = 'products') {
        if (!file) return;

        const progressContainer = document.getElementById(progressId);
        const progressBar = progressContainer.querySelector('.upload-progress-bar');
        const previewContainer = document.getElementById(previewId);
        const hiddenInput = document.getElementById(hiddenInputId);

        try {
            progressContainer.style.display = 'block';
            progressBar.style.width = '10%';

            // 1. Compress Image
            const compressedBlob = await compressImage(file, { maxWidth: 1200, quality: 0.75 });
            progressBar.style.width = '30%';

            // 2. Upload to Supabase Storage
            const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
            const filePath = `${folder}/${fileName}`;

            const { data, error } = await supabase.storage
                .from('noorent-assets') // Ensure this bucket exists or change name
                .upload(filePath, compressedBlob, {
                    contentType: 'image/jpeg',
                    upsert: true
                });

            if (error) throw error;

            progressBar.style.width = '70%';

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('noorent-assets')
                .getPublicUrl(filePath);

            progressBar.style.width = '100%';
            
            // 4. Update UI
            hiddenInput.value = publicUrl;
            previewContainer.innerHTML = `<img src="${publicUrl}" alt="Preview">`;
            
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressBar.style.width = '0%';
            }, 1000);

        } catch (error) {
            console.error("Upload error:", error);
            alert("Upload failed: " + error.message);
            progressContainer.style.display = 'none';
        }
    }

    // Bind Product Image Upload
    const prodImageFile = document.getElementById('prod-image-file');
    if (prodImageFile) {
        prodImageFile.addEventListener('change', (e) => {
            handleFileUpload(e.target.files[0], 'prod-upload-progress', 'prod-preview-container', 'prod-image', 'products');
        });
    }

    // Bind Hero Image Upload
    const heroImageFile = document.getElementById('set-hero-image-file');
    if (heroImageFile) {
        heroImageFile.addEventListener('change', (e) => {
            handleFileUpload(e.target.files[0], 'hero-upload-progress', 'hero-preview-container', 'set-hero-image', 'site');
        });
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
            showToast("Category added!");
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
                if (confirm(`Delete category "${catToDelete}"?`)) {
                    categoriesList = categoriesList.filter(c => c !== catToDelete);
                    await updateCategories(categoriesList);
                    renderCategoryList();
                    updateCategoryFilter();
                    showToast("Category removed");
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
                : `<div class="product-thumb"><i class="fas fa-box"></i></div>`;
            
            const stockStatus = p.stockStatus || (p.availability ? "In Stock" : "Out of Stock");
            const stockColor = stockStatus === 'In Stock' ? 'var(--success)' : (stockStatus === 'Coming Soon' ? 'var(--warning)' : '#ef4444');
            const stockBadge = `<span style="color: ${stockColor}; font-size: 0.85rem;"><i class="fas fa-circle" style="font-size: 0.5rem; vertical-align: middle; margin-right: 4px;"></i> ${stockStatus}</span>`;

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
        tbody.querySelectorAll('.action-btn.edit').forEach(btn => {
            btn.addEventListener('click', (e) => openProductModal(e.currentTarget.getAttribute('data-id')));
        });
        tbody.querySelectorAll('.action-btn.delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.getAttribute('data-id');
                if (confirm("Are you sure you want to delete this product?")) {
                    await deleteProduct(id);
                    showToast("Product deleted");
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
        
        // Reset image preview
        document.getElementById('prod-preview-container').innerHTML = '<i class="fas fa-camera"></i>';
        document.getElementById('prod-image').value = '';
        
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
                document.getElementById('prod-stock').value = p.stockStatus || "In Stock";
                
                if (p.image) {
                    document.getElementById('prod-preview-container').innerHTML = `<img src="${p.image}" alt="Preview">`;
                }
            }
        } else {
            document.getElementById('modal-title').textContent = 'Add New Product';
            document.getElementById('prod-stock').value = 'In Stock';
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
            image: document.getElementById('prod-image').value,
            stockStatus: document.getElementById('prod-stock').value
        };

        try {
            if (currentEditId) {
                await updateProduct(currentEditId, productData);
            } else {
                await addProduct(productData);
            }
            modal.classList.remove('active');
            showToast("Product saved successfully!");
        } catch (error) {
            alert("Error saving product: " + error.message);
        }
    });

    // --- Settings Management ---
    async function populateSettingsForm() {
        const b = await getBusinessInfo();
        document.getElementById('set-name').value = b.name;
        document.getElementById('set-slogan').value = b.slogan;
        document.getElementById('set-hero-headline').value = b.heroHeadline;
        document.getElementById('set-hero-subtitle').value = b.heroSubtitle;
        document.getElementById('set-hero-image').value = b.heroImage || '';
        
        if (b.heroImage) {
            document.getElementById('hero-preview-container').innerHTML = `<img src="${b.heroImage}" alt="Preview">`;
        } else {
            document.getElementById('hero-preview-container').innerHTML = '<i class="fas fa-image"></i>';
        }
        
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
            heroImage: document.getElementById('set-hero-image').value,
            whatsapp: document.getElementById('set-whatsapp').value.trim(),
            phones: document.getElementById('set-phones').value.split(',').map(s => s.trim()),
            address: document.getElementById('set-address').value.trim(),
            facebook: document.getElementById('set-facebook').value.trim(),
            instagram: document.getElementById('set-instagram').value.trim()
        };

        try {
            await updateBusinessInfo(businessData);
            showToast("Settings updated!");
        } catch (error) {
            alert("Error updating settings: " + error.message);
        }
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
                const { error } = await supabase.auth.updateUser({ password: newPass });
                if (error) throw error;
                alert("Password updated successfully!");
                passwordForm.reset();
            } catch (error) {
                alert("Error updating password: " + error.message);
            }
        });
    }

    // --- Export / Backup ---
    document.getElementById('btn-export').addEventListener('click', () => {
        const fullData = {
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
