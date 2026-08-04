CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  teacher_id uuid,
  session_id uuid,
  model text NOT NULL DEFAULT 'google/gemini-3.1-flash-lite',
  operation text NOT NULL DEFAULT 'merge',
  status text NOT NULL DEFAULT 'success',
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  credits numeric NOT NULL DEFAULT 0,
  fallback boolean NOT NULL DEFAULT false
);

GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;

ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads AI usage events"
ON public.ai_usage_events
FOR SELECT
TO authenticated
USING (public.is_owner(auth.uid()));

CREATE INDEX ai_usage_events_created_at_idx ON public.ai_usage_events (created_at DESC);