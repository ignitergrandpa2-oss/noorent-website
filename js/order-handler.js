import { supabase } from './supabase-config.js';
import { cart } from './cart.js';

/**
 * Handles order submission logic for both WhatsApp and Direct methods.
 */
export async function placeOrder(customerData, method = 'whatsapp') {
    const items = cart.items;
    const totalAmount = cart.getTotal();
    
    // 1. Prepare Order Data
    const orderData = {
        customer_name: customerData.name,
        customer_phone: customerData.phone,
        customer_address: customerData.address || '',
        items: items.map(item => ({
            id: item.id,
            name: item.name,
            qty: item.qty,
            price: item.price
        })),
        total_amount: totalAmount,
        source: method,
        status: 'pending',
        order_number: `ORD-${Date.now().toString().slice(-6)}` // Simple fallback if trigger fails
    };

    try {
        // 2. Save to Supabase (CRITICAL: Must happen before any redirect)
        const { data, error } = await supabase
            .from('orders')
            .insert([orderData])
            .select();

        if (error) throw error;
        
        const savedOrder = data[0];

        // 3. Handle Method Specific Actions
        if (method === 'whatsapp') {
            const { cleanWhatsApp } = await import('./data.js');
            const businessPhone = cleanWhatsApp(customerData.businessWhatsapp);
            if (!businessPhone) {
                alert("Store WhatsApp number is not configured. Please contact the administrator.");
                return;
            }
            const msg = cart.generateWhatsAppMessage();
            window.open(`https://wa.me/${businessPhone}?text=${msg}`, '_blank');
        } else {
            // Direct Order - Email is sent via Supabase Webhook automatically
            // We just return success to the UI
        }

        // 4. Clear Cart on success
        cart.clear();
        
        return savedOrder;
    } catch (error) {
        console.error("Order submission failed:", error);
        throw error;
    }
}
