import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;
    const userId = user.id;

    const { script_id, is_renewal } = await req.json();
    if (!script_id) {
      return new Response(JSON.stringify({ error: "script_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch script details
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

    const amount = Number(script.price);
    const commissionRate = 0.20;
    const platformCommission = Math.round(amount * commissionRate * 100) / 100;
    const modderEarnings = Math.round((amount - platformCommission) * 100) / 100;

    // Create pending purchase record
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

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    // Check if customer exists
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://lovable.dev";
    const licenseDuration = script.license_duration_days;
    const licenseLabel = licenseDuration
      ? licenseDuration === 7
        ? "Licença Semanal (7 dias)"
        : `Licença ${licenseDuration} dias`
      : "Licença Permanente";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email!,
      line_items: [
        {
          price_data: {
            currency: "brl",
            unit_amount: Math.round(amount * 100),
            product_data: {
              name: script.title,
              description: licenseLabel,
            },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/script/${script.id}?payment=success&purchase_id=${purchase.id}`,
      cancel_url: `${origin}/script/${script.id}?payment=cancelled`,
      metadata: {
        purchase_id: purchase.id,
        script_id: script.id,
        user_id: userId,
        is_renewal: is_renewal ? "true" : "false",
      },
    });

    // Save stripe session id
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
