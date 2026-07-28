"use client";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type PresenceMember = { userId: string; name: string; pageId?: string; onlineAt: string };

export function useBookPresence(bookId: string, member: Omit<PresenceMember, "onlineAt">) {
  const [members, setMembers] = useState<PresenceMember[]>([{ ...member, onlineAt: new Date().toISOString() }]);
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "true") return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const channel = supabase.channel(`book:${bookId}`, { config: { presence: { key: member.userId } } });
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<PresenceMember>();
      setMembers(Object.values(state).flat());
    }).subscribe(async (status) => {
      if (status === "SUBSCRIBED") await channel.track({ ...member, onlineAt: new Date().toISOString() });
    });
    return () => { void supabase.removeChannel(channel); };
  }, [bookId, member.name, member.pageId, member.userId]);
  return members;
}
