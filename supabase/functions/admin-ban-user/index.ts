import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRole } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .eq("approved", true)
      .maybeSingle();

    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { target_user_id, action, reason } = await req.json();
    if (!target_user_id || !["ban", "unban"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (target_user_id === userData.user.id) {
      return new Response(JSON.stringify({ error: "Você não pode banir sua própria conta" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent banning other admins
    const { data: targetAdmin } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", target_user_id)
      .eq("role", "admin")
      .eq("approved", true)
      .maybeSingle();
    if (targetAdmin && action === "ban") {
      return new Response(JSON.stringify({ error: "Não é possível banir outro admin" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ban") {
      // 100 years ban
      const { error: banErr } = await admin.auth.admin.updateUserById(target_user_id, {
        ban_duration: "876000h",
      });
      if (banErr) throw banErr;

      await admin.from("profiles").update({
        is_banned: true,
        banned_at: new Date().toISOString(),
        banned_reason: reason ?? null,
      }).eq("user_id", target_user_id);

      // Force sign out active sessions
      await admin.auth.admin.signOut(target_user_id).catch(() => {});
    } else {
      const { error: unbanErr } = await admin.auth.admin.updateUserById(target_user_id, {
        ban_duration: "none",
      });
      if (unbanErr) throw unbanErr;

      await admin.from("profiles").update({
        is_banned: false,
        banned_at: null,
        banned_reason: null,
      }).eq("user_id", target_user_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
