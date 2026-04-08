import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.49.4/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to get authenticated user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { delivery_id } = await req.json();
    if (!delivery_id) {
      return new Response(JSON.stringify({ error: "delivery_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get delivery
    const { data: delivery, error: delError } = await adminClient
      .from("bounty_deliveries")
      .select("*, bounties!inner(requester_id, assigned_modder_id, status, reward_amount)")
      .eq("id", delivery_id)
      .single();

    if (delError || !delivery) {
      return new Response(JSON.stringify({ error: "Entrega não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bounty = delivery.bounties;
    const isRequester = user.id === bounty.requester_id;
    const isModder = user.id === bounty.assigned_modder_id;

    // Check admin
    const { data: adminCheck } = await adminClient.rpc("is_admin", { _user_id: user.id });
    const userIsAdmin = !!adminCheck;

    // Modder can always download their own upload
    if (isModder || userIsAdmin) {
      // Generate signed URL
      const { data: signedUrl, error: signError } = await adminClient.storage
        .from("bounty-deliveries")
        .createSignedUrl(delivery.file_url, 300); // 5 min

      if (signError) {
        return new Response(JSON.stringify({ error: "Erro ao gerar download" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ url: signedUrl.signedUrl, file_name: delivery.file_name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Requester: only if released (payment confirmed) OR bounty is free
    if (isRequester) {
      const isPaid = Number(bounty.reward_amount) > 0;

      if (isPaid && !delivery.released) {
        return new Response(JSON.stringify({ error: "Pagamento pendente. Pague a recompensa para liberar o download." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: signedUrl, error: signError } = await adminClient.storage
        .from("bounty-deliveries")
        .createSignedUrl(delivery.file_url, 300);

      if (signError) {
        return new Response(JSON.stringify({ error: "Erro ao gerar download" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ url: signedUrl.signedUrl, file_name: delivery.file_name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Sem permissão" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
