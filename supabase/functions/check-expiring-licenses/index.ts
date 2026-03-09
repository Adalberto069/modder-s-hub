import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find licenses expiring in exactly 3 days (within a 1-day window)
    const now = new Date();
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const fourDaysFromNow = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);

    const { data: expiringLicenses, error } = await supabase
      .from("licenses")
      .select("id, user_id, script_id, expires_at, license_key")
      .eq("status", "active")
      .gte("expires_at", threeDaysFromNow.toISOString())
      .lt("expires_at", fourDaysFromNow.toISOString());

    if (error) throw error;

    if (!expiringLicenses || expiringLicenses.length === 0) {
      return new Response(JSON.stringify({ notified: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get script titles
    const scriptIds = [...new Set(expiringLicenses.map((l: any) => l.script_id))];
    const { data: scripts } = await supabase
      .from("scripts")
      .select("id, title")
      .in("id", scriptIds);

    const scriptMap = (scripts ?? []).reduce((acc: any, s: any) => {
      acc[s.id] = s.title;
      return acc;
    }, {});

    // Check existing notifications to avoid duplicates (last 24h)
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("user_id, link")
      .eq("title", "⏰ Licença expirando em breve")
      .gte("created_at", yesterday.toISOString());

    const existingSet = new Set(
      (existingNotifs ?? []).map((n: any) => `${n.user_id}:${n.link}`)
    );

    let notified = 0;
    for (const license of expiringLicenses) {
      const key = `${license.user_id}:/script/${license.script_id}`;
      if (existingSet.has(key)) continue;

      const scriptTitle = scriptMap[license.script_id] || "Script";
      await supabase.from("notifications").insert({
        user_id: license.user_id,
        title: "⏰ Licença expirando em breve",
        message: `Sua licença do script "${scriptTitle}" expira em 3 dias. Renove para manter o acesso.`,
        type: "error",
        link: `/script/${license.script_id}`,
      });
      notified++;
    }

    return new Response(JSON.stringify({ notified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
