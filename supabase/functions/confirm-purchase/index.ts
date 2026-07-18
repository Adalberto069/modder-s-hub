import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Não autorizado" }, 401);

    const { purchase_id, purchase_type } = await req.json();
    if (!purchase_id || !["script", "bounty"].includes(purchase_type)) {
      return json({ error: "purchase_id e purchase_type obrigatórios" }, 400);
    }

    const admin = createClient(url, service);
    const table = purchase_type === "script" ? "script_purchases" : "bounty_purchases";
    const buyerField = purchase_type === "script" ? "user_id" : "payer_id";

    const { data: purchase } = await admin.from(table).select("*").eq("id", purchase_id).single();
    if (!purchase) return json({ error: "Compra não encontrada" }, 404);
    if (purchase[buyerField] !== user.id) return json({ error: "Só o comprador pode confirmar" }, 403);
    if (purchase.escrow_status !== "held") return json({ error: "Compra já foi liberada" }, 400);

    await admin.from(table).update({
      escrow_status: "released",
      escrow_released_at: new Date().toISOString(),
    }).eq("id", purchase_id);

    await admin.from("notifications").insert({
      user_id: purchase.modder_id,
      title: "✅ Pagamento liberado",
      message: "O comprador confirmou o recebimento e liberou seu pagamento.",
      type: "success",
      link: "/dashboard?tab=finance",
    });

    return json({ success: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }

  function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
