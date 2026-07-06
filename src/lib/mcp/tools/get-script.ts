import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "get_script",
  title: "Get script details",
  description: "Fetch full public details for a HiddenMod script by its UUID.",
  inputSchema: {
    id: z.string().uuid().describe("The script UUID."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase
      .from("scripts")
      .select(
        "id, title, description, game_name, version, features, tags, is_paid, price, license_duration_days, average_rating, total_ratings, download_count, is_verified, script_type, video_url, thumbnail_url, created_at, updated_at",
      )
      .eq("id", id)
      .eq("publish_status", "published")
      .eq("is_active", true)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Script not found." }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { script: data },
    };
  },
});
