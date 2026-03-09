import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } =
      await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
    const userEmail = claimsData.claims.email as string;

    const { script_id } = await req.json();
    if (!script_id) {
      return new Response(
        JSON.stringify({ error: "script_id é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get script details
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: script, error: scriptError } = await adminClient
      .from("scripts")
      .select("id, title, price, is_paid, modder_id, license_duration_days")
      .eq("id", script_id)
      .single();

    if (scriptError || !script) {
      return new Response(JSON.stringify({ error: "Script não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!script.is_paid || !script.price || script.price <= 0) {
      return new Response(
        JSON.stringify({ error: "Este script é gratuito" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user already has active license
    const { data: existingLicense } = await adminClient
      .from("licenses")
      .select("id")
      .eq("script_id", script_id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (existingLicense) {
      return new Response(
        JSON.stringify({ error: "Você já possui uma licença ativa" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get modder's MP access token for split payment
    const { data: modderProfile } = await adminClient
      .from("profiles")
      .select("mercadopago_access_token, display_name, username")
      .eq("user_id", script.modder_id)
      .single();

    const MP_ACCESS_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: "Gateway de pagamento não configurado" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const amount = Number(script.price);
    const commissionRate = 0.20;
    const platformFee = Math.round(amount * commissionRate * 100) / 100;

    // Create purchase record as pending
    const { data: purchase, error: purchaseError } = await adminClient
      .from("purchases")
      .insert({
        user_id: userId,
        script_id: script.id,
        amount,
        status: "pending",
        platform_commission: platformFee,
        modder_earnings: Math.round((amount - platformFee) * 100) / 100,
        commission_rate: commissionRate,
        payment_method: "pix",
      })
      .select("id")
      .single();

    if (purchaseError) {
      console.error("Purchase insert error:", purchaseError);
      return new Response(
        JSON.stringify({ error: "Erro ao criar registro de compra" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Build Mercado Pago payment request
    const paymentBody: Record<string, unknown> = {
      transaction_amount: amount,
      description: `${script.title} - ModHub`,
      payment_method_id: "pix",
      payer: {
        email: userEmail,
      },
      external_reference: purchase.id,
      notification_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/mercadopago-webhook`,
    };

    // If modder has connected MP account, use marketplace split
    if (modderProfile?.mercadopago_access_token) {
      // Use the modder's token with marketplace_fee for automatic split
      const mpResponse = await fetch(
        "https://api.mercadopago.com/v1/payments",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${modderProfile.mercadopago_access_token}`,
            "Content-Type": "application/json",
            "X-Idempotency-Key": purchase.id,
          },
          body: JSON.stringify({
            ...paymentBody,
            marketplace_fee: platformFee,
          }),
        }
      );

      const mpData = await mpResponse.json();

      if (!mpResponse.ok) {
        console.error("MP split payment error:", mpData);
        // Cleanup pending purchase
        await adminClient
          .from("purchases")
          .delete()
          .eq("id", purchase.id);
        return new Response(
          JSON.stringify({
            error: "Erro ao gerar pagamento PIX",
            details: mpData.message || mpData.cause?.[0]?.description,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      // Save payment info
      await adminClient
        .from("purchases")
        .update({
          payment_id: String(mpData.id),
          pix_qr_code:
            mpData.point_of_interaction?.transaction_data?.qr_code,
          pix_qr_code_base64:
            mpData.point_of_interaction?.transaction_data?.qr_code_base64,
        })
        .eq("id", purchase.id);

      return new Response(
        JSON.stringify({
          purchase_id: purchase.id,
          payment_id: mpData.id,
          qr_code:
            mpData.point_of_interaction?.transaction_data?.qr_code,
          qr_code_base64:
            mpData.point_of_interaction?.transaction_data?.qr_code_base64,
          amount,
          status: mpData.status,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fallback: no modder MP account, use platform account directly
    const mpResponse = await fetch(
      "https://api.mercadopago.com/v1/payments",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": purchase.id,
        },
        body: JSON.stringify(paymentBody),
      }
    );

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("MP payment error:", mpData);
      await adminClient.from("purchases").delete().eq("id", purchase.id);
      return new Response(
        JSON.stringify({
          error: "Erro ao gerar pagamento PIX",
          details: mpData.message || mpData.cause?.[0]?.description,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    await adminClient
      .from("purchases")
      .update({
        payment_id: String(mpData.id),
        pix_qr_code:
          mpData.point_of_interaction?.transaction_data?.qr_code,
        pix_qr_code_base64:
          mpData.point_of_interaction?.transaction_data?.qr_code_base64,
      })
      .eq("id", purchase.id);

    return new Response(
      JSON.stringify({
        purchase_id: purchase.id,
        payment_id: mpData.id,
        qr_code:
          mpData.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64:
          mpData.point_of_interaction?.transaction_data?.qr_code_base64,
        amount,
        status: mpData.status,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
