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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { purchase_id } = await req.json();

    if (!purchase_id) {
      return new Response(JSON.stringify({ error: "purchase_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get purchase
    const { data: purchase } = await adminClient
      .from("purchases")
      .select("*")
      .eq("id", purchase_id)
      .eq("user_id", userId)
      .single();

    if (!purchase) {
      return new Response(JSON.stringify({ error: "Compra não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already completed
    if (purchase.status === "completed") {
      const { data: license } = await adminClient
        .from("licenses")
        .select("license_key")
        .eq("purchase_id", purchase_id)
        .single();

      return new Response(JSON.stringify({ status: "approved", license_key: license?.license_key }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!purchase.payment_id) {
      return new Response(JSON.stringify({ status: "pending" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check payment status on Mercado Pago
    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      return new Response(JSON.stringify({ error: "Config error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${purchase.payment_id}`,
      { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
    );
    const payment = await mpResponse.json();

    if (payment.status === "approved") {
      // Update purchase
      await adminClient
        .from("purchases")
        .update({ status: "completed" })
        .eq("id", purchase_id);

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
        user_id: userId,
        script_id: purchase.script_id,
        purchase_id,
        license_key: licenseKey,
        status: "active",
        expires_at: expiresAt,
      });

      // Notify buyer
      await adminClient.from("notifications").insert({
        user_id: userId,
        title: "✅ Pagamento confirmado!",
        message: `Seu pagamento para "${script?.title}" foi aprovado. Chave: ${licenseKey}`,
        type: "success",
        link: `/script/${purchase.script_id}`,
      });

      return new Response(JSON.stringify({ status: "approved", license_key: licenseKey }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ status: payment.status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Check payment error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
