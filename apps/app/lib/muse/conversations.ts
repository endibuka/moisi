/**
 * Server-side queries + mutations for Muse chat persistence.
 *
 * Tables: muse_conversations + muse_messages (see migrations/0004).
 * All access goes through the request-scoped Supabase client so RLS
 * enforces "users only see their own" automatically.
 */
import "server-only";

import { createClient } from "@/lib/supabase/server";

export type MessageRole = "user" | "muse";

export type ToolEvent = {
  name: string;
  status: "calling" | "done" | "error";
  message?: string;
};

export type MuseMessage = {
  id: string;
  conversation_id: string;
  role: MessageRole;
  content: string;
  attachment_path: string | null;
  attachment_name: string | null;
  tool_events: ToolEvent[] | null;
  created_at: string;
};

export type MuseConversationSummary = {
  id: string;
  title: string;
  updated_at: string;
};

export type MuseConversationWithMessages = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: MuseMessage[];
};

/** Derive a tidy title from the first user message. */
export function deriveTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage
    // strip the attachment metadata footer we append server-side
    .replace(/\n*\[attached audio \|[^\]]*\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "New chat";
  return cleaned.length > 60 ? `${cleaned.slice(0, 60).trimEnd()}…` : cleaned;
}

/** List the user's conversations, most-recently-touched first. */
export async function listConversations(
  limit = 50,
): Promise<MuseConversationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("muse_conversations")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[muse] listConversations error:", error);
    return [];
  }
  return (data ?? []) as MuseConversationSummary[];
}

/** Fetch a single conversation with its full message history in chronological order. */
export async function getConversation(
  id: string,
): Promise<MuseConversationWithMessages | null> {
  const supabase = await createClient();
  const { data: conv, error: convError } = await supabase
    .from("muse_conversations")
    .select("id, title, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (convError) {
    console.error("[muse] getConversation conv error:", convError);
    return null;
  }
  if (!conv) return null;

  const { data: messages, error: msgError } = await supabase
    .from("muse_messages")
    .select(
      "id, conversation_id, role, content, attachment_path, attachment_name, tool_events, created_at",
    )
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (msgError) {
    console.error("[muse] getConversation msgs error:", msgError);
    return { ...conv, messages: [] };
  }

  return { ...conv, messages: (messages ?? []) as MuseMessage[] };
}

/**
 * Save a complete turn: the user message + the muse reply (with any tool
 * events). Also upserts the conversation row, setting the title from the
 * first user message if this is the first turn, and always bumps updated_at.
 *
 * Returns whether this was the first turn (useful so the client can refresh
 * the sidebar's conversation list).
 */
export async function saveTurn(args: {
  conversationId: string;
  userMessage: {
    content: string;
    attachmentPath: string | null;
    attachmentName: string | null;
  };
  museMessage: {
    content: string;
    toolEvents: ToolEvent[] | null;
  };
}): Promise<{ isFirstTurn: boolean } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Is this the first turn? (No prior messages.)
  const { count } = await supabase
    .from("muse_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", args.conversationId);
  const isFirstTurn = (count ?? 0) === 0;

  // Upsert the conversation row. On first turn, derive the title from the
  // user message; on later turns, keep the existing title and just bump
  // updated_at (the upsert handles both cases — on conflict we update only
  // updated_at via a follow-up update, since upsert can't conditionally
  // update some columns).
  if (isFirstTurn) {
    const title = deriveTitle(args.userMessage.content);
    const { error: convErr } = await supabase
      .from("muse_conversations")
      .upsert(
        {
          id: args.conversationId,
          user_id: user.id,
          title,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );
    if (convErr) {
      console.error("[muse] saveTurn upsert conv error:", convErr);
      return { error: convErr.message };
    }
  } else {
    const { error: bumpErr } = await supabase
      .from("muse_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", args.conversationId);
    if (bumpErr) {
      console.error("[muse] saveTurn bump conv error:", bumpErr);
    }
  }

  // Both messages inserted in one round-trip.
  const now = new Date();
  const { error: insertErr } = await supabase.from("muse_messages").insert([
    {
      conversation_id: args.conversationId,
      user_id: user.id,
      role: "user",
      content: args.userMessage.content,
      attachment_path: args.userMessage.attachmentPath,
      attachment_name: args.userMessage.attachmentName,
      created_at: now.toISOString(),
    },
    {
      conversation_id: args.conversationId,
      user_id: user.id,
      role: "muse",
      content: args.museMessage.content,
      tool_events:
        args.museMessage.toolEvents && args.museMessage.toolEvents.length > 0
          ? args.museMessage.toolEvents
          : null,
      // +1ms so ORDER BY created_at puts muse strictly after user.
      created_at: new Date(now.getTime() + 1).toISOString(),
    },
  ]);
  if (insertErr) {
    console.error("[muse] saveTurn insert msgs error:", insertErr);
    return { error: insertErr.message };
  }

  return { isFirstTurn };
}

/** Delete a conversation (cascade drops its messages via FK). */
export async function deleteConversation(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("muse_conversations")
    .delete()
    .eq("id", id);
  if (error) console.error("[muse] deleteConversation error:", error);
}
