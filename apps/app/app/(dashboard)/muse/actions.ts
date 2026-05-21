"use server";

import { revalidatePath } from "next/cache";
import {
  deleteConversation,
  getConversation,
  listConversations,
  type MuseConversationSummary,
  type MuseConversationWithMessages,
} from "@/lib/muse/conversations";

export async function deleteMuseConversation(id: string): Promise<void> {
  await deleteConversation(id);
  revalidatePath("/muse", "layout");
}

/** Query-friendly wrappers. TanStack Query calls these via `queryFn`. */
export async function fetchMuseConversations(): Promise<
  MuseConversationSummary[]
> {
  return listConversations(50);
}

export async function fetchMuseConversation(
  id: string,
): Promise<MuseConversationWithMessages | null> {
  return getConversation(id);
}
