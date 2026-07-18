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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { script_id } = await req.json();
    if (!script_id) {
      return new Response(JSON.stringify({ error: "script_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get script
    const { data: script, error: scriptError } = await supabase
      .from("scripts")
      .select("id, file_url, is_paid, modder_id, title, game_name, external_link")
      .eq("id", script_id)
      .single();

    if (scriptError || !script) {
      return new Response(JSON.stringify({ error: "Script não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For free scripts, return file_url or external_link directly
    if (!script.is_paid) {
      return new Response(JSON.stringify({ 
        url: script.file_url || script.external_link,
        title: script.title,
        game_name: script.game_name,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For paid scripts, verify access
    const isOwner = script.modder_id === user.id;
    
    // Check admin
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });

    if (!isOwner && !isAdmin) {
      // Check purchase/license
      const { data: access } = await supabase
        .from("script_access")
        .select("id")
        .eq("user_id", user.id)
        .eq("script_id", script_id)
        .maybeSingle();

      if (!access) {
        return new Response(JSON.stringify({ error: "Acesso não autorizado" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Start escrow window on first download (12h)
      const { data: pendingPurchase } = await supabase
        .from("script_purchases")
        .select("id, escrow_status, escrow_release_at")
        .eq("script_id", script_id)
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pendingPurchase && pendingPurchase.escrow_status === "held" && !pendingPurchase.escrow_release_at) {
        const releaseAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
        await supabase
          .from("script_purchases")
          .update({ escrow_release_at: releaseAt })
          .eq("id", pendingPurchase.id);
      }
    }

    // If file_url is a private bucket path, generate signed URL
    if (script.file_url) {
      // Check if it's a private bucket path (not a full URL)
      if (!script.file_url.startsWith("http")) {
        const { data: signedData, error: signError } = await supabase.storage
          .from("scripts-private")
          .createSignedUrl(script.file_url, 300); // 5 min expiry

        if (signError || !signedData) {
          return new Response(JSON.stringify({ error: "Erro ao gerar URL de download" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({
          url: signedData.signedUrl,
          title: script.title,
          game_name: script.game_name,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Legacy: full public URL (for scripts uploaded before migration)
      return new Response(JSON.stringify({
        url: script.file_url,
        title: script.title,
        game_name: script.game_name,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      url: script.external_link,
      title: script.title,
      game_name: script.game_name,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
