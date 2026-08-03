import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { fetchPollResponses, fetchPolls } from "@/lib/polls";

/** Live view of every automatic classroom health check in a session. */
export function usePolls(sessionId: string | null) {
  const queryClient = useQueryClient();

  const pollsQuery = useQuery({
    queryKey: ["polls", sessionId],
    queryFn: () => fetchPolls(sessionId!),
    enabled: !!sessionId,
  });
  const responsesQuery = useQuery({
    queryKey: ["poll-responses", sessionId],
    queryFn: () => fetchPollResponses(sessionId!),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase.channel(`polls-${sessionId}`);
    for (const [table, key] of [
      ["polls", "polls"],
      ["poll_responses", "poll-responses"],
    ] as const) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `session_id=eq.${sessionId}` },
        () => queryClient.invalidateQueries({ queryKey: [key, sessionId] }),
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId, queryClient]);

  return {
    polls: pollsQuery.data ?? [],
    responses: responsesQuery.data ?? [],
  };
}
