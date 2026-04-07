import { supabase } from './supabase-config.js';

// --- Local Cache ---
let productsCache = [];
let categoriesCache = [];
let businessInfoCache = null;

// --- DB Operations (Supabase) ---

/**
 * Fetches Business Info (Settings) from Supabase
 */
export async function getBusinessInfo(forceRefresh = false) {
    if (businessInfoCache && !forceRefresh) return businessInfoCache;
    
    try {
        const { data, error } = await supabase
            .from('settings')
            .select('*')
            .single();
            
        if (error) {
            if (error.code === 'PGRST116') {
                businessInfoCache = getDefaultBusinessInfo();
                return businessInfoCache;
            }
            throw error;
        }
        
        businessInfoCache = {
            name: data.name || "NOORENTERPRISES (Noor.Ent)",
            slogan: data.slogan || "Digital Shepherd - Technology Trading",
            whatsapp: data.whatsapp || "+923216916909",
            phones: data.phones || ["+923216916909", "03006908486"],
            address: data.address || "M21, M22 Saeed Center, Fraid Town Road, Sahiwal",
            heroHeadline: data.hero_headline || "Modern IT & POS Solutions",
            heroSubtitle: data.hero_subtitle || "Empowering your business with top-tier technology.",
            heroImage: data.hero_image_url || null,
            facebook: data.facebook || "https://www.facebook.com/profile.php?id=100076568414908",
            instagram: data.instagram || "https://www.instagram.com/official.noor.ent/",
            logo: data.logo_url || null,
            primaryColor: data.primary_color || '#4f8ef7',
            secondaryColor: data.secondary_color || '#050818',
            siteName: data.site_name || 'NOORENTERPRISES'
        };
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

        const { error } = await supabase
            .from('settings')
            .upsert({ id: 1, ...payload });

        if (error) throw error;
        businessInfoCache = businessData;
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
    
    try {
        const { data, error } = await supabase
            .from('categories')
            .select('name');
            
        if (error) throw error;
        categoriesCache = data.map(c => c.name);
        return categoriesCache;
    } catch (error) {
        console.error("Error fetching categories from Supabase:", error);
        return ["POS", "Printers", "Scanners", "Laptops", "Accessories"];
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
 * Real-time subscription to products
 */
export function subscribeToProducts(callback) {
    const channel = supabase
        .channel('products_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, async () => {
            const products = await getProducts(true);
            callback(products);
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
            warranty: productData.warranty
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
            warranty: productData.warranty
        };
        
        const { error } = await supabase
            .from('products')
            .update(payload)
            .eq('id', id);
            
        if (error) throw error;
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
        warranty: item.warranty || ""
    };
}

/**
 * Fetches User Profile and Role
 */
export async function getUserProfile() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (error) throw error;
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
