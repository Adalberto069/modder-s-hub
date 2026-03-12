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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;
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

    // Get purchase
    const { data: purchase } = await serviceClient
      .from("purchases")
      .select("*")
      .eq("id", purchase_id)
      .eq("user_id", userId)
      .single();

    if (!purchase) {
      return new Response(JSON.stringify({ error: "Purchase not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Already completed
    if (purchase.status === "completed") {
      const { data: license } = await serviceClient
        .from("licenses")
        .select("license_key")
        .eq("purchase_id", purchase_id)
        .single();

      return new Response(
        JSON.stringify({ status: "completed", license_key: license?.license_key }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!purchase.payment_id) {
      return new Response(
        JSON.stringify({ status: "pending" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check with Mercado Pago
    const accessToken = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(JSON.stringify({ error: "Payment gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${purchase.payment_id}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const mpData = await mpResponse.json();

    if (mpData.status === "approved") {
      // Complete the purchase
      await serviceClient
        .from("purchases")
        .update({ status: "completed" })
        .eq("id", purchase_id);

      // Get script for license duration
      const { data: script } = await serviceClient
        .from("scripts")
        .select("license_duration_days")
        .eq("id", purchase.script_id)
        .single();

      // Generate license key
      const { data: licenseKey } = await serviceClient.rpc("generate_license_key");

      const expiresAt = script?.license_duration_days
        ? new Date(Date.now() + script.license_duration_days * 86400000).toISOString()
        : null;

      // Check if renewal (existing license)
      const { data: existingLicense } = await serviceClient
        .from("licenses")
        .select("id, expires_at")
        .eq("script_id", purchase.script_id)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let finalLicenseKey = licenseKey;

      if (existingLicense) {
        // Renewal: extend expiration
        const baseDate = existingLicense.expires_at && new Date(existingLicense.expires_at) > new Date()
          ? new Date(existingLicense.expires_at)
          : new Date();
        const newExpiry = script?.license_duration_days
          ? new Date(baseDate.getTime() + script.license_duration_days * 86400000).toISOString()
          : null;

        await serviceClient
          .from("licenses")
          .update({ expires_at: newExpiry, status: "active" })
          .eq("id", existingLicense.id);

        // Get existing key
        const { data: lic } = await serviceClient
          .from("licenses")
          .select("license_key")
          .eq("id", existingLicense.id)
          .single();
        finalLicenseKey = lic?.license_key ?? licenseKey;
      } else {
        // New license
        await serviceClient.from("licenses").insert({
          user_id: userId,
          script_id: purchase.script_id,
          purchase_id: purchase_id,
          license_key: licenseKey,
          status: "active",
          expires_at: expiresAt,
        });

        // Grant access
        await serviceClient.from("script_access").insert({
          user_id: userId,
          script_id: purchase.script_id,
        });

        // Increment download count
        const { data: currentScript } = await serviceClient
          .from("scripts")
          .select("download_count")
          .eq("id", purchase.script_id)
          .single();

        await serviceClient
          .from("scripts")
          .update({ download_count: (currentScript?.download_count ?? 0) + 1 })
          .eq("id", purchase.script_id);
      }

      return new Response(
        JSON.stringify({ status: "completed", license_key: finalLicenseKey }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Map MP statuses
    const statusMap: Record<string, string> = {
      pending: "pending",
      in_process: "pending",
      rejected: "rejected",
      cancelled: "cancelled",
    };

    return new Response(
      JSON.stringify({ status: statusMap[mpData.status] ?? mpData.status }),
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
