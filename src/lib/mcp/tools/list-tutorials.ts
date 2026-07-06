import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_tutorials",
  title: "List tutorials",
  description: "List HiddenMod tutorials about Game Guardian, emulators, Lua scripting, etc.",
  inputSchema: {
    query: z.string().optional().describe("Optional keyword filter (title/description)."),
    category: z.string().optional().describe("Optional category filter."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    let q = supabase
      .from("tutorials")
      .select("id, title, description, category, thumbnail_url, video_url, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (query) q = q.or(`title.ilike.%${query}%,description.ilike.%${query}%`);
    if (category) q = q.eq("category", category);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { tutorials: data ?? [] },
    };
  },
});
