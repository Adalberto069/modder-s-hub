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
      return new Response("invalid", { headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: license } = await supabase
      .from("script_licenses")
      .select("id, status, expires_at")
      .eq("license_key", key)
      .single();

    if (!license || license.status !== "active") {
      return new Response("invalid", { headers: corsHeaders });
    }

    // Check expiration
    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return new Response("expired", { headers: corsHeaders });
    }

    return new Response("valid", { headers: corsHeaders });
  } catch {
    return new Response("invalid", { headers: corsHeaders });
  }
});
