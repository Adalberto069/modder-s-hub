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

    const { bounty_id, payment_method = "pix" } = await req.json();
    if (!bounty_id) {
      return new Response(JSON.stringify({ error: "bounty_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!["pix", "card"].includes(payment_method)) {
      return new Response(JSON.stringify({ error: "Invalid payment_method" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get bounty
    const { data: bounty, error: bountyError } = await serviceClient
      .from("bounties")
      .select("id, title, requester_id, assigned_modder_id, reward_amount, status")
      .eq("id", bounty_id)
      .single();

    if (bountyError || !bounty) {
      return new Response(JSON.stringify({ error: "Bounty not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only requester can pay
    if (bounty.requester_id !== user.id) {
      return new Response(JSON.stringify({ error: "Only the requester can pay" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (bounty.status !== "in_progress") {
      return new Response(JSON.stringify({ error: "Bounty must be in_progress to pay" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bounty.reward_amount || Number(bounty.reward_amount) <= 0) {
      return new Response(JSON.stringify({ error: "This bounty has no reward amount" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bounty.assigned_modder_id) {
      return new Response(JSON.stringify({ error: "No modder assigned" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already paid
    const { data: existingPurchase } = await serviceClient
      .from("bounty_purchases")
      .select("id, status")
      .eq("bounty_id", bounty_id)
      .in("status", ["completed", "pending"])
      .maybeSingle();

    if (existingPurchase) {
      return new Response(JSON.stringify({ error: "Payment already exists for this bounty" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get modder's MP account
    const { data: modderMp } = await serviceClient
      .from("modder_mp_accounts")
      .select("mp_access_token, mp_user_id")
      .eq("user_id", bounty.assigned_modder_id)
      .single();

    if (!modderMp) {
      return new Response(JSON.stringify({ error: "Modder has not connected Mercado Pago. Payment unavailable." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseAmount = Number(bounty.reward_amount);
    const feeRate = payment_method === "card" ? 0.0499 : 0.01;
    const fee = Math.round(baseAmount * feeRate * 100) / 100;
    const amount = Math.round((baseAmount + fee) * 100) / 100;
    const commissionRate = 0.20;
    const platformCommission = Math.round(baseAmount * commissionRate * 100) / 100;
    const modderEarnings = Math.round((baseAmount - platformCommission) * 100) / 100;

    // Create bounty purchase record
    const { data: purchase, error: purchaseError } = await serviceClient
      .from("bounty_purchases")
      .insert({
        bounty_id: bounty.id,
        payer_id: user.id,
        modder_id: bounty.assigned_modder_id,
        amount,
        base_amount: baseAmount,
        fee,
        commission_rate: commissionRate,
        platform_commission: platformCommission,
        modder_earnings: modderEarnings,
        payment_method,
        status: "pending",
      })
      .select()
      .single();

    if (purchaseError || !purchase) {
      console.error("Bounty purchase insert error:", purchaseError);
      return new Response(JSON.stringify({ error: "Failed to create purchase" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const modderAccessToken = modderMp.mp_access_token;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/mercadopago-webhook`;
    const origin = req.headers.get("origin") || "https://mod-alchemist-den.lovable.app";

    // Use "bounty:" prefix in external_reference to distinguish from script purchases
    const externalRef = `bounty:${purchase.id}`;

    // ===== CARD PAYMENT =====
    if (payment_method === "card") {
      const prefResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${modderAccessToken}`,
        },
        body: JSON.stringify({
          items: [{
            title: `Encomenda: ${bounty.title}`,
            quantity: 1,
            unit_price: amount,
            currency_id: "BRL",
          }],
          payer: { email: user.email },
          external_reference: externalRef,
          back_urls: {
            success: `${origin}/bounties/${bounty.id}?payment=success`,
            failure: `${origin}/bounties/${bounty.id}?payment=failure`,
            pending: `${origin}/bounties/${bounty.id}?payment=pending`,
          },
          auto_return: "approved",
          notification_url: webhookUrl,
          application_fee: platformCommission,
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

      return new Response(JSON.stringify({
        purchase_id: purchase.id,
        payment_method: "card",
        init_point: prefData.init_point,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ===== PIX PAYMENT =====
    const idempotencyKey = `bounty-pix-${purchase.id}-${Date.now()}`;

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${modderAccessToken}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        transaction_amount: amount,
        description: `Encomenda: ${bounty.title}`,
        payment_method_id: "pix",
        payer: { email: user.email },
        external_reference: externalRef,
        notification_url: webhookUrl,
        application_fee: platformCommission,
      }),
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error("MP PIX error:", JSON.stringify(mpData));
      return new Response(JSON.stringify({ error: "Failed to create PIX payment", details: mpData.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await serviceClient
      .from("bounty_purchases")
      .update({ payment_id: String(mpData.id) })
      .eq("id", purchase.id);

    const pixInfo = mpData.point_of_interaction?.transaction_data;

    return new Response(JSON.stringify({
      purchase_id: purchase.id,
      payment_id: mpData.id,
      payment_method: "pix",
      qr_code: pixInfo?.qr_code ?? null,
      qr_code_base64: pixInfo?.qr_code_base64 ?? null,
      ticket_url: pixInfo?.ticket_url ?? null,
      expires_at: mpData.date_of_expiration ?? null,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
