import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "search_scripts",
  title: "Search marketplace scripts",
  description:
    "Search published HiddenMod marketplace scripts for Game Guardian. Filter by keyword, game name, or paid/free.",
  inputSchema: {
    query: z.string().optional().describe("Free-text search over title, description and game name."),
    game: z.string().optional().describe("Filter by game name (case-insensitive contains)."),
    only_free: z.boolean().optional().describe("If true, only return free scripts."),
    only_paid: z.boolean().optional().describe("If true, only return paid scripts."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, game, only_free, only_paid, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    let q = supabase
      .from("scripts")
      .select(
        "id, title, description, game_name, is_paid, price, average_rating, total_ratings, download_count, tags, created_at",
      )
      .eq("publish_status", "published")
      .eq("is_active", true)
      .order("download_count", { ascending: false })
      .limit(limit ?? 20);

    if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%,game_name.ilike.%${query}%`);
    if (game) q = q.ilike("game_name", `%${game}%`);
    if (only_free) q = q.eq("is_paid", false);
    if (only_paid) q = q.eq("is_paid", true);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { scripts: data ?? [] },
    };
  },
});
