import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const handler = async (req: Request): Promise<Response> => {
  try {
    const payload = await req.json();
    const { record } = payload; // Supabase Webhook payload structure

    if (!record) {
      return new Response("No record found in payload", { status: 400 });
    }

    // Only send email for direct orders (already filtered by webhook usually, but good to be safe)
    if (record.source !== "direct") {
      return new Response("Not a direct order, skipping email.", { status: 200 });
    }

    const items = record.items || [];
    const itemsHtml = items.map((item: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${item.qty}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${item.price}</td>
      </tr>
    `).join("");

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #4F8EF7; border-bottom: 2px solid #4F8EF7; padding-bottom: 10px;">New Direct Order #${record.id}</h2>
        <p>A new order has been placed on <strong>NOORENTERPRISES</strong>.</p>
        
        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Customer Details</h3>
          <p style="margin: 5px 0;"><strong>Name:</strong> ${record.customer_name}</p>
          <p style="margin: 5px 0;"><strong>Phone:</strong> ${record.customer_phone}</p>
          <p style="margin: 5px 0;"><strong>Address:</strong> ${record.customer_address || "N/A"}</p>
        </div>

        <h3>Order Summary</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #eee;">
              <th style="padding: 10px; text-align: left;">Item</th>
              <th style="padding: 10px;">Qty</th>
              <th style="padding: 10px; text-align: right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding: 10px; text-align: right; font-weight: bold;">Total Amount</td>
              <td style="padding: 10px; text-align: right; font-weight: bold; color: #4F8EF7;">${record.total_amount}</td>
            </tr>
          </tfoot>
        </table>

        <p style="margin-top: 30px; font-size: 0.9em; color: #777;">
          Please log in to the <a href="https://noorent-website.vercel.app/admin.html">Admin Panel</a> to manage this order.
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Noor Enterprises <onboarding@resend.dev>",
        to: ["official.noor.ent@gmail.com"],
        subject: `New Direct Order #${record.id} - ${record.customer_name}`,
        html: emailHtml,
      }),
    });

    const result = await res.json();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};

serve(handler);
