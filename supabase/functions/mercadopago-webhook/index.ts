import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Handle both query params (IPN) and JSON body (webhooks)
    const url = new URL(req.url);
    let topic = url.searchParams.get("topic") || url.searchParams.get("type");
    let resourceId = url.searchParams.get("id");

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // Query param notification (IPN style)
    }

    if (body.type) topic = body.type as string;
    if (body.data && (body.data as any).id) resourceId = String((body.data as any).id);

    console.log("Webhook received - topic:", topic, "id:", resourceId, "body:", JSON.stringify(body));

    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      console.error("MERCADOPAGO_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "Config error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle merchant_order notifications (from Checkout Pro)
    if (topic === "merchant_order" && resourceId) {
      const orderRes = await fetch(
        `https://api.mercadopago.com/merchant_orders/${resourceId}`,
        { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
      );
      const order = await orderRes.json();
      console.log("Merchant order status:", order.order_status, "external_ref:", order.external_reference);

      if (order.order_status === "paid") {
        await processPayment(adminClient, order.external_reference, order.payments?.[0]?.id);
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle payment notifications
    if ((topic === "payment" || body.action === "payment.updated" || body.action === "payment.created") && resourceId) {
      const mpResponse = await fetch(
        `https://api.mercadopago.com/v1/payments/${resourceId}`,
        { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
      );
      const payment = await mpResponse.json();
      console.log("Payment status:", payment.status, "external_ref:", payment.external_reference);

      if (payment.status === "approved") {
        await processPayment(adminClient, payment.external_reference, payment.id);
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unknown notification type
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processPayment(adminClient: any, purchaseId: string, paymentId?: string | number) {
  if (!purchaseId) {
    console.error("No purchaseId to process");
    return;
  }

  const { data: purchase } = await adminClient
    .from("purchases")
    .select("*")
    .eq("id", purchaseId)
    .single();

  if (!purchase) {
    console.error("Purchase not found:", purchaseId);
    return;
  }

  if (purchase.status === "completed") {
    console.log("Already processed:", purchaseId);
    return;
  }

  // Update purchase to completed
  await adminClient
    .from("purchases")
    .update({ status: "completed", payment_id: paymentId ? String(paymentId) : null })
    .eq("id", purchaseId);

  // Get script for license duration
  const { data: script } = await adminClient
    .from("scripts")
    .select("id, title, license_duration_days")
    .eq("id", purchase.script_id)
    .single();

  // Generate license key
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let licenseKey = "";
  for (let i = 0; i < 3; i++) {
    if (i > 0) licenseKey += "-";
    for (let j = 0; j < 4; j++) {
      licenseKey += chars[Math.floor(Math.random() * chars.length)];
    }
  }

  const durationDays = script?.license_duration_days;
  const expiresAt = durationDays
    ? new Date(Date.now() + durationDays * 86400000).toISOString()
    : null;

  await adminClient.from("licenses").insert({
    user_id: purchase.user_id,
    script_id: purchase.script_id,
    purchase_id: purchaseId,
    license_key: licenseKey,
    status: "active",
    expires_at: expiresAt,
  });

  // Notify buyer
  await adminClient.from("notifications").insert({
    user_id: purchase.user_id,
    title: "✅ Pagamento confirmado!",
    message: `Seu pagamento para "${script?.title}" foi aprovado. Chave: ${licenseKey}`,
    type: "success",
    link: `/script/${purchase.script_id}`,
  });

  console.log("Payment processed:", purchaseId, "license:", licenseKey);
}
