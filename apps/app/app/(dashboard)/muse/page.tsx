import MuseChat from "@/components/MuseChat";
import { getConversation } from "@/lib/muse/conversations";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{ c?: string }>;

export default async function MusePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const userId = user?.id ?? "";

  const { c: conversationId } = await searchParams;

  // If a conversation id is in the URL, hydrate its message history so
  // reloading the page restores the chat.
  const conversation = conversationId
    ? await getConversation(conversationId)
    : null;

  return (
    <MuseChat
      userId={userId}
      conversationId={conversationId}
      initialMessages={conversation?.messages ?? []}
    />
  );
}
