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

    const { script_id, is_renewal } = await req.json();
    if (!script_id) {
      return new Response(JSON.stringify({ error: "script_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch script details
    const { data: script, error: scriptError } = await supabase
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

    const amount = Number(script.price);
    const commissionRate = 0.20;
    const platformCommission = Math.round(amount * commissionRate * 100) / 100;
    const modderEarnings = Math.round((amount - platformCommission) * 100) / 100;

    // Create pending purchase record
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: purchase, error: purchaseError } = await serviceClient
      .from("purchases")
      .insert({
        user_id: userId,
        script_id: script.id,
        amount,
        status: "pending",
        payment_method: "stripe",
        commission_rate: commissionRate,
        platform_commission: platformCommission,
        modder_earnings: modderEarnings,
      })
      .select("id")
      .single();

    if (purchaseError) {
      return new Response(JSON.stringify({ error: "Failed to create purchase", details: purchaseError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Stripe Checkout Session
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const origin = req.headers.get("origin") || "https://lovable.dev";

    const licenseDuration = script.license_duration_days;
    const licenseLabel = licenseDuration
      ? licenseDuration === 7
        ? "Licença Semanal (7 dias)"
        : `Licença ${licenseDuration} dias`
      : "Licença Permanente";

    const body = new URLSearchParams({
      "payment_method_types[]": "card",
      mode: "payment",
      "line_items[0][price_data][currency]": "brl",
      "line_items[0][price_data][unit_amount]": String(Math.round(amount * 100)),
      "line_items[0][price_data][product_data][name]": script.title,
      "line_items[0][price_data][product_data][description]": licenseLabel,
      "line_items[0][quantity]": "1",
      success_url: `${origin}/script/${script.id}?payment=success&purchase_id=${purchase.id}`,
      cancel_url: `${origin}/script/${script.id}?payment=cancelled`,
      "metadata[purchase_id]": purchase.id,
      "metadata[script_id]": script.id,
      "metadata[user_id]": userId,
      "metadata[is_renewal]": is_renewal ? "true" : "false",
    });

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const session = await stripeResponse.json();

    if (!stripeResponse.ok) {
      console.error("Stripe error:", session);
      return new Response(JSON.stringify({ error: "Failed to create checkout", details: session.error?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save payment_id
    await serviceClient
      .from("purchases")
      .update({ payment_id: session.id })
      .eq("id", purchase.id);

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
