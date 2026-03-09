import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    // Mercado Pago sends notifications with type "payment" and data.id
    if (body.type !== "payment" && body.action !== "payment.updated" && body.action !== "payment.created") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      console.log("No payment ID in webhook");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payment details from Mercado Pago
    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      console.error("MERCADOPAGO_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "Config error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      }
    );

    const payment = await mpResponse.json();
    console.log("Payment status:", payment.status, "external_ref:", payment.external_reference);

    if (payment.status !== "approved") {
      // Payment not yet approved, just acknowledge
      return new Response(JSON.stringify({ ok: true, status: payment.status }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const purchaseId = payment.external_reference;
    if (!purchaseId) {
      console.error("No external_reference in payment");
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get purchase details
    const { data: purchase, error: purchaseError } = await adminClient
      .from("purchases")
      .select("*")
      .eq("id", purchaseId)
      .single();

    if (purchaseError || !purchase) {
      console.error("Purchase not found:", purchaseId, purchaseError);
      return new Response(JSON.stringify({ error: "Purchase not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already processed
    if (purchase.status === "completed") {
      return new Response(JSON.stringify({ ok: true, already: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update purchase to completed
    await adminClient
      .from("purchases")
      .update({ status: "completed", payment_id: String(paymentId) })
      .eq("id", purchaseId);

    // Get script for license duration
    const { data: script } = await adminClient
      .from("scripts")
      .select("id, title, license_duration_days, modder_id, price")
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

    // Create license
    await adminClient.from("licenses").insert({
      user_id: purchase.user_id,
      script_id: purchase.script_id,
      purchase_id: purchaseId,
      license_key: licenseKey,
      status: "active",
      expires_at: expiresAt,
    });

    // Update script download count
    if (script) {
      await adminClient.rpc("auto_assign_badge", {
        _user_id: purchase.user_id,
        _badge_slug: "first-purchase",
      }).catch(() => {});
    }

    // Create notification for buyer
    await adminClient.from("notifications").insert({
      user_id: purchase.user_id,
      title: "✅ Pagamento confirmado!",
      message: `Seu pagamento para "${script?.title}" foi aprovado. Chave de licença: ${licenseKey}`,
      type: "success",
      link: `/script/${purchase.script_id}`,
    });

    console.log("Payment processed successfully:", purchaseId, licenseKey);

    return new Response(
      JSON.stringify({ ok: true, license_key: licenseKey }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
