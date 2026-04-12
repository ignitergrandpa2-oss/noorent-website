import { supabase } from './supabase-config.js';
import { cart } from './cart.js';

/**
 * Handles order submission logic for both WhatsApp and Direct methods.
 */
export async function placeOrder(customerData, method = 'whatsapp') {
    const items = cart.items;
    const totalAmount = cart.getTotal();
    
    // 1. Prepare Order Data (Must match Supabase exactly)
    const orderData = {
        customer_name: customerData.name || "Unknown",
        customer_phone: customerData.phone || "N/A",
        customer_address: customerData.address || '',
        items: items.map(item => ({
            id: item.id,
            name: item.name,
            qty: item.qty,
            price: item.price
        })),
        total_amount: totalAmount,
        source: method,
        status: 'pending'
    };

    try {
        console.log("Submitting order payload:", orderData);
        
        // 2. Save to Supabase (CRITICAL: Must happen before any redirect)
        const { data, error } = await supabase
            .from('orders')
            .insert([orderData]);

        if (error) {
            console.error("Supabase Database Error:", error);
            // Check for specific error codes if needed (e.g., 42501 is RLS violation)
            if (error.code === '42501') {
                throw new Error("Missing database permissions (RLS). Please contact admin.");
            }
            throw new Error(`Database submission failed: ${error.message}`);
        }
        
        // 3. Handle Method Specific Actions
        if (method === 'whatsapp') {
            const { cleanWhatsApp } = await import('./data.js');
            const businessPhone = cleanWhatsApp(customerData.businessWhatsapp);
            if (!businessPhone) {
                console.warn("Business WhatsApp missing, order saved but redirect failed.");
            } else {
                const msg = cart.generateWhatsAppMessage();
                window.open(`https://wa.me/${businessPhone}?text=${msg}`, '_blank');
            }
        }

        // 4. Clear Cart on success
        cart.clear();
        
        return true;
    } catch (error) {
        console.error("Detailed Order Submission Failure:", error);
        throw error;
    }
}
