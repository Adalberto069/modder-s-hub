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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const userEmail = user.email!;

    const { script_id, is_renewal, payment_method = "pix" } = await req.json();
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

    const { data: script, error: scriptError } = await serviceClient
      .from("scripts")
      .select("id, title, price, is_paid, license_duration_days, modder_id")
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

    // Get modder's MP account for split payment
    const { data: modderMp } = await serviceClient
      .from("modder_mp_accounts")
      .select("mp_access_token, mp_user_id, mp_token_expires_at")
      .eq("user_id", script.modder_id)
      .single();

    if (!modderMp) {
      return new Response(JSON.stringify({ error: "Modder has not connected Mercado Pago. Payment unavailable." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseAmount = Number(script.price);
    // Payment processing fee passed to buyer: 1% for PIX, 4.99% for card
    const feeRate = payment_method === "card" ? 0.0499 : 0.01;
    const fee = Math.round(baseAmount * feeRate * 100) / 100;
    const amount = Math.round((baseAmount + fee) * 100) / 100;
    const commissionRate = 0.20;
    const platformCommission = Math.round(baseAmount * commissionRate * 100) / 100;
    const modderEarnings = Math.round((baseAmount - platformCommission) * 100) / 100;

    // Create purchase record
    const { data: purchase, error: purchaseError } = await serviceClient
      .from("script_purchases")
      .insert({
        user_id: userId,
        script_id: script.id,
        amount,
        status: "pending",
        payment_method: payment_method === "card" ? "card" : "pix",
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

    // Use modder's access token for marketplace split
    const modderAccessToken = modderMp.mp_access_token;
    if (!modderAccessToken) {
      return new Response(JSON.stringify({ error: "Modder payment token not available" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;

    // Marketplace split: payment created with modder's token,
    // application_fee goes to platform, rest goes to modder
    const marketplaceFee = platformCommission;

    // ===== CARD PAYMENT (Checkout Pro with split) =====
    if (payment_method === "card") {
      const prefResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${modderAccessToken}`,
        },
        body: JSON.stringify({
          items: [
            {
              title: `${script.title}${is_renewal ? " (Renovação)" : ""}`,
              quantity: 1,
              unit_price: amount,
              currency_id: "BRL",
            },
          ],
          payer: { email: userEmail },
          external_reference: purchase.id,
          back_urls: {
            success: `${req.headers.get("origin") || "https://mod-alchemist-den.lovable.app"}/script/${script.id}?payment=success`,
            failure: `${req.headers.get("origin") || "https://mod-alchemist-den.lovable.app"}/script/${script.id}?payment=failure`,
            pending: `${req.headers.get("origin") || "https://mod-alchemist-den.lovable.app"}/script/${script.id}?payment=pending`,
          },
          auto_return: "approved",
          notification_url: webhookUrl,
          application_fee: marketplaceFee,
          payment_methods: {
            excluded_payment_types: [{ id: "ticket" }],
            installments: 12,
          },
        }),
      });

      const prefData = await prefResponse.json();

      if (!prefResponse.ok) {
        console.error("MP Preference error:", JSON.stringify(prefData));
        return new Response(JSON.stringify({ error: "Failed to create card payment", details: prefData.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          purchase_id: purchase.id,
          payment_method: "card",
          init_point: prefData.init_point,
          preference_id: prefData.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ===== PIX PAYMENT with marketplace split =====
    const idempotencyKey = `pix-${purchase.id}-${Date.now()}`;

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${modderAccessToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `${script.title}${is_renewal ? " (Renovação)" : ""}`,
        payment_method_id: "pix",
        payer: { email: userEmail },
        external_reference: purchase.id,
        notification_url: webhookUrl,
        application_fee: marketplaceFee,
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

    await serviceClient
      .from("script_purchases")
      .update({ payment_id: String(mpData.id) })
      .eq("id", purchase.id);

    const pixInfo = mpData.point_of_interaction?.transaction_data;

    return new Response(
      JSON.stringify({
        purchase_id: purchase.id,
        payment_id: mpData.id,
        payment_method: "pix",
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
