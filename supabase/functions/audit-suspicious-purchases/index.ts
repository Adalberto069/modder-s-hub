import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-invoke-source",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Janela: últimas 24h
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1) Compras completed com amount=0 ou payment_id null
    const { data: badPurchases } = await supabase
      .from("script_purchases")
      .select("id, user_id, script_id, amount, payment_id, created_at")
      .eq("status", "completed")
      .or("amount.eq.0,payment_id.is.null")
      .gte("created_at", since);

    // 2) Bounty purchases completed com amount=0 ou payment_id null
    const { data: badBounties } = await supabase
      .from("bounty_purchases")
      .select("id, payer_id, bounty_id, amount, payment_id, created_at")
      .eq("status", "completed")
      .or("amount.eq.0,payment_id.is.null")
      .gte("created_at", since);

    // 3) script_access sem purchase válida (excluindo scripts gratuitos e do próprio modder)
    const { data: orphanAccess } = await supabase.rpc("audit_orphan_script_access" as any, {
      _since: since,
    }).then(r => r).catch(() => ({ data: null }));

    // Fallback caso a RPC não exista: query manual
    let orphans: any[] = orphanAccess || [];
    if (!orphanAccess) {
      const { data: accessRows } = await supabase
        .from("script_access")
        .select("id, user_id, script_id, unlocked_at")
        .gte("unlocked_at", since);

      if (accessRows && accessRows.length > 0) {
        for (const acc of accessRows) {
          const { data: script } = await supabase
            .from("scripts")
            .select("is_paid, modder_id")
            .eq("id", acc.script_id)
            .maybeSingle();
          if (!script || !script.is_paid || script.modder_id === acc.user_id) continue;

          const { data: purchase } = await supabase
            .from("script_purchases")
            .select("id")
            .eq("user_id", acc.user_id)
            .eq("script_id", acc.script_id)
            .eq("status", "completed")
            .maybeSingle();
          if (!purchase) orphans.push(acc);
        }
      }
    }

    const totalIssues =
      (badPurchases?.length || 0) + (badBounties?.length || 0) + orphans.length;

    let bodySource: string | null = null;
    try {
      const b = await req.clone().json();
      if (b && typeof b.source === "string") bodySource = b.source;
    } catch (_) { /* no body */ }
    const source = bodySource || req.headers.get("x-invoke-source") || "cron";

    if (totalIssues === 0) {
      await supabase.from("audit_runs").insert({
        source,
        total_issues: 0,
        suspicious_purchases_count: 0,
        suspicious_bounties_count: 0,
        orphan_access_count: 0,
        admins_notified: 0,
        details: {},
      });
      return new Response(
        JSON.stringify({ ok: true, issues: 0, message: "Nenhuma anomalia detectada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Notificar todos os admins
    const { data: admins } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .eq("approved", true);

    const summary = [
      badPurchases?.length ? `${badPurchases.length} compra(s) suspeita(s)` : null,
      badBounties?.length ? `${badBounties.length} bounty(s) suspeita(s)` : null,
      orphans.length ? `${orphans.length} acesso(s) órfão(s)` : null,
    ]
      .filter(Boolean)
      .join(", ");

    const message = `🚨 Auditoria automática detectou nas últimas 24h: ${summary}. Verifique o painel admin.`;

    if (admins && admins.length > 0) {
      const notifications = admins.map((a) => ({
        user_id: a.user_id,
        title: "🚨 Anomalia financeira detectada",
        message,
        type: "warning",
        link: "/admin",
      }));
      await supabase.from("notifications").insert(notifications);
    }

    // Persistir histórico
    await supabase.from("audit_runs").insert({
      source,
      total_issues: totalIssues,
      suspicious_purchases_count: badPurchases?.length || 0,
      suspicious_bounties_count: badBounties?.length || 0,
      orphan_access_count: orphans.length,
      admins_notified: admins?.length || 0,
      details: {
        suspicious_purchases: badPurchases || [],
        suspicious_bounties: badBounties || [],
        orphan_access: orphans,
      },
    });

    console.log("[audit-suspicious-purchases]", {
      badPurchases: badPurchases?.length || 0,
      badBounties: badBounties?.length || 0,
      orphans: orphans.length,
      adminsNotified: admins?.length || 0,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        issues: totalIssues,
        details: {
          suspicious_purchases: badPurchases || [],
          suspicious_bounties: badBounties || [],
          orphan_access: orphans,
        },
        admins_notified: admins?.length || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("audit-suspicious-purchases error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
