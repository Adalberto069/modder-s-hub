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
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;

    const { script_id } = await req.json();
    if (!script_id) {
      return new Response(
        JSON.stringify({ error: "script_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get script details
    const { data: script, error: scriptError } = await adminClient
      .from("scripts")
      .select("id, title, price, is_paid, modder_id, license_duration_days")
      .eq("id", script_id)
      .single();

    if (scriptError || !script) {
      return new Response(JSON.stringify({ error: "Script não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!script.is_paid || !script.price || script.price <= 0) {
      return new Response(
        JSON.stringify({ error: "Este script é gratuito" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has active license
    const { data: existingLicense } = await adminClient
      .from("licenses")
      .select("id")
      .eq("script_id", script_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (existingLicense) {
      return new Response(
        JSON.stringify({ error: "Você já possui uma licença ativa" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Gateway de pagamento não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amount = Number(script.price);
    const commissionRate = 0.20;
    const platformFee = Math.round(amount * commissionRate * 100) / 100;

    // Create purchase record as pending
    const { data: purchase, error: purchaseError } = await adminClient
      .from("purchases")
      .insert({
        user_id: userId,
        script_id: script.id,
        amount,
        status: "pending",
        platform_commission: platformFee,
        modder_earnings: Math.round((amount - platformFee) * 100) / 100,
        commission_rate: commissionRate,
        payment_method: "pix",
      })
      .select("id")
      .single();

    if (purchaseError) {
      console.error("Purchase insert error:", purchaseError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar registro de compra" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use Checkout Pro (Preferences API) - works reliably in test & production
    const preferenceBody: Record<string, unknown> = {
      items: [
        {
          title: script.title,
          description: `Script - ModHub`,
          quantity: 1,
          unit_price: amount,
          currency_id: "BRL",
        },
      ],
      payer: {
        email: userEmail,
      },
      external_reference: purchase.id,
      payment_methods: {
        excluded_payment_types: [],
        installments: 1,
      },
      back_urls: {
        success: `${req.headers.get("origin") || "https://modhub.app"}/script/${script_id}?payment=success`,
        failure: `${req.headers.get("origin") || "https://modhub.app"}/script/${script_id}?payment=failure`,
        pending: `${req.headers.get("origin") || "https://modhub.app"}/script/${script_id}?payment=pending`,
      },
      auto_return: "approved",
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
      marketplace_fee: platformFee,
    };

    // Determine which token to use
    const modderProfile = await adminClient
      .from("profiles")
      .select("mercadopago_access_token")
      .eq("user_id", script.modder_id)
      .single();

    const useToken = modderProfile?.data?.mercadopago_access_token || MP_ACCESS_TOKEN;

    // If using platform token (no modder token), remove marketplace_fee
    if (!modderProfile?.data?.mercadopago_access_token) {
      delete preferenceBody.marketplace_fee;
    }

    console.log("Creating preference with token:", useToken.substring(0, 10) + "...");

    const mpResponse = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${useToken}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": purchase.id,
        },
        body: JSON.stringify(preferenceBody),
      }
    );

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("MP preference error:", JSON.stringify(mpData));
      // Cleanup pending purchase
      await adminClient.from("purchases").delete().eq("id", purchase.id);
      return new Response(
        JSON.stringify({
          error: "Erro ao gerar pagamento",
          details: mpData.message || JSON.stringify(mpData),
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save payment preference id
    await adminClient
      .from("purchases")
      .update({
        payment_id: mpData.id,
      })
      .eq("id", purchase.id);

    console.log("Preference created:", mpData.id, "init_point:", mpData.init_point);

    return new Response(
      JSON.stringify({
        purchase_id: purchase.id,
        preference_id: mpData.id,
        init_point: mpData.init_point,
        sandbox_init_point: mpData.sandbox_init_point,
        amount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
