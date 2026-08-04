import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { isAudioIssue, toCategory } from "@/lib/classify";
import {
  buildStats,
  fetchFeedback,
  fetchParticipants,
  fetchThreads,
  fetchVotes,
} from "@/lib/threads";

/**
 * Live aggregate of every merged thread in a session: counts, upvotes,
 * resolution feedback and derived priority — all updating in real time.
 * When a classroom audio check fails, audio threads jump to the very top.
 */
export function useThreads(sessionId: string | null, threshold = 75, audioAlert = false) {
  const queryClient = useQueryClient();

  const threadsQuery = useQuery({
    queryKey: ["threads", sessionId],
    queryFn: () => fetchThreads(sessionId!),
    enabled: !!sessionId,
  });
  const participantsQuery = useQuery({
    queryKey: ["thread-participants", sessionId],
    queryFn: () => fetchParticipants(sessionId!),
    enabled: !!sessionId,
  });
  const votesQuery = useQuery({
    queryKey: ["thread-votes", sessionId],
    queryFn: () => fetchVotes(sessionId!),
    enabled: !!sessionId,
  });
  const feedbackQuery = useQuery({
    queryKey: ["thread-feedback", sessionId],
    queryFn: () => fetchFeedback(sessionId!),
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (!sessionId) return;
    const tables: [string, string][] = [
      ["threads", "threads"],
      ["thread_participants", "thread-participants"],
      ["thread_votes", "thread-votes"],
      ["thread_feedback", "thread-feedback"],
    ];
    const channel = supabase.channel(`threads-${sessionId}`);
    for (const [table, key] of tables) {
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

  const threads = threadsQuery.data ?? [];
  const participants = participantsQuery.data ?? [];
  const votes = votesQuery.data ?? [];
  const feedback = feedbackQuery.data ?? [];

  const stats = useMemo(() => {
    const boosted = audioAlert
      ? threads
          .filter(
            (thread) => toCategory(thread.category) === "technical" && isAudioIssue(thread.title),
          )
          .map((thread) => thread.id)
      : [];
    return buildStats({ threads, participants, votes, feedback, threshold, boosted });
  }, [threads, participants, votes, feedback, threshold, audioAlert]);

  return {
    threads,
    participants,
    votes,
    feedback,
    stats,
    isLoading: threadsQuery.isLoading,
  };
}
