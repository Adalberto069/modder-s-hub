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
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;

    const { script_id, is_renewal } = await req.json();
    if (!script_id) {
      return new Response(JSON.stringify({ error: "script_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get script
    const { data: script, error: scriptError } = await serviceClient
      .from("scripts")
      .select("id, title, price, is_paid, license_duration_days")
      .eq("id", script_id)
      .single();

    if (scriptError || !script) {
      return new Response(JSON.stringify({ error: "Script not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!script.is_paid || !script.price || script.price <= 0) {
      return new Response(JSON.stringify({ error: "Script is free" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const amount = Number(script.price);
    const commissionRate = 0.20;
    const platformCommission = Math.round(amount * commissionRate * 100) / 100;
    const modderEarnings = Math.round((amount - platformCommission) * 100) / 100;

    // Create purchase record
    const { data: purchase, error: purchaseError } = await serviceClient
      .from("purchases")
      .insert({
        user_id: userId,
        script_id: script.id,
        amount,
        status: "pending",
        payment_method: "pix",
        commission_rate: commissionRate,
        platform_commission: platformCommission,
        modder_earnings: modderEarnings,
      })
      .select()
      .single();

    if (purchaseError || !purchase) {
      console.error("Purchase insert error:", purchaseError);
      return new Response(JSON.stringify({ error: "Failed to create purchase" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create PIX payment via Mercado Pago
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const idempotencyKey = `pix-${purchase.id}-${Date.now()}`;

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `${script.title}${is_renewal ? " (Renovação)" : ""}`,
        payment_method_id: "pix",
        payer: {
          email: userEmail,
        },
        external_reference: purchase.id,
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", JSON.stringify(mpData));
      return new Response(JSON.stringify({ error: "Failed to create PIX payment", details: mpData.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save MP payment ID
    await serviceClient
      .from("purchases")
      .update({ payment_id: String(mpData.id) })
      .eq("id", purchase.id);

    const pixInfo = mpData.point_of_interaction?.transaction_data;

    return new Response(
      JSON.stringify({
        purchase_id: purchase.id,
        payment_id: mpData.id,
        qr_code: pixInfo?.qr_code ?? null,
        qr_code_base64: pixInfo?.qr_code_base64 ?? null,
        ticket_url: pixInfo?.ticket_url ?? null,
        expires_at: mpData.date_of_expiration ?? null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
