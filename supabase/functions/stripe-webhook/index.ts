import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const event = JSON.parse(body);

    // For production, you should verify the Stripe signature
    // const sig = req.headers.get("stripe-signature");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const purchaseId = session.metadata?.purchase_id;
      const scriptId = session.metadata?.script_id;
      const userId = session.metadata?.user_id;
      const isRenewal = session.metadata?.is_renewal === "true";

      if (!purchaseId || !scriptId || !userId) {
        console.error("Missing metadata in session:", session.metadata);
        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update purchase status
      await supabase
        .from("purchases")
        .update({ status: "completed", payment_id: session.payment_intent || session.id })
        .eq("id", purchaseId);

      // Get script for license duration
      const { data: script } = await supabase
        .from("scripts")
        .select("license_duration_days, title")
        .eq("id", scriptId)
        .single();

      const durationDays = script?.license_duration_days;

      if (isRenewal) {
        // Find existing license and extend
        const { data: existingLicense } = await supabase
          .from("licenses")
          .select("*")
          .eq("script_id", scriptId)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existingLicense && durationDays) {
          const currentExpiry = existingLicense.expires_at
            ? new Date(existingLicense.expires_at)
            : new Date();
          const baseDate = currentExpiry < new Date() ? new Date() : currentExpiry;
          const newExpiry = new Date(baseDate.getTime() + durationDays * 86400000).toISOString();

          await supabase
            .from("licenses")
            .update({ expires_at: newExpiry, status: "active" })
            .eq("id", existingLicense.id);
        }
      } else {
        // Generate license key
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

        await supabase.from("licenses").insert({
          user_id: userId,
          script_id: scriptId,
          purchase_id: purchaseId,
          license_key: licenseKey,
          status: "active",
          expires_at: expiresAt,
        });

        // Grant script access
        await supabase.from("script_access").insert({
          user_id: userId,
          script_id: scriptId,
        });

        // Increment download count
        const { data: scriptData } = await supabase
          .from("scripts")
          .select("download_count")
          .eq("id", scriptId)
          .single();

        if (scriptData) {
          await supabase
            .from("scripts")
            .update({ download_count: (scriptData.download_count || 0) + 1 })
            .eq("id", scriptId);
        }
      }

      console.log("Payment completed for purchase:", purchaseId);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
