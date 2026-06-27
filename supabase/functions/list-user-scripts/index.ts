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
    const url = new URL(req.url);
    const key = url.searchParams.get("key");

    if (!key) {
      return new Response(JSON.stringify({ error: "License key required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Validate the provided key and get the user_id
    const { data: initialLicense, error: licenseError } = await supabase
      .from("script_licenses")
      .select("user_id, status")
      .eq("license_key", key)
      .single();

    if (licenseError || !initialLicense || initialLicense.status !== "active") {
      return new Response(JSON.stringify({ error: "Invalid or inactive key" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get all active licenses for this user to list all their scripts
    const { data: allLicenses, error: allDocsError } = await supabase
      .from("script_licenses")
      .select(`
        license_key,
        scripts (
          id,
          title,
          description
        )
      `)
      .eq("user_id", initialLicense.user_id)
      .eq("status", "active");

    if (allDocsError) throw allDocsError;

    // Format the response for the GG Loader
    const scriptsList = allLicenses.map(l => {
      const script = Array.isArray(l.scripts) ? l.scripts[0] : l.scripts;
      return {
        key: l.license_key,
        id: script?.id,
        title: script?.title,
        description: script?.description
      };
    });

    return new Response(JSON.stringify({ scripts: scriptsList }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
