import { supabase } from './supabase-config.js';

// --- Local Cache & Storage Helpers ---
let productsCache = [];
let categoriesCache = [];
let businessInfoCache = null;

const CACHE_KEY_BUSINESS = 'noorent_business_info';
const CACHE_KEY_CATEGORIES = 'noorent_categories';
const CACHE_TTL = 3600000; // 1 hour in ms

function setStorageCache(key, data) {
    try {
        const cacheObj = {
            timestamp: Date.now(),
            data: data
        };
        localStorage.setItem(key, JSON.stringify(cacheObj));
    } catch (e) {
        console.warn("Storage cache failed", e);
    }
}

function getStorageCache(key) {
    try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;
        const cacheObj = JSON.parse(cached);
        if (Date.now() - cacheObj.timestamp > CACHE_TTL) {
            localStorage.removeItem(key);
            return null;
        }
        return cacheObj.data;
    } catch (e) {
        return null;
    }
}

// --- DB Operations (Supabase) ---

/**
 * Helper to clean WhatsApp numbers for URL usage
 * Removes +, spaces, dashes and non-digit characters
 * Ensures it starts with country code (defaults to 92 if 10 digits without leading 0)
 */
export function cleanWhatsApp(number) {
    if (!number) return '';
    let cleaned = number.toString().replace(/\D/g, '');
    
    // Logic for Pakistan numbers: 0321... -> 92321...
    if (cleaned.startsWith('0') && cleaned.length === 11) {
        cleaned = '92' + cleaned.substring(1);
    }
    // If it's already 10 digits and doesn't start with 92, assume it needs 92
    else if (cleaned.length === 10 && !cleaned.startsWith('92')) {
        cleaned = '92' + cleaned;
    }
    
    return cleaned;
}

/**
 * Fetches Business Info (Settings) from Supabase
 */
export async function getBusinessInfo(forceRefresh = false) {
    if (businessInfoCache && !forceRefresh) return businessInfoCache;
    
    // Check localStorage
    const saved = getStorageCache(CACHE_KEY_BUSINESS);
    if (saved && !forceRefresh) {
        businessInfoCache = saved;
        return businessInfoCache;
    }

    try {
        // 1. Fetch from settings table
        // Note: We use available columns: id, name, slogan, whatsapp, phones, address, hero_headline, hero_subtitle, hero_image_url, facebook, instagram
        let { data: list, error } = await supabase.from('settings').select('*').limit(1);

        // 2. Handle Empty Table (Bootstrap)
        if (!error && (!list || list.length === 0)) {
            console.log("Settings table is empty. Initializing with default row...");
            const defaults = getDefaultBusinessInfo();
            const payload = {
                id: 1,
                name: defaults.name,
                slogan: defaults.slogan,
                whatsapp: defaults.whatsapp,
                phones: defaults.phones,
                address: defaults.address,
                hero_headline: defaults.heroHeadline,
                hero_subtitle: defaults.heroSubtitle,
                hero_image_url: defaults.heroImage,
                facebook: defaults.facebook,
                instagram: defaults.instagram
                // logo_url, site_name, primary_color, secondary_color are missing in schema
            };
            
            const insertResult = await supabase.from('settings').insert([payload]).select();
            if (!insertResult.error && insertResult.data) {
                list = insertResult.data;
            } else {
                console.warn("Bootstrap failed (likely missing columns), using in-memory defaults.");
                list = [payload];
            }
        }

        if (error || !list || list.length === 0) {
            console.warn("Supabase fetch failed, using defaults.");
            businessInfoCache = getDefaultBusinessInfo();
            return businessInfoCache;
        }

        const data = list[0];
        
        businessInfoCache = {
            name: data.name || "NOORENTERPRISES (Noor.Ent)",
            slogan: data.slogan || "Digital Shepherd - Technology Trading",
            whatsapp: data.whatsapp || "923216916909",
            phones: data.phones || ["+923216916909", "03006908486"],
            address: data.address || "M21, M22 Saeed Center, Fraid Town Road, Sahiwal",
            heroHeadline: data.hero_headline || "Modern IT & POS Solutions",
            heroSubtitle: data.hero_subtitle || "Empowering your business with top-tier technology.",
            heroImage: data.hero_image_url || null,
            facebook: data.facebook || "https://www.facebook.com/profile.php?id=100076568414908",
            instagram: data.instagram || "https://www.instagram.com/official.noor.ent/",
            // Fallbacks for missing columns in schema
            logo: data.logo_url || null, 
            primaryColor: data.primary_color || '#4f8ef7',
            secondaryColor: data.secondary_color || '#050818',
            siteName: data.site_name || data.name || 'NOORENTERPRISES'
        };

        setStorageCache(CACHE_KEY_BUSINESS, businessInfoCache);
        return businessInfoCache;
    } catch (error) {
        console.error("Error fetching business info from Supabase:", error);
        return getDefaultBusinessInfo();
    }
}

function getDefaultBusinessInfo() {
    return {
        name: "NOORENTERPRISES (Noor.Ent)",
        slogan: "Digital Shepherd - Technology Trading",
        whatsapp: "+923216916909",
        phones: ["+923216916909", "03006908486"],
        facebook: "https://www.facebook.com/profile.php?id=100076568414908",
        instagram: "https://www.instagram.com/official.noor.ent/",
        address: "M21, M22 Saeed Center, Fraid Town Road, Sahiwal",
        heroHeadline: "Modern IT & POS Solutions",
        heroSubtitle: "Empowering your business with top-tier technology.",
        heroImage: null,
        logo: null,
        primaryColor: '#4f8ef7',
        secondaryColor: '#050818',
        siteName: 'NOORENTERPRISES'
    };
}

/**
 * Updates Business Info in Supabase
 */
export async function updateBusinessInfo(businessData) {
    try {
        const payload = {
            name: businessData.name,
            slogan: businessData.slogan,
            hero_headline: businessData.heroHeadline,
            hero_subtitle: businessData.heroSubtitle,
            hero_image_url: businessData.heroImage,
            whatsapp: businessData.whatsapp,
            phones: businessData.phones,
            address: businessData.address,
            facebook: businessData.facebook,
            instagram: businessData.instagram,
            logo_url: businessData.logo,
            primary_color: businessData.primaryColor,
            secondary_color: businessData.secondaryColor,
            site_name: businessData.siteName
        };

        const { data, error } = await supabase
            .from('settings')
            .upsert({ id: 1, ...payload })
            .select();

        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Settings update failed due to database permissions.");
        
        businessInfoCache = businessData;
        setStorageCache(CACHE_KEY_BUSINESS, businessInfoCache);
        return true;
    } catch (error) {
        console.error("Error updating business info in Supabase:", error);
        throw error;
    }
}

/**
 * Fetches Categories from Supabase
 */
export async function getCategories(forceRefresh = false) {
    if (categoriesCache.length > 0 && !forceRefresh) return categoriesCache;

    const saved = getStorageCache(CACHE_KEY_CATEGORIES);
    if (saved && !forceRefresh) {
        categoriesCache = saved;
        return categoriesCache;
    }
    
    try {
        // Add timeout
        const fetchPromise = supabase
            .from('categories')
            .select('name');
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Categories fetch timeout")), 5000)
        );

        const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
            
        if (error) throw error;

        
        // If no categories in DB, return defaults
        if (!data || data.length === 0) {
            categoriesCache = [
                "POS",
                "Printers",
                "Printers::LaserJet Printers",
                "Printers::Thermal Printers",
                "Printers::Barcode Printers",
                "Scanners",
                "Laptops",
                "Accessories",
                "Accessories::Power Cables",
                "Accessories::VGA Cables",
                "Accessories::Mouse",
                "Accessories::Keyboard",
                "Accessories::Mouse & Keyboard Set",
                "Accessories::Adapters & Chargers",
                "Accessories::USB Flash Drives",
                "Accessories::Other Accessories",
                "Accessories::Adapters & Chargers - Adapter 12v 2a",
                "Accessories::Adapters & Chargers - Adapter 12v 3a",
                "Accessories::Adapters & Chargers - Adapter 12v 4a",
                "Accessories::Adapters & Chargers - Adapter 12v 5A",
                "Accessories::Adapters & Chargers - Adapter 12v 8a",
                "Accessories::Adapters & Chargers - Adapter 48v, 54v",
                "Accessories::Adapters & Chargers - Adapter Thermal 24v",
                "Accessories::Adapters & Chargers - Adapter Zebra 24v",
                "Accessories::Adapters & Chargers - Adapter 5v",
                "Accessories::Adapters & Chargers - Adapter Hp 130w",
                "Accessories::Adapters & Chargers - Adapter Dell XPS",
                "Printers::LaserJet Printers - Laserjet Printer 1136",
                "Printers::LaserJet Printers - Laserjet Printer 402",
                "Printers::LaserJet Printers - Laserjet Printer m15w",
                "Printers::LaserJet Printers - Laserjet Printer 1505",
                "Printers::LaserJet Printers - Laserjet Printer Canon 6030",
                "Printers::LaserJet Printers - Laserjet Printer E50145"
            ];
        } else {
            categoriesCache = data.map(c => c.name);
        }
        
        setStorageCache(CACHE_KEY_CATEGORIES, categoriesCache);
        return categoriesCache;
    } catch (error) {
        console.error("Error fetching categories from Supabase:", error);
        return [
            "POS",
            "Printers",
            "Printers::LaserJet Printers",
            "Printers::Thermal Printers",
            "Printers::Barcode Printers",
            "Scanners",
            "Laptops",
            "Accessories",
            "Accessories::Power Cables",
            "Accessories::VGA Cables",
            "Accessories::Mouse",
            "Accessories::Keyboard",
            "Accessories::Mouse & Keyboard Set",
            "Accessories::Adapters & Chargers",
            "Accessories::USB Flash Drives",
            "Accessories::Other Accessories",
            "Accessories::Adapters & Chargers - Adapter 12v 2a",
            "Accessories::Adapters & Chargers - Adapter 12v 3a",
            "Accessories::Adapters & Chargers - Adapter 12v 4a",
            "Accessories::Adapters & Chargers - Adapter 12v 5A",
            "Accessories::Adapters & Chargers - Adapter 12v 8a",
            "Accessories::Adapters & Chargers - Adapter 48v, 54v",
            "Accessories::Adapters & Chargers - Adapter Thermal 24v",
            "Accessories::Adapters & Chargers - Adapter Zebra 24v",
            "Accessories::Adapters & Chargers - Adapter 5v",
            "Accessories::Adapters & Chargers - Adapter Hp 130w",
            "Accessories::Adapters & Chargers - Adapter Dell XPS",
            "Printers::LaserJet Printers - Laserjet Printer 1136",
            "Printers::LaserJet Printers - Laserjet Printer 402",
            "Printers::LaserJet Printers - Laserjet Printer m15w",
            "Printers::LaserJet Printers - Laserjet Printer 1505",
            "Printers::LaserJet Printers - Laserjet Printer Canon 6030",
            "Printers::LaserJet Printers - Laserjet Printer E50145"
        ];
    }
}

/**
 * Updates Categories in Supabase (syncs list)
 */
export async function updateCategories(categoriesList) {
    try {
        // Simple approach: delete all and insert new ones
        await supabase.from('categories').delete().neq('id', 0); // Delete all
        const rows = categoriesList.map(name => ({ name }));
        const { error } = await supabase.from('categories').insert(rows);
        if (error) throw error;
        categoriesCache = categoriesList;
        setStorageCache(CACHE_KEY_CATEGORIES, categoriesCache);
        return true;
    } catch (error) {
        console.error("Error updating categories in Supabase:", error);
        throw error;
    }
}

/**
 * Fetches all Products from Supabase
 */
export async function getProducts(forceRefresh = false) {
    if (productsCache.length > 0 && !forceRefresh) return productsCache;
    
    try {
        const { data, error } = await supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        const products = data.map(item => mapSupabaseProduct(item));
        productsCache = products;
        return productsCache;
    } catch (error) {
        console.error("Error fetching products from Supabase:", error);
        return productsCache;
    }
}

/**
 * Real-time subscription to products with Delta Updates
 */
export function subscribeToProducts(callback) {
    const channel = supabase
        .channel('products-delta')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, (payload) => {
            const { eventType, new: newItem, old: oldItem } = payload;
            
            if (eventType === 'INSERT') {
                const mapped = mapSupabaseProduct(newItem);
                productsCache = [mapped, ...productsCache];
            } else if (eventType === 'UPDATE') {
                productsCache = productsCache.map(p => p.id === newItem.id ? mapSupabaseProduct(newItem) : p);
            } else if (eventType === 'DELETE') {
                productsCache = productsCache.filter(p => p.id !== oldItem.id);
            }
            
            callback([...productsCache]);
        })
        .subscribe();
        
    // Initial fetch
    getProducts().then(callback);
    
    return () => {
        supabase.removeChannel(channel);
    };
}

/**
 * Add a new product
 */
export async function addProduct(productData) {
    try {
        const payload = {
            name: productData.name,
            brand: productData.brand,
            model_number: productData.modelNumber,
            category: productData.category,
            description: productData.description,
            price: productData.price,
            show_price: productData.showPrice,
            stock_status: productData.stockStatus,
            image_url: productData.image,
            images: productData.images || [],
            show_on_homepage: productData.showOnHomepage ?? true,
            availability: productData.stockStatus === 'In Stock',
            warranty: productData.warranty,
            add_to_cart: productData.add_to_cart ?? true,
            buy_now: productData.buy_now ?? true,
            whatsapp_inquiry: productData.whatsapp_inquiry ?? true
        };
        
        const { data, error } = await supabase
            .from('products')
            .insert(payload)
            .select();
            
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error("Error adding product to Supabase:", error);
        throw error;
    }
}

/**
 * Update existing product
 */
export async function updateProduct(id, productData) {
    try {
        const payload = {
            name: productData.name,
            brand: productData.brand,
            model_number: productData.modelNumber,
            category: productData.category,
            description: productData.description,
            price: productData.price,
            show_price: productData.showPrice,
            stock_status: productData.stockStatus,
            image_url: productData.image,
            images: productData.images || [],
            show_on_homepage: productData.showOnHomepage ?? true,
            availability: productData.stockStatus === 'In Stock',
            warranty: productData.warranty,
            add_to_cart: productData.add_to_cart ?? true,
            buy_now: productData.buy_now ?? true,
            whatsapp_inquiry: productData.whatsapp_inquiry ?? true
        };
        
        const { data, error } = await supabase
            .from('products')
            .update(payload)
            .eq('id', id)
            .select();
            
        if (error) throw error;
        if (!data || data.length === 0) throw new Error("Product update failed due to database permissions or missing record.");
        return true;
    } catch (error) {
        console.error("Error updating product in Supabase:", error);
        throw error;
    }
}

/**
 * Delete product
 */
export async function deleteProduct(id) {
    try {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        return true;
    } catch (error) {
        console.error("Error deleting product from Supabase:", error);
        throw error;
    }
}

/**
 * Submits a new lead to Supabase
 */
export async function addLead(leadData) {
    try {
        const { data, error } = await supabase
            .from('leads')
            .insert(leadData)
            .select();
            
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error("Error submitting lead to Supabase:", error);
        throw error;
    }
}

/**
 * Fetch all orders for the admin
 */
export async function getOrders() {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .order('created_at', { ascending: false });
            
        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error("Error fetching orders:", error);
        return [];
    }
}

/**
 * Update the status of an order
 */
export async function updateOrderStatus(id, status) {
    try {
        const { data, error } = await supabase
            .from('orders')
            .update({ status: status })
            .eq('id', id)
            .select();
            
        if (error) throw error;
        return data[0];
    } catch (error) {
        console.error("Error updating order status:", error);
        throw error;
    }
}

// Map Supabase format to internal App format
function mapSupabaseProduct(item) {
    return {
        id: item.id,
        name: item.name,
        brand: item.brand,
        modelNumber: item.model_number,
        category: item.category,
        description: item.description || "",
        price: item.price || "",
        showPrice: item.show_price,
        stockStatus: item.stock_status || (item.availability ? "In Stock" : "Out of Stock"),
        availability: item.availability,
        image: item.image_url || "",
        images: item.images || [],
        showOnHomepage: item.show_on_homepage ?? true,
        warranty: item.warranty || "",
        add_to_cart: item.add_to_cart ?? true,
        buy_now: item.buy_now ?? true,
        whatsapp_inquiry: item.whatsapp_inquiry ?? true
    };
}

/**
 * Fetches User Profile and Role
 */
export async function getUserProfile(providedUser = null) {
    try {
        const user = providedUser || (await supabase.auth.getUser()).data.user;
        if (!user) return null;

        // Add a timeout to prevent hanging on slow connections
        const profilePromise = supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Profile fetch timeout")), 5000)
        );

        const { data, error } = await Promise.race([profilePromise, timeoutPromise]);

        if (error) {
            console.warn("Profile fetch error:", error.message);
            return null;
        }
        return data;
    } catch (error) {
        console.error("Error fetching user profile:", error);
        return null;
    }
}


/**
 * Fetches Services
 */
export async function getServices() {
    return [
        { id: 1, title: "Hardware Repair", description: "Expert repair services for printers, laptops, and POS systems.", icon: "fas fa-tools" },
        { id: 2, title: "Maintenance & Support", description: "Ongoing IT support and maintenance for your business.", icon: "fas fa-headset" },
        { id: 3, title: "Installation & Setup", description: "Professional installation and setup of complete POS systems and networks.", icon: "fas fa-network-wired" }
    ];
}

/**
 * Placeholder for legacy migration
 */
export async function migrateFromLocalStorage() {
    console.log("Migration from local storage triggered, but Supabase is current master.");
    // Implementation could loop over local storage and add to Supabase if empty
}
