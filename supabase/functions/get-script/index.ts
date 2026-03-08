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

    // Validate license
    const { data: license } = await supabase
      .from("licenses")
      .select("id, status, script_id")
      .eq("license_key", key)
      .single();

    if (!license || license.status !== "active") {
      return new Response(JSON.stringify({ error: "Invalid or banned license" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the script
    const { data: script } = await supabase
      .from("scripts")
      .select("lua_code, file_url, title")
      .eq("id", license.script_id)
      .single();

    if (!script) {
      return new Response(JSON.stringify({ error: "Script not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Return lua_code directly, or fetch from file_url
    let code = script.lua_code;
    if (!code && script.file_url) {
      try {
        const res = await fetch(script.file_url);
        code = await res.text();
      } catch {
        return new Response(JSON.stringify({ error: "Failed to fetch script file" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!code) {
      return new Response(JSON.stringify({ error: "No script content available" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(code, {
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
