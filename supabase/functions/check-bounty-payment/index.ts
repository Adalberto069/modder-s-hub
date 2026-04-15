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

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
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

    // Get the bounty purchase
    const { data: purchase, error: purchaseError } = await serviceClient
      .from("bounty_purchases")
      .select("*")
      .eq("id", purchase_id)
      .eq("payer_id", user.id)
      .single();

    if (purchaseError || !purchase) {
      return new Response(JSON.stringify({ error: "Purchase not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already completed
    if (purchase.status === "completed") {
      return new Response(JSON.stringify({ status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // No payment_id yet — still pending
    if (!purchase.payment_id) {
      return new Response(JSON.stringify({ status: "pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check with Mercado Pago
    const mpToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!mpToken) {
      return new Response(JSON.stringify({ error: "Payment service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // We need the modder's token for marketplace payments
    const { data: modderMp } = await serviceClient
      .from("modder_mp_accounts")
      .select("mp_access_token")
      .eq("user_id", purchase.modder_id)
      .single();

    const accessToken = modderMp?.mp_access_token || mpToken;

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${purchase.payment_id}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!mpResponse.ok) {
      console.error("MP check error:", mpResponse.status);
      return new Response(JSON.stringify({ status: "pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpData = await mpResponse.json();
    console.log("MP payment status:", mpData.status);

    if (mpData.status === "approved") {
      // Update purchase to completed
      await serviceClient
        .from("bounty_purchases")
        .update({ status: "completed", updated_at: new Date().toISOString() })
        .eq("id", purchase.id);

      // Mark bounty as completed
      await serviceClient
        .from("bounties")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", purchase.bounty_id);

      // Release all deliveries
      await serviceClient
        .from("bounty_deliveries")
        .update({ released: true, released_at: new Date().toISOString() })
        .eq("bounty_id", purchase.bounty_id);

      // Notify modder
      const { data: bounty } = await serviceClient
        .from("bounties")
        .select("title, assigned_modder_id")
        .eq("id", purchase.bounty_id)
        .single();

      if (bounty?.assigned_modder_id) {
        await serviceClient.from("notifications").insert({
          user_id: bounty.assigned_modder_id,
          title: "💰 Pagamento recebido!",
          message: `O pagamento da encomenda "${bounty.title}" foi confirmado! O download foi liberado.`,
          type: "success",
          link: `/bounties/${purchase.bounty_id}`,
        });
      }

      return new Response(JSON.stringify({ status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map other statuses
    const statusMap: Record<string, string> = {
      pending: "pending",
      in_process: "pending",
      authorized: "pending",
      rejected: "rejected",
      cancelled: "cancelled",
      refunded: "cancelled",
      charged_back: "cancelled",
    };

    return new Response(
      JSON.stringify({ status: statusMap[mpData.status] || "pending" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
