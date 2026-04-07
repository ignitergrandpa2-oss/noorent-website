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
    getUserProfile
} from './data.js';

document.addEventListener('DOMContentLoaded', async () => {
    let currentEditId = null;
    let productsList = [];
    let categoriesList = [];
    let currentStep = 1;
    let currentUser = null;
    let productImages = []; // Array of URLs for the current product being edited

    // --- Auth Elements ---
    const loginContainer = document.getElementById('login-container');
    const adminWrapper = document.getElementById('admin-wrapper');
    const authForm = document.getElementById('auth-form');
    const authError = document.getElementById('auth-error');

    // --- Monitor Auth State (Supabase) ---
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUser = await getUserProfile();
            showDashboard();
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
        
        // Handle Role-Based UI
        if (currentUser && currentUser.role === 'client_admin') {
            document.querySelector('[data-tab="tab-settings"]').style.display = 'none';
            document.querySelector('[data-tab="tab-backup"]').style.display = 'none';
        } else {
            document.querySelector('[data-tab="tab-settings"]').style.display = 'block';
            document.querySelector('[data-tab="tab-backup"]').style.display = 'block';
        }

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
            const targetTab = e.currentTarget.getAttribute('data-tab');
            
            // Check permissions
            if (currentUser?.role === 'client_admin' && (targetTab === 'tab-settings' || targetTab === 'tab-backup')) {
                alert("Access Denied: Super Admin role required.");
                return;
            }

            navLinks.forEach(l => l.classList.remove('active'));
            tabs.forEach(t => t.classList.remove('active'));
            
            e.currentTarget.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            document.querySelector('.admin-header h2').textContent = e.currentTarget.textContent.trim();
        });
    });

    // --- Core Functions ---
    async function initDashboard() {
        categoriesList = await getCategories();
        updateCategoryFilter();
        populateSettingsForm();
        
        subscribeToProducts((products) => {
            productsList = products;
            updateStats();
            renderProductsTable();
        });

        setupSearch();
    }

    function setupSearch() {
        const searchInput = document.getElementById('admin-product-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                renderProductsTable();
            });
        }
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
            if (categoriesList.includes(currentValue)) filterSelect.value = currentValue;
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
    
    async function compressImage(file, { maxWidth = 1200, quality = 0.8, format = 'image/webp' }) {
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
                    }, format, quality);
                };
            };
        });
    }

    // --- Multi-Image Upload Logic ---
    const imageListContainer = document.getElementById('multi-image-list');
    const imageInput = document.getElementById('multi-image-input');
    const btnAddImageSlot = document.getElementById('btn-add-image-slot');

    // Initialize SortableJS
    if (imageListContainer) {
        new Sortable(imageListContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            filter: '.add-slot', // Don't allow dragging the "Add" button
            onEnd: () => {
                // Sync the productImages array with the new DOM order
                const newOrder = [];
                imageListContainer.querySelectorAll('.image-slot:not(.add-slot)').forEach(slot => {
                    newOrder.push(slot.getAttribute('data-url'));
                });
                productImages = newOrder;
                console.log("New image order:", productImages);
                showToast("Order updated!");
            }
        });
    }

    let replaceIndex = null;

    if (btnAddImageSlot) {
        btnAddImageSlot.addEventListener('click', () => {
            replaceIndex = null; // Adding new, not replacing
            imageInput.click();
        });
    }

    if (imageInput) {
        imageInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            try {
                showToast(replaceIndex !== null ? "Replacing image..." : `Optimizing and uploading ${files.length} images...`);
                
                const uploadedUrls = [];
                for (const file of files) {
                    const blob = await compressImage(file, { maxWidth: 1200, quality: 0.75, format: 'image/webp' });
                    const fileName = `products/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}.webp`;
                    
                    const { data, error } = await supabase.storage
                        .from('noorent-assets')
                        .upload(fileName, blob, { contentType: 'image/webp' });

                    if (error) throw error;

                    const { data: { publicUrl } } = supabase.storage
                        .from('noorent-assets')
                        .getPublicUrl(fileName);

                    uploadedUrls.push(publicUrl);
                }
                
                if (replaceIndex !== null) {
                    // Replace the image at the specific index
                    productImages[replaceIndex] = uploadedUrls[0];
                } else {
                    // Append new images
                    productImages.push(...uploadedUrls);
                }
                
                renderImageSlots();
                imageInput.value = ''; // Reset input
                replaceIndex = null;
            } catch (error) {
                alert("Upload failed: " + error.message);
                replaceIndex = null;
            }
        });
    }

    function renderImageSlots() {
        // Clear all except the "Add" slot
        const slots = imageListContainer.querySelectorAll('.image-slot:not(.add-slot)');
        slots.forEach(s => s.remove());

        productImages.forEach((url, index) => {
            const slot = document.createElement('div');
            slot.className = 'image-slot';
            slot.setAttribute('data-url', url);
            slot.setAttribute('title', 'Drag to reorder, click to replace');
            slot.innerHTML = `
                <img src="${url}" alt="Product image" class="img-preview">
                <button type="button" class="remove-img" data-index="${index}" title="Remove image"><i class="fas fa-times"></i></button>
                <div class="image-overlay"><i class="fas fa-sync-alt"></i> Replace</div>
            `;
            
            // Replacement logic
            slot.querySelector('.img-preview').addEventListener('click', () => {
                replaceIndex = index;
                imageInput.click();
            });

            imageListContainer.insertBefore(slot, btnAddImageSlot);
        });

        // Bind remove buttons
        imageListContainer.querySelectorAll('.remove-img').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(e.currentTarget.getAttribute('data-index'));
                productImages.splice(index, 1);
                renderImageSlots();
            });
        });
    }

    // --- Gallery Picker ---
    const galleryModal = document.getElementById('gallery-modal');
    const galleryGrid = document.getElementById('gallery-grid');
    const btnOpenGallery = document.getElementById('btn-open-gallery');
    let selectedGalleryImages = [];

    if (btnOpenGallery) {
        btnOpenGallery.addEventListener('click', async () => {
            galleryModal.classList.add('active');
            renderGallery();
        });
    }

    async function renderGallery() {
        galleryGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem;"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
        try {
            const { data, error } = await supabase.storage.from('noorent-assets').list('products', { limit: 100, sortBy: { column: 'name', order: 'desc' } });
            if (error) throw error;

            galleryGrid.innerHTML = '';
            data.forEach(file => {
                const { data: { publicUrl } } = supabase.storage.from('noorent-assets').getPublicUrl(`products/${file.name}`);
                const item = document.createElement('div');
                item.className = 'gallery-item';
                if (productImages.includes(publicUrl)) item.classList.add('selected');
                
                item.innerHTML = `<img src="${publicUrl}">`;
                item.addEventListener('click', () => {
                    item.classList.toggle('selected');
                });
                galleryGrid.appendChild(item);
            });
        } catch (error) {
            galleryGrid.innerHTML = `<p style="color:red">Error loading gallery: ${error.message}</p>`;
        }
    }

    document.getElementById('btn-confirm-gallery-selection').addEventListener('click', () => {
        const selected = Array.from(galleryGrid.querySelectorAll('.gallery-item.selected img')).map(img => img.src);
        // Merge with existing but avoid duplicates
        productImages = [...new Set([...productImages, ...selected])];
        renderImageSlots();
        galleryModal.classList.remove('active');
    });

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
        }
    });

    function renderCategoryList() {
        const list = document.getElementById('admin-category-list-items');
        list.innerHTML = '';
        categoriesList.forEach(cat => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${cat}</span><button class="action-btn delete" data-cat="${cat}"><i class="fas fa-trash-alt"></i></button>`;
            list.appendChild(li);
        });

        list.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const cat = e.currentTarget.getAttribute('data-cat');
                if (confirm(`Delete category "${cat}"?`)) {
                    categoriesList = categoriesList.filter(c => c !== cat);
                    await updateCategories(categoriesList);
                    renderCategoryList();
                    updateCategoryFilter();
                }
            });
        });
    }

    // --- Products Management ---
    function renderProductsTable() {
        const tbody = document.getElementById('admin-products-list');
        const searchInput = document.getElementById('admin-product-search');
        const filterSelect = document.getElementById('admin-category-filter');
        
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const currentFilter = filterSelect ? filterSelect.value : 'all';
        
        tbody.innerHTML = '';

        let filtered = productsList.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm) || 
                                 (p.brand && p.brand.toLowerCase().includes(searchTerm)) ||
                                 (p.modelNumber && p.modelNumber.toLowerCase().includes(searchTerm));
            const matchesCategory = currentFilter === 'all' || p.category === currentFilter;
            return matchesSearch && matchesCategory;
        });

        filtered.forEach(p => {
            const tr = document.createElement('tr');
            const mainImg = p.images?.[0] || p.image || '';
            const imgHtml = mainImg ? `<img src="${mainImg}" class="product-thumb">` : `<div class="product-thumb"><i class="fas fa-box"></i></div>`;
            const stockStatus = p.stockStatus || "In Stock";
            const homeBadge = p.showOnHomepage ? '<i class="fas fa-home" title="On Homepage" style="color: var(--accent); margin-left: 5px;"></i>' : '';

            tr.innerHTML = `
                <td>${imgHtml}</td>
                <td>
                    <div style="font-weight: 600;">${p.name} ${homeBadge}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${p.brand || ''} ${p.modelNumber || ''}</div>
                </td>
                <td><span style="background: rgba(79, 142, 247, 0.1); color: var(--accent); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">${p.category || 'General'}</span></td>
                <td>${p.showPrice && p.price ? p.price : '<span style="color: var(--text-muted);">Hidden</span>'}</td>
                <td>${stockStatus}</td>
                <td>
                    <button class="action-btn edit" data-id="${p.id}"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" data-id="${p.id}"><i class="fas fa-trash-alt"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.edit').forEach(btn => btn.addEventListener('click', (e) => openProductModal(e.currentTarget.getAttribute('data-id'))));
        tbody.querySelectorAll('.delete').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            if (confirm("Delete this product?")) deleteProduct(id).then(() => showToast("Deleted"));
        }));
    }

    if (document.getElementById('admin-category-filter')) {
        document.getElementById('admin-category-filter').addEventListener('change', renderProductsTable);
    }

    // Modal Logic
    const modal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');

    document.getElementById('btn-add-product').addEventListener('click', () => openProductModal());
    document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => {
        modal.classList.remove('active');
        categoryModal.classList.remove('active');
        galleryModal.classList.remove('active');
    }));

    window.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
        if (e.target === categoryModal) categoryModal.classList.remove('active');
        if (e.target === galleryModal) galleryModal.classList.remove('active');
    });

    // --- Multi-Step Form Logic ---
    const btnNext = document.getElementById('btn-next-step');
    const btnPrev = document.getElementById('btn-prev-step');
    const btnSave = document.getElementById('btn-save-product');
    const steps = document.querySelectorAll('.form-step');
    const indicatorSteps = document.querySelectorAll('.step-indicator .step');

    function goToStep(stepNumber) {
        currentStep = stepNumber;
        steps.forEach((s, idx) => s.classList.toggle('active', idx + 1 === currentStep));
        indicatorSteps.forEach((s, idx) => {
            s.classList.toggle('active', idx + 1 === currentStep);
            s.classList.toggle('completed', idx + 1 < currentStep);
        });
        btnPrev.style.display = currentStep === 1 ? 'none' : 'block';
        btnNext.style.display = currentStep === 3 ? 'none' : 'block';
        btnSave.style.display = currentStep === 3 ? 'block' : 'none';
        
        if (window.innerWidth <= 600) document.querySelector('.modal-content').scrollTo({ top: 0, behavior: 'smooth' });
    }

    btnNext.addEventListener('click', () => goToStep(currentStep + 1));
    btnPrev.addEventListener('click', () => goToStep(currentStep - 1));

    function openProductModal(id = null) {
        currentEditId = id;
        productForm.reset();
        productImages = [];
        goToStep(1);
        
        if (id) {
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
                document.getElementById('prod-stock').value = p.stockStatus || "In Stock";
                document.getElementById('prod-homepage').checked = p.showOnHomepage;
                productImages = p.images || (p.image ? [p.image] : []);
            }
        }
        renderImageSlots();
        modal.classList.add('active');
    }

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const productData = {
            name: document.getElementById('prod-name').value.trim(),
            brand: document.getElementById('prod-brand').value.trim(),
            modelNumber: document.getElementById('prod-model').value.trim(),
            category: document.getElementById('prod-category').value.trim(),
            price: document.getElementById('prod-price').value.trim(),
            showPrice: document.getElementById('prod-show-price').checked,
            warranty: document.getElementById('prod-warranty').value.trim(),
            description: document.getElementById('prod-desc').value.trim(),
            images: productImages,
            image: productImages[0] || '', // backward compat
            stockStatus: document.getElementById('prod-stock').value,
            showOnHomepage: document.getElementById('prod-homepage').checked
        };

        try {
            btnSave.disabled = true;
            if (currentEditId) await updateProduct(currentEditId, productData);
            else await addProduct(productData);
            modal.classList.remove('active');
            showToast("Product saved!");
        } catch (error) {
            alert(error.message);
        } finally {
            btnSave.disabled = false;
        }
    });

    // --- Settings Management ---
    async function populateSettingsForm() {
        const b = await getBusinessInfo();
        document.getElementById('set-name').value = b.siteName || b.name;
        document.getElementById('set-slogan').value = b.slogan;
        document.getElementById('set-hero-headline').value = b.heroHeadline;
        document.getElementById('set-hero-subtitle').value = b.heroSubtitle;
        document.getElementById('set-hero-image').value = b.heroImage || '';
        
        if (b.heroImage) document.getElementById('hero-preview-container').innerHTML = `<img src="${b.heroImage}">`;
        if (b.logo) document.getElementById('logo-preview-container').innerHTML = `<img src="${b.logo}">`;
        
        document.getElementById('set-primary-color').value = b.primaryColor || '#4f8ef7';
        document.getElementById('set-secondary-color').value = b.secondaryColor || '#050818';

        document.getElementById('set-whatsapp').value = b.whatsapp;
        document.getElementById('set-phones').value = b.phones.join(', ');
        document.getElementById('set-address').value = b.address;
        document.getElementById('set-facebook').value = b.facebook;
        document.getElementById('set-instagram').value = b.instagram;
    }

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            siteName: document.getElementById('set-name').value.trim(),
            slogan: document.getElementById('set-slogan').value.trim(),
            heroHeadline: document.getElementById('set-hero-headline').value.trim(),
            heroSubtitle: document.getElementById('set-hero-subtitle').value.trim(),
            heroImage: document.getElementById('set-hero-image').value,
            logo: document.getElementById('set-logo').value,
            primaryColor: document.getElementById('set-primary-color').value,
            secondaryColor: document.getElementById('set-secondary-color').value,
            whatsapp: document.getElementById('set-whatsapp').value.trim(),
            phones: document.getElementById('set-phones').value.split(',').map(s => s.trim()),
            address: document.getElementById('set-address').value.trim(),
            facebook: document.getElementById('set-facebook').value.trim(),
            instagram: document.getElementById('set-instagram').value.trim()
        };
        updateBusinessInfo(data).then(() => showToast("Settings updated"));
    });

    // --- Password Management ---
    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newPass = document.getElementById('new-password').value;
            if (newPass.length < 6) return alert("Password too short");
            supabase.auth.updateUser({ password: newPass }).then(({ error }) => {
                if (error) alert(error.message);
                else { alert("Password updated!"); passwordForm.reset(); }
            });
        });
    }

    // --- Backup ---
    document.getElementById('btn-export').addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ products: productsList, categories: categoriesList }));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "noorent_backup.json");
        dlAnchorElem.click();
    });
});
