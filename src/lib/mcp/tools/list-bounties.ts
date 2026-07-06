import { defineTool } from "@lovable.dev/mcp-js";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

export default defineTool({
  name: "list_bounties",
  title: "List open bounties",
  description: "List HiddenMod bounties (script requests) with their reward and status.",
  inputSchema: {
    status: z.enum(["open", "in_progress", "completed", "cancelled"]).optional(),
    game: z.string().optional().describe("Filter by game name (contains)."),
    limit: z.number().int().min(1).max(50).optional(),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, game, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } },
    );
    let q = supabase
      .from("bounties")
      .select("id, title, description, game_name, reward_amount, status, deadline, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);
    else q = q.eq("status", "open");
    if (game) q = q.ilike("game_name", `%${game}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { bounties: data ?? [] },
    };
  },
});
