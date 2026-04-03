// Strapi API Configuration
const STRAPI_URL = window.location.hostname === 'localhost' ? 'http://localhost:1337' : ''; // Update with your production Strapi URL
const API_URL = `${STRAPI_URL}/api`;

// --- DB Operations (Strapi REST API) ---

/**
 * Fetches Home Page data from Strapi
 */
export async function getBusinessInfo() {
    try {
        const response = await fetch(`${API_URL}/home?populate=*`);
        const result = await response.json();
        
        if (result.data) {
            const attr = result.data;
            return {
                name: "NOORENTERPRISES (Noor.Ent)", // Default or from metadata if added
                slogan: attr.HeroSubtitle || "Digital Shepherd - Technology Trading",
                whatsapp: attr.WhatsAppNumber || "+923216916909",
                phones: attr.ContactPhones ? attr.ContactPhones.split(',') : ["+923216916909", "03006908486"],
                address: attr.Address || "M21, M22 Saeed Center, Fraid Town Road, Sahiwal",
                heroHeadline: attr.HeroHeadline,
                heroSubtitle: attr.HeroSubtitle,
                heroImage: attr.HeroImages && attr.HeroImages.length > 0 ? `${STRAPI_URL}${attr.HeroImages[0].url}` : null,
                facebook: "https://www.facebook.com/profile.php?id=100076568414908",
                instagram: "https://www.instagram.com/official.noor.ent/"
            };
        }
    } catch (error) {
        console.error("Error fetching business info from Strapi:", error);
    }
    
    // Fallback if Strapi is not reachable or unconfigured
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
        heroImage: null
    };
}

/**
 * Fetches Categories (derived from Product enumeration in this simple setup)
 */
export async function getCategories() {
    // In a full setup, you might have a separate Categories collection. 
    // For now, we return fixed categories or fetch distinct ones from products.
    return ["POS", "Printers", "Scanners", "Laptops", "Accessories"];
}

/**
 * Fetches all Products from Strapi
 */
export async function getProducts() {
    try {
        const response = await fetch(`${API_URL}/products?populate=*`);
        const result = await response.json();
        
        if (result.data) {
            return result.data.map(item => mapStrapiProduct(item));
        }
    } catch (error) {
        console.error("Error fetching products from Strapi:", error);
    }
    return [];
}

/**
 * Real-time subscription placeholder (Strapi doesn't support native REST websockets same as Firebase, 
 * so we fallback to a simple poll or just initial fetch)
 */
export function subscribeToProducts(callback) {
    getProducts().then(callback);
    // Real-time could be implemented via Strapi's Socket.io support or similar if needed.
    return () => {}; // Cleanup function dummy
}

/**
 * Submits a new lead to Strapi
 */
export async function addLead(leadData) {
    try {
        const response = await fetch(`${API_URL}/leads`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ data: leadData }),
        });
        return await response.json();
    } catch (error) {
        console.error("Error submitting lead to Strapi:", error);
        throw error;
    }
}

// Map Strapi format to internal App format
function mapStrapiProduct(item) {
    const attr = item;
    return {
        id: item.documentId || item.id,
        name: attr.Name,
        brand: attr.Brand,
        modelNumber: attr.ModelNumber,
        category: attr.Category,
        description: attr.Specifications || "", // Mapping specifications to description for simplicity
        price: attr.Price ? `Rs ${attr.Price.toLocaleString()}` : "",
        showPrice: !!attr.Price,
        stockStatus: attr.InStock ? "In Stock" : "Out of Stock",
        image: attr.Images && attr.Images.length > 0 ? `${STRAPI_URL}${attr.Images[0].url}` : ""
    };
}

/**
 * Fetches Services (can be static or fetched from Strapi if you add a collection)
 */
export async function getServices() {
    return [
        { id: 1, title: "Hardware Repair", description: "Expert repair services for printers, laptops, and POS systems.", icon: "fas fa-tools" },
        { id: 2, title: "Maintenance & Support", description: "Ongoing IT support and maintenance for your business.", icon: "fas fa-headset" },
        { id: 3, title: "Installation & Setup", description: "Professional installation and setup of complete POS systems and networks.", icon: "fas fa-network-wired" }
    ];
}
