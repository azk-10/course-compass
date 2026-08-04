import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import { fetchBlocks, fetchReactions } from "@/lib/moderation";

/** Live moderation state: mutes/removals plus classroom acknowledgements. */
export function useSessionPulse(sessionId: string | null) {
  const queryClient = useQueryClient();

  const blocks = useQuery({
    queryKey: ["blocks", sessionId],
    queryFn: () => fetchBlocks(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: 5_000,
  });

  const reactions = useQuery({
    queryKey: ["reactions", sessionId],
    queryFn: () => fetchReactions(sessionId as string),
    enabled: Boolean(sessionId),
    staleTime: 3_000,
  });

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`pulse:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_blocks", filter: `session_id=eq.${sessionId}` },
        () => void queryClient.invalidateQueries({ queryKey: ["blocks", sessionId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "session_reactions", filter: `session_id=eq.${sessionId}` },
        () => void queryClient.invalidateQueries({ queryKey: ["reactions", sessionId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  return {
    blocks: blocks.data ?? [],
    reactions: reactions.data ?? [],
  };
}
