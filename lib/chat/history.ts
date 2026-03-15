import type { SupabaseClient } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";

/** Maximum number of messages to include in the conversation window (MVP). */
const DEFAULT_WINDOW_SIZE = 20;

/**
 * Fetch windowed conversation history for a tenant on a given channel.
 *
 * Returns the most recent `limit` messages ordered ascending (oldest first)
 * so the array can be passed directly to the Anthropic messages API.
 *
 * TODO: For long conversations, generate a summary of older messages
 * and prepend it as a system-injected context block.
 */
export async function getConversationHistory(
  supabase: SupabaseClient,
  tenantId: string,
  channel: "web" | "sms",
  limit: number = DEFAULT_WINDOW_SIZE
): Promise<Anthropic.MessageParam[]> {
  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .order("created_at", { ascending: false })
    .limit(limit);

  // Reverse so oldest is first (ascending order for Claude)
  const rows = (history ?? []).reverse();

  return rows.map((msg: { role: string; content: string }) => ({
    role: msg.role as "user" | "assistant",
    content: msg.content,
  }));
}
