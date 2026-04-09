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
    let productsSubscriptionCleanup = null;
    let isInitialized = false;

    // --- Monitor Auth State (Supabase) ---
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (session) {
            currentUser = await getUserProfile();
            if (currentUser && !isInitialized) {
                showDashboard();
                isInitialized = true;
            }
        } else {
            isInitialized = false;
            showLogin();
            if (productsSubscriptionCleanup) {
                productsSubscriptionCleanup();
                productsSubscriptionCleanup = null;
            }
        }
    });

    function showDashboard() {
        loginContainer.style.display = 'none';
        adminWrapper.style.display = 'flex';
        
        // Handle Role-Based UI
        const settingsTab = document.querySelector('[data-tab="tab-settings"]');
        const backupTab = document.querySelector('[data-tab="tab-backup"]');
        
        if (currentUser && currentUser.role === 'client_admin') {
            if (settingsTab) settingsTab.style.display = 'none';
            if (backupTab) backupTab.style.display = 'none';
        } else {
            if (settingsTab) settingsTab.style.display = 'block';
            if (backupTab) backupTab.style.display = 'block';
        }

        initDashboard();
    }

    function showLogin() {
        adminWrapper.style.display = 'none';
        loginContainer.style.display = 'flex';
    }

    // --- Tab Navigation ---
    const navLinks = document.querySelectorAll('.admin-nav a, .mobile-nav a:not(#mobile-logout)');
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
            
            // Handle both desktop and mobile link active states
            const allLinksForThisTab = document.querySelectorAll(`[data-tab="${targetTab}"]`);
            allLinksForThisTab.forEach(l => l.classList.add('active'));

            document.getElementById(targetTab).classList.add('active');
            
            const headerTitle = document.querySelector('.admin-header h2');
            if (headerTitle) headerTitle.textContent = e.currentTarget.textContent.trim();
            
            // Scroll to top on mobile
            if (window.innerWidth <= 768) window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    const mobileLogout = document.getElementById('mobile-logout');
    if (mobileLogout) {
        mobileLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
        });
    }

    // --- Core Functions ---
    async function initDashboard() {
        // Cleanup existing subscription if any
        if (productsSubscriptionCleanup) {
            productsSubscriptionCleanup();
        }

        categoriesList = await getCategories();
        updateCategoryFilter();
        populateSettingsForm();
        
        productsSubscriptionCleanup = subscribeToProducts((products) => {
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
        const mainCatSelect = document.getElementById('prod-main-category');
        const subCatSelect = document.getElementById('prod-sub-category');
        
        // 1. Get unique Main Categories
        const mainCategories = [...new Set(categoriesList.map(cat => cat.split('::')[0]))].sort();
        
        // 2. Update Dashboard Filter
        if (filterSelect) {
            const currentValue = filterSelect.value;
            filterSelect.innerHTML = '<option value="all">All Categories</option>';
            categoriesList.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat.includes('::') ? `─ ${cat.split('::')[1]}` : cat;
                if (!cat.includes('::')) opt.style.fontWeight = 'bold';
                filterSelect.appendChild(opt);
            });
            if (categoriesList.includes(currentValue)) filterSelect.value = currentValue;
        }

        // 3. Update Product Modal Main Category Select
        if (mainCatSelect) {
            mainCatSelect.innerHTML = '<option value="" disabled selected>Select Main Category</option>';
            mainCategories.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = cat;
                mainCatSelect.appendChild(opt);
            });

            // Handle Subcategory Dependent Dropdown
            mainCatSelect.onchange = () => {
                const selectedMain = mainCatSelect.value;
                subCatSelect.innerHTML = '<option value="">None / General</option>';
                
                const subs = categoriesList
                    .filter(c => c.startsWith(selectedMain + '::'))
                    .map(c => c.split('::')[1]);
                
                subs.forEach(sub => {
                    const opt = document.createElement('option');
                    opt.value = sub;
                    opt.textContent = sub;
                    subCatSelect.appendChild(opt);
                });
            };
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
                <td data-label="Image">${imgHtml}</td>
                <td data-label="Product">
                    <div style="font-weight: 600;">${p.name} ${homeBadge}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">${p.brand || ''} ${p.modelNumber || ''}</div>
                </td>
                <td data-label="Category">
                    <span style="background: rgba(79, 142, 247, 0.1); color: var(--accent); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;">
                        ${(p.category || 'General').split('::').pop()}
                    </span>
                </td>
                <td data-label="Price">${p.showPrice && p.price ? p.price : '<span style="color: var(--text-muted);">Hidden</span>'}</td>
                <td data-label="Stock">${stockStatus}</td>
                <td data-label="Actions">
                    <button class="action-btn edit" data-id="${p.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="action-btn delete" data-id="${p.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
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

    // --- Image Handling & Optimization ---
    
    async function compressImage(file, { maxWidth = 1200, quality = 0.8, format = 'image/webp' }) {
        return new Promise((resolve, reject) => {
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
                        if (blob) resolve(blob);
                        else reject(new Error("Canvas toBlob failed"));
                    }, format, quality);
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    }

    async function processAndUploadImage(file, folder = 'products', progressBar = null) {
        if (progressBar) {
            progressBar.style.display = 'block';
            progressBar.querySelector('.upload-progress-bar').style.width = '0%';
        }

        try {
            // 1. Optimize
            if (progressBar) progressBar.querySelector('.upload-progress-bar').style.width = '20%';
            const blob = await compressImage(file, { maxWidth: 1200, quality: 0.8, format: 'image/webp' });
            
            // 2. Prepare Path
            const fileName = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}.webp`;
            if (progressBar) progressBar.querySelector('.upload-progress-bar').style.width = '40%';
            
            // 3. Upload to Supabase
            const { data, error } = await supabase.storage
                .from('noorent-assets')
                .upload(fileName, blob, { contentType: 'image/webp' });

            if (error) throw error;
            if (progressBar) progressBar.querySelector('.upload-progress-bar').style.width = '80%';

            // 4. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('noorent-assets')
                .getPublicUrl(fileName);

            if (progressBar) {
                progressBar.querySelector('.upload-progress-bar').style.width = '100%';
                setTimeout(() => { progressBar.style.display = 'none'; }, 1000);
            }

            return publicUrl;
        } catch (error) {
            if (progressBar) progressBar.style.display = 'none';
            throw error;
        }
    }

    // --- Multi-Image Upload Logic ---
    const imageListContainer = document.getElementById('multi-image-list');
    const imageInput = document.getElementById('multi-image-input');
    const btnAddImageSlot = document.getElementById('btn-add-image-slot');

    // Site Logo & Hero Uploads
    const logoInput = document.getElementById('set-logo-file');
    const heroInput = document.getElementById('set-hero-image-file');

    if (logoInput) {
        logoInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                showToast("Optimizing and uploading logo...");
                const url = await processAndUploadImage(file, 'branding');
                document.getElementById('set-logo').value = url;
                document.getElementById('logo-preview-container').innerHTML = `<img src="${url}">`;
                showToast("Logo uploaded!");
            } catch (err) {
                alert("Logo upload failed: " + err.message);
            }
        });
    }

    if (heroInput) {
        heroInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const progressBar = document.getElementById('hero-upload-progress');
            try {
                showToast("Optimizing and uploading hero image...");
                const url = await processAndUploadImage(file, 'branding', progressBar);
                document.getElementById('set-hero-image').value = url;
                document.getElementById('hero-preview-container').innerHTML = `<img src="${url}">`;
                showToast("Hero image updated!");
            } catch (err) {
                alert("Hero upload failed: " + err.message);
            }
        });
    }

    // Initialize SortableJS
    if (imageListContainer) {
        new Sortable(imageListContainer, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            filter: '.add-slot', // Don't allow dragging the "Add" button
            onEnd: () => {
                const newOrder = [];
                imageListContainer.querySelectorAll('.image-slot:not(.add-slot)').forEach(slot => {
                    newOrder.push(slot.getAttribute('data-url'));
                });
                productImages = newOrder;
                showToast("Order updated!");
            }
        });
    }

    let replaceIndex = null;

    if (btnAddImageSlot) {
        btnAddImageSlot.addEventListener('click', () => {
            replaceIndex = null;
            imageInput.click();
        });
    }

    if (imageInput) {
        imageInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            try {
                const toastMsg = replaceIndex !== null ? "Replacing image..." : `Processing ${files.length} images...`;
                showToast(toastMsg);
                
                const uploadedUrls = [];
                for (const file of files) {
                    const url = await processAndUploadImage(file, 'products');
                    uploadedUrls.push(url);
                }
                
                if (replaceIndex !== null) {
                    productImages[replaceIndex] = uploadedUrls[0];
                } else {
                    productImages.push(...uploadedUrls);
                }
                
                renderImageSlots();
                imageInput.value = '';
                replaceIndex = null;
                showToast("Images uploaded successfully!");
            } catch (error) {
                alert("Upload failed: " + error.message);
                replaceIndex = null;
            }
        });
    }

    function renderImageSlots() {
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
            
            slot.querySelector('.img-preview').addEventListener('click', () => {
                replaceIndex = index;
                imageInput.click();
            });

            imageListContainer.insertBefore(slot, btnAddImageSlot);
        });

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
        renderCategoryTree();
        categoryModal.classList.add('active');
    });

    categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const mainInput = document.getElementById('new-category-main');
        const subInput = document.getElementById('new-category-sub');
        
        const main = mainInput.value.trim();
        const sub = subInput.value.trim();
        
        if (!main) return;

        let fullName = sub ? `${main}::${sub}` : main;
        
        if (!categoriesList.includes(fullName)) {
            // If sub was provided, ensure main exists too
            if (sub && !categoriesList.includes(main)) {
                categoriesList.push(main);
            }
            
            categoriesList.push(fullName);
            categoriesList.sort(); // Keep them neat
            
            await updateCategories(categoriesList);
            renderCategoryTree();
            updateCategoryFilter();
            
            subInput.value = '';
            showToast("Category added!");
        } else {
            alert("This category already exists.");
        }
    });

    function renderCategoryTree() {
        const container = document.getElementById('admin-category-tree');
        container.innerHTML = '';
        
        const mainCategories = [...new Set(categoriesList.map(cat => cat.split('::')[0]))].sort();
        
        mainCategories.forEach(main => {
            const mainNode = document.createElement('div');
            mainNode.className = 'tree-main-node';
            
            const subCategories = categoriesList
                .filter(c => c.startsWith(main + '::'))
                .map(c => c.split('::')[1]);
                
            mainNode.innerHTML = `
                <div class="tree-header">
                    <div class="tree-title"><i class="fas fa-chevron-right"></i> ${main}</div>
                    <div class="tree-actions">
                        <button class="delete-btn" data-cat="${main}" title="Delete Main Category & All Subs"><i class="fas fa-trash-alt"></i></button>
                    </div>
                </div>
                <div class="tree-sub-nodes">
                    ${subCategories.map(sub => `
                        <div class="tree-sub-node">
                            <span>${sub}</span>
                            <div class="tree-actions">
                                <button class="delete-btn" data-cat="${main}::${sub}" title="Delete Subcategory"><i class="fas fa-times"></i></button>
                            </div>
                        </div>
                    `).join('')}
                    ${subCategories.length === 0 ? '<div class="tree-sub-node" style="font-style:italic; opacity:0.5;">No subcategories</div>' : ''}
                </div>
            `;
            
            // Toggle Expansion
            const header = mainNode.querySelector('.tree-header');
            header.addEventListener('click', (e) => {
                if (e.target.closest('.tree-actions')) return;
                header.classList.toggle('active');
                const icon = header.querySelector('i');
                icon.className = header.classList.contains('active') ? 'fas fa-chevron-down' : 'fas fa-chevron-right';
            });
            
            container.appendChild(mainNode);
        });

        // Delete Logic
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const catToDelete = btn.getAttribute('data-cat');
                const isMain = !catToDelete.includes('::');
                
                const msg = isMain 
                    ? `Delete "${catToDelete}" and ALL its subcategories?` 
                    : `Delete subcategory "${catToDelete.split('::')[1]}"?`;
                    
                if (confirm(msg)) {
                    if (isMain) {
                        categoriesList = categoriesList.filter(c => !c.startsWith(catToDelete));
                    } else {
                        categoriesList = categoriesList.filter(c => c !== catToDelete);
                    }
                    
                    await updateCategories(categoriesList);
                    renderCategoryTree();
                    updateCategoryFilter();
                    showToast("Category removed");
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
                
                // Split Category Logic
                const catParts = (p.category || '').split('::');
                const mainCat = catParts[0];
                const subCat = catParts[1] || '';
                
                const mainSelect = document.getElementById('prod-main-category');
                const subSelect = document.getElementById('prod-sub-category');
                
                mainSelect.value = mainCat;
                mainSelect.onchange(); // Trigger sub-cat population
                subSelect.value = subCat;

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
            
            // Join Category Logic
            category: (() => {
                const main = document.getElementById('prod-main-category').value;
                const sub = document.getElementById('prod-sub-category').value;
                return sub ? `${main}::${sub}` : main;
            })(),
            
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
