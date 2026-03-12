import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body));

    // Mercado Pago sends different notification types
    if (body.type !== "payment" && body.action !== "payment.updated" && body.action !== "payment.created") {
      console.log("Ignoring non-payment notification:", body.type, body.action);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const paymentId = body.data?.id;
    if (!paymentId) {
      console.log("No payment ID in webhook");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get payment details from Mercado Pago
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      console.error("MERCADOPAGO_ACCESS_TOKEN not configured");
      return new Response(JSON.stringify({ error: "Not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const mpData = await mpResponse.json();
    console.log("MP Payment status:", mpData.status, "external_reference:", mpData.external_reference);

    if (mpData.status !== "approved") {
      console.log("Payment not approved yet:", mpData.status);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const purchaseId = mpData.external_reference;
    if (!purchaseId) {
      console.error("No external_reference (purchase_id) in payment");
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if already completed
    const { data: purchase } = await serviceClient
      .from("purchases")
      .select("*")
      .eq("id", purchaseId)
      .single();

    if (!purchase) {
      console.error("Purchase not found:", purchaseId);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (purchase.status === "completed") {
      console.log("Purchase already completed:", purchaseId);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Complete the purchase
    await serviceClient
      .from("purchases")
      .update({ status: "completed", payment_id: String(paymentId) })
      .eq("id", purchaseId);

    // Get script for license duration
    const { data: script } = await serviceClient
      .from("scripts")
      .select("license_duration_days")
      .eq("id", purchase.script_id)
      .single();

    // Generate license key
    const { data: licenseKey } = await serviceClient.rpc("generate_license_key");

    const expiresAt = script?.license_duration_days
      ? new Date(Date.now() + script.license_duration_days * 86400000).toISOString()
      : null;

    // Check if renewal
    const { data: existingLicense } = await serviceClient
      .from("licenses")
      .select("id, expires_at")
      .eq("script_id", purchase.script_id)
      .eq("user_id", purchase.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingLicense) {
      const baseDate =
        existingLicense.expires_at && new Date(existingLicense.expires_at) > new Date()
          ? new Date(existingLicense.expires_at)
          : new Date();
      const newExpiry = script?.license_duration_days
        ? new Date(baseDate.getTime() + script.license_duration_days * 86400000).toISOString()
        : null;

      await serviceClient
        .from("licenses")
        .update({ expires_at: newExpiry, status: "active" })
        .eq("id", existingLicense.id);
    } else {
      await serviceClient.from("licenses").insert({
        user_id: purchase.user_id,
        script_id: purchase.script_id,
        purchase_id: purchaseId,
        license_key: licenseKey,
        status: "active",
        expires_at: expiresAt,
      });

      await serviceClient.from("script_access").insert({
        user_id: purchase.user_id,
        script_id: purchase.script_id,
      });

      // Increment download count
      const { data: currentScript } = await serviceClient
        .from("scripts")
        .select("download_count")
        .eq("id", purchase.script_id)
        .single();

      await serviceClient
        .from("scripts")
        .update({ download_count: (currentScript?.download_count ?? 0) + 1 })
        .eq("id", purchase.script_id);
    }

    console.log("Webhook processed successfully for purchase:", purchaseId);

    return new Response(JSON.stringify({ received: true, processed: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
