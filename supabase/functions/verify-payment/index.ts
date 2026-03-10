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

    const { purchase_id } = await req.json();
    if (!purchase_id) {
      return new Response(JSON.stringify({ error: "purchase_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get the purchase
    const { data: purchase } = await serviceClient
      .from("purchases")
      .select("*")
      .eq("id", purchase_id)
      .eq("user_id", userData.user.id)
      .single();

    if (!purchase) {
      return new Response(JSON.stringify({ error: "Purchase not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If already completed, just return success
    if (purchase.status === "completed") {
      const { data: license } = await serviceClient
        .from("licenses")
        .select("license_key")
        .eq("purchase_id", purchase_id)
        .single();

      return new Response(JSON.stringify({ status: "completed", license_key: license?.license_key }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check with Stripe if payment was successful
    if (purchase.payment_id) {
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
        apiVersion: "2025-08-27.basil",
      });

      const session = await stripe.checkout.sessions.retrieve(purchase.payment_id);

      if (session.payment_status === "paid") {
        // Process the payment (same logic as webhook)
        await serviceClient
          .from("purchases")
          .update({ status: "completed", payment_id: session.payment_intent as string || session.id })
          .eq("id", purchase_id);

        const { data: script } = await serviceClient
          .from("scripts")
          .select("license_duration_days")
          .eq("id", purchase.script_id)
          .single();

        const durationDays = script?.license_duration_days;

        // Generate license
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        let licenseKey = "";
        for (let s = 0; s < 3; s++) {
          if (s > 0) licenseKey += "-";
          for (let i = 0; i < 4; i++) {
            licenseKey += chars[Math.floor(Math.random() * chars.length)];
          }
        }

        const expiresAt = durationDays
          ? new Date(Date.now() + durationDays * 86400000).toISOString()
          : null;

        // Check if license already exists (webhook might have created it)
        const { data: existingLicense } = await serviceClient
          .from("licenses")
          .select("license_key")
          .eq("purchase_id", purchase_id)
          .single();

        if (existingLicense) {
          return new Response(JSON.stringify({ status: "completed", license_key: existingLicense.license_key }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await serviceClient.from("licenses").insert({
          user_id: userData.user.id,
          script_id: purchase.script_id,
          purchase_id: purchase_id,
          license_key: licenseKey,
          status: "active",
          expires_at: expiresAt,
        });

        await serviceClient.from("script_access").insert({
          user_id: userData.user.id,
          script_id: purchase.script_id,
        });

        return new Response(JSON.stringify({ status: "completed", license_key: licenseKey }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ status: purchase.status }), {
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
