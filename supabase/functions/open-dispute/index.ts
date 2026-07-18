import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autorizado" }, 401);

    const { purchase_id, purchase_type, reason } = await req.json();
    if (!purchase_id || !["script", "bounty"].includes(purchase_type)) {
      return json({ error: "purchase_id e purchase_type obrigatórios" }, 400);
    }
    if (!reason || String(reason).trim().length < 10) {
      return json({ error: "Descreva o problema com pelo menos 10 caracteres" }, 400);
    }

    const admin = createClient(url, service);
    const table = purchase_type === "script" ? "script_purchases" : "bounty_purchases";
    const buyerField = purchase_type === "script" ? "user_id" : "payer_id";

    const { data: purchase } = await admin.from(table).select("*").eq("id", purchase_id).single();
    if (!purchase) return json({ error: "Compra não encontrada" }, 404);
    if (purchase[buyerField] !== user.id) return json({ error: "Só o comprador pode abrir disputa" }, 403);
    if (purchase.escrow_status !== "held") {
      return json({ error: "O prazo de disputa expirou (pagamento já liberado)" }, 400);
    }

    // Only one open dispute per purchase
    const { data: existing } = await admin.from("purchase_disputes")
      .select("id")
      .eq("purchase_id", purchase_id)
      .eq("purchase_type", purchase_type)
      .eq("status", "open")
      .maybeSingle();
    if (existing) return json({ error: "Já existe uma disputa aberta para esta compra" }, 400);

    const { data: dispute, error: dErr } = await admin.from("purchase_disputes").insert({
      purchase_id,
      purchase_type,
      opener_id: user.id,
      modder_id: purchase.modder_id,
      reason: String(reason).trim().slice(0, 2000),
    }).select().single();
    if (dErr) return json({ error: dErr.message }, 500);

    await admin.from(table).update({
      escrow_status: "disputed",
      escrow_dispute_reason: String(reason).trim().slice(0, 2000),
      escrow_disputed_at: new Date().toISOString(),
    }).eq("id", purchase_id);

    // Notify modder + admins
    await admin.from("notifications").insert({
      user_id: purchase.modder_id,
      title: "⚠️ Disputa aberta",
      message: "O comprador abriu uma disputa em uma venda sua. Aguarde a análise do admin.",
      type: "warning",
      link: "/dashboard?tab=finance",
    });

    return json({ success: true, dispute_id: dispute.id });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
