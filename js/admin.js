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
    getUserProfile,
    getOrders,
    updateOrderStatus,
    cleanWhatsApp
} from './data.js';

document.addEventListener('DOMContentLoaded', async () => {
    let productsSubscriptionCleanup = null;
    let isInitialized = false;
    let isInitialLoad = true; // Flag to prevent multiple triggers during load
    let currentUser = null;
    let productsList = [];
    let categoriesList = [];
    let currentEditId = null;
    let productImages = [];
    let currentStep = 1;

    const loginContainer = document.getElementById('login-container');
    const adminWrapper = document.getElementById('admin-wrapper');
    const authForm = document.getElementById('auth-form');
    const authError = document.getElementById('auth-error');
    const btnLogout = document.getElementById('btn-logout');
    const mobileLogout = document.getElementById('mobile-logout');

    // 1. Initial State Check
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        console.log("Initial Session Found");
        currentUser = (await getUserProfile(session.user)) || {
            role: 'admin',
            display_name: (session.user.email || 'admin').split('@')[0],
            email: session.user.email
        };
        showDashboard();
        isInitialized = true;
    } else {
        console.log("No Initial Session");
        showLogin();
    }
    isInitialLoad = false;

    // Handle Subsequent State Changes
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (isInitialLoad) return; // Prevent double-triggering during DOMContentLoaded

        console.log("Auth Event:", event);
        if (event === 'SIGNED_IN' && session) {
            currentUser = await getUserProfile(session.user);
            showDashboard();
            isInitialized = true;
        } else if (event === 'SIGNED_OUT') {
            showLogin();
            isInitialized = false;
        }
    });

    // --- Login Form Handler ---
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;
            const submitBtn = authForm.querySelector('button');

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';
                authError.style.display = 'none';

                // SAFETY TIMEOUT: If Supabase takes > 10s, reset the button to prevent permanent hang
                const safetyTimeout = setTimeout(() => {
                    if (submitBtn.disabled) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = 'Login <i class="fas fa-sign-in-alt"></i>';
                        authError.textContent = "Request timed out. Please check your connection and try again.";
                        authError.style.display = 'block';
                    }
                }, 10000);

                console.log("Signing in...");
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });

                clearTimeout(safetyTimeout);
                if (error) {
                    console.error("Supabase Auth Error:", error);
                    throw error;
                }

                if (!data || !data.user) {
                    throw new Error("Login failed: Invalid response from authentication server.");
                }

            } catch (err) {
                console.error("Login failed:", err.message);
                authError.textContent = err.message || "An unexpected error occurred during login.";
                authError.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Login <i class="fas fa-sign-in-alt"></i>';
            }
        });
    }



    function showDashboard() {
        loginContainer.style.opacity = '0';
        setTimeout(() => {
            loginContainer.style.display = 'none';
            adminWrapper.style.display = 'flex';
            adminWrapper.style.opacity = '0';
            setTimeout(() => {
                adminWrapper.style.opacity = '1';
                updateRoleVisibility();
                initDashboard();
            }, 50);
        }, 500);
    }

    function showLogin() {
        if (adminWrapper.style.display !== 'none') {
            adminWrapper.style.opacity = '0';
            setTimeout(() => {
                adminWrapper.style.display = 'none';
                loginContainer.style.display = 'flex';
                setTimeout(() => { loginContainer.style.opacity = '1'; }, 50);
            }, 500);
        } else {
            loginContainer.style.display = 'flex';
            loginContainer.style.opacity = '1';
        }
    }

    function updateRoleVisibility() {
        if (!currentUser) return;

        // Handle Role-Based UI
        const settingsTab = document.querySelector('[data-tab="tab-settings"]');
        const backupTab = document.querySelector('[data-tab="tab-backup"]');

        if (currentUser.role === 'client_admin') {
            if (settingsTab) settingsTab.style.display = 'none';
            if (backupTab) backupTab.style.display = 'none';
        } else {
            if (settingsTab) settingsTab.style.display = 'block';
            if (backupTab) backupTab.style.display = 'block';
        }
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

    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if (confirm("Are you sure you want to logout?")) {
                await supabase.auth.signOut();
            }
        });
    }

    if (mobileLogout) {
        mobileLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            if (confirm("Logout from Admin?")) {
                await supabase.auth.signOut();
            }
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

        // Initial Fetch
        const [products, orders] = await Promise.all([
            getProducts(),
            getOrders()
        ]);

        productsList = products;
        updateStats(orders);
        renderProductsTable();
        renderOrdersTable(orders);

        productsSubscriptionCleanup = subscribeToProducts((updatedProducts) => {
            productsList = updatedProducts;
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
                if (!cat.includes('::')) {
                    opt.textContent = cat;
                    opt.style.fontWeight = 'bold';
                } else {
                    const sub = cat.split('::')[1];
                    if (sub.includes(' - ')) {
                        opt.textContent = `　　└─ ${sub.split(' - ')[1]}`;
                        opt.style.fontSize = '0.9rem';
                        opt.style.opacity = '0.8';
                    } else {
                        opt.textContent = `─ ${sub}`;
                    }
                }
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
                    if (sub.includes(' - ')) {
                        opt.textContent = `└─ ${sub.split(' - ')[1]}`;
                        opt.style.paddingLeft = '1rem';
                    } else {
                        opt.textContent = sub;
                    }
                    subCatSelect.appendChild(opt);
                });
            };
        }
    }

    function showToast(msg = "Changes saved successfully!", isError = false) {
        let toast = document.getElementById('save-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'save-toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        if (isError) {
            toast.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
            toast.style.borderColor = '#ef4444';
            toast.style.color = '#ef4444';
        } else {
            toast.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
            toast.style.borderColor = '#10b981';
            toast.style.color = '#10b981';
        }
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.style = '', 300); // reset styles after fade out
        }, 3000);
    }

    function updateStats(orders = []) {
        document.getElementById('stat-total-products').textContent = productsList.length;
        document.getElementById('stat-total-orders').textContent = orders.length;
    }

    // --- Orders Management ---
    async function renderOrdersTable(orders) {
        if (!orders) orders = await getOrders();
        const tbody = document.getElementById('admin-orders-list');
        const filter = document.getElementById('admin-order-filter')?.value || 'all';

        tbody.innerHTML = '';

        let filtered = orders.filter(o => filter === 'all' || o.status === filter);

        // Sort by newest
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        filtered.forEach(o => {
            const tr = document.createElement('tr');
            const date = new Date(o.created_at).toLocaleDateString();
            const sourceBadge = o.source === 'whatsapp'
                ? '<span class="badge" style="background: #25D366; color:white;"><i class="fab fa-whatsapp"></i> WA</span>'
                : '<span class="badge" style="background: var(--accent); color:white;"><i class="fas fa-globe"></i> Direct</span>';

            const statusClass = `status-${o.status}`; // You might need to add these classes to admin.css

            tr.innerHTML = `
                <td>#${o.id}</td>
                <td>
                    <div style="font-weight:600;">${o.customer_name}</div>
                    <div style="font-size:0.8rem; color:var(--text-muted);">${o.customer_phone}</div>
                </td>
                <td>Rs. ${o.total_amount.toLocaleString()}</td>
                <td>${sourceBadge}</td>
                <td><span class="order-status-pill ${o.status}">${o.status}</span></td>
                <td>${date}</td>
                <td>
                    <button class="action-btn view-order" data-id="${o.id}"><i class="fas fa-eye"></i></button>
                    <button class="action-btn update-status" data-id="${o.id}"><i class="fas fa-sync"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.view-order').forEach(btn => btn.addEventListener('click', () => {
            const order = orders.find(o => o.id == btn.getAttribute('data-id'));
            openOrderDetail(order);
        }));

        tbody.querySelectorAll('.update-status').forEach(btn => btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            const order = orders.find(o => o.id == id);
            const nextStatus = order.status === 'pending' ? 'contacted' : (order.status === 'contacted' ? 'completed' : 'pending');
            if (confirm(`Change status to ${nextStatus}?`)) {
                await updateOrderStatus(id, nextStatus);
                showToast("Status updated");
                initDashboard(); // Refresh
            }
        }));
    }

    function openOrderDetail(o) {
        const modal = document.getElementById('order-detail-modal');
        const content = document.getElementById('order-detail-content');

        content.innerHTML = `
            <div class="order-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div>
                    <h4>Customer Information</h4>
                    <p><strong>Name:</strong> ${o.customer_name}</p>
                    <p><strong>Phone:</strong> ${o.customer_phone}</p>
                    <p><strong>Address:</strong> ${o.customer_address || 'Not provided'}</p>
                </div>
                <div>
                    <h4>Order Info</h4>
                    <p><strong>Order ID:</strong> #${o.id}</p>
                    <p><strong>Source:</strong> ${o.source}</p>
                    <p><strong>Date:</strong> ${new Date(o.created_at).toLocaleString()}</p>
                </div>
            </div>
            <div style="margin-top: 2rem;">
                <h4>Product List</h4>
                <table style="width:100%; margin-top: 1rem; border-collapse: collapse;">
                    <thead style="background: rgba(255,255,255,0.05);">
                        <tr>
                            <th style="padding: 10px; text-align: left;">Item</th>
                            <th style="padding: 10px; text-align: center;">Qty</th>
                            <th style="padding: 10px; text-align: right;">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${o.items.map(i => `
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid var(--border);">${i.name}</td>
                                <td style="padding: 10px; border-bottom: 1px solid var(--border); text-align: center;">${i.qty}</td>
                                <td style="padding: 10px; border-bottom: 1px solid var(--border); text-align: right;">${i.price}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="2" style="padding: 10px; text-align: right; font-weight: 700;">Total</td>
                            <td style="padding: 10px; text-align: right; font-weight: 700; color: var(--accent);">Rs. ${o.total_amount.toLocaleString()}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        modal.style.display = 'flex';

        document.getElementById('btn-mark-contacted').onclick = async () => {
            await updateOrderStatus(o.id, 'contacted');
            modal.style.display = 'none';
            initDashboard();
        };

        document.getElementById('btn-mark-completed').onclick = async () => {
            await updateOrderStatus(o.id, 'completed');
            modal.style.display = 'none';
            initDashboard();
        };
    }

    const closeOrderBtn = document.getElementById('close-order-modal');
    if (closeOrderBtn) closeOrderBtn.onclick = () => document.getElementById('order-detail-modal').style.display = 'none';

    document.getElementById('admin-order-filter')?.addEventListener('change', () => renderOrdersTable());

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
                    ${subCategories.map(sub => {
                const isSubSub = sub.includes(' - ');
                const displayName = isSubSub ? sub.split(' - ')[1] : sub;
                const indentStyle = isSubSub ? 'margin-left: 1.5rem; opacity: 0.8; font-size: 0.9em; border-left: 1px solid var(--border); padding-left: 0.8rem;' : '';
                const icon = isSubSub ? '<i class="fas fa-minus" style="font-size: 0.7em; margin-right: 5px;"></i>' : '';

                return `
                            <div class="tree-sub-node" style="${indentStyle}">
                                <span>${icon}${displayName}</span>
                                <div class="tree-actions">
                                    <button class="delete-btn" data-cat="${main}::${sub}" title="Delete Category"><i class="fas fa-times"></i></button>
                                </div>
                            </div>
                        `;
            }).join('')}
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

    // --- Form Tab Logic ---
    const btnSave = document.getElementById('btn-save-product');
    const steps = document.querySelectorAll('.form-step');
    const indicatorSteps = document.querySelectorAll('.step-indicator .step');

    function goToStep(stepNumber) {
        currentStep = stepNumber;
        steps.forEach((s, idx) => s.classList.toggle('active', idx + 1 === currentStep));
        indicatorSteps.forEach((s, idx) => {
            s.classList.toggle('active', idx + 1 === currentStep);
            s.classList.toggle('completed', false); // No longer marking as "completed", just tabs
        });

        if (window.innerWidth <= 600) document.querySelector('.modal-content').scrollTo({ top: 0, behavior: 'smooth' });
    }

    indicatorSteps.forEach((stepIndicator, idx) => {
        stepIndicator.addEventListener('click', () => {
            goToStep(idx + 1);
        });
    });

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
                document.getElementById('prod-featured').checked = p.isFeatured || false;
                document.getElementById('prod-add-to-cart').checked = p.add_to_cart ?? true;
                document.getElementById('prod-buy-now').checked = p.buy_now ?? true;
                document.getElementById('prod-whatsapp-inquiry').checked = p.whatsapp_inquiry ?? true;
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
            showOnHomepage: document.getElementById('prod-homepage').checked,
            isFeatured: document.getElementById('prod-featured').checked,
            add_to_cart: document.getElementById('prod-add-to-cart').checked,
            buy_now: document.getElementById('prod-buy-now').checked,
            whatsapp_inquiry: document.getElementById('prod-whatsapp-inquiry').checked
        };

        const originalBtnHtml = btnSave.innerHTML;
        try {
            btnSave.disabled = true;
            btnSave.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            if (currentEditId) await updateProduct(currentEditId, productData);
            else await addProduct(productData);
            modal.classList.remove('active');
            showToast("Product saved successfully!");
        } catch (error) {
            showToast(error.message, true);
        } finally {
            btnSave.disabled = false;
            btnSave.innerHTML = originalBtnHtml;
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

    // --- Hero and Logo Image Handlers ---
    const heroInput = document.getElementById('set-hero-image-file');
    if (heroInput) {
        heroInput.addEventListener('change', async (e) => {
            if (!e.target.files.length) return;
            const pBar = document.getElementById('hero-upload-progress');
            try {
                const url = await processAndUploadImage(e.target.files[0], 'heroes', pBar);
                document.getElementById('set-hero-image').value = url;
                document.getElementById('hero-preview-container').innerHTML = `<img src="${url}">`;
                showToast("Hero image uploaded! Don't forget to click Save Settings.");
            } catch (err) {
                showToast("Upload failed: " + err.message, true);
                if (pBar) pBar.style.display = 'none';
            }
        });
    }

    const logoInput = document.getElementById('set-logo-file');
    if (logoInput) {
        logoInput.addEventListener('change', async (e) => {
            if (!e.target.files.length) return;
            const pBar = document.getElementById('logo-upload-progress');
            try {
                const url = await processAndUploadImage(e.target.files[0], 'logos', pBar);
                document.getElementById('set-logo').value = url;
                document.getElementById('logo-preview-container').innerHTML = `<img src="${url}">`;
                showToast("Logo uploaded! Don't forget to click Save Settings.");
            } catch (err) {
                showToast("Upload failed: " + err.message, true);
                if (pBar) pBar.style.display = 'none';
            }
        });
    }

    document.getElementById('settings-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const settingsBtn = e.target.querySelector('button[type="submit"]');
        const originalText = settingsBtn.innerHTML;
        settingsBtn.disabled = true;
        settingsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        const data = {
            siteName: document.getElementById('set-name').value.trim(),
            slogan: document.getElementById('set-slogan').value.trim(),
            heroHeadline: document.getElementById('set-hero-headline').value.trim(),
            heroSubtitle: document.getElementById('set-hero-subtitle').value.trim(),
            heroImage: document.getElementById('set-hero-image').value,
            logo: document.getElementById('set-logo').value,
            primaryColor: document.getElementById('set-primary-color').value,
            secondaryColor: document.getElementById('set-secondary-color').value,
            whatsapp: cleanWhatsApp(document.getElementById('set-whatsapp').value.trim()),
            phones: document.getElementById('set-phones').value.split(',').map(s => s.trim()),
            address: document.getElementById('set-address').value.trim(),
            facebook: document.getElementById('set-facebook').value.trim(),
            instagram: document.getElementById('set-instagram').value.trim()
        };

        try {
            await updateBusinessInfo(data);
            showToast("Settings updated successfully!");
        } catch (error) {
            showToast("Failed to save settings: " + error.message, true);
        } finally {
            settingsBtn.disabled = false;
            settingsBtn.innerHTML = originalText;
        }
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
