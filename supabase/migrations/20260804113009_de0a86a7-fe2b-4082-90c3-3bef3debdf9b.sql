-- ============ role helpers ============
CREATE OR REPLACE FUNCTION public.my_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_org_staff(_user_id uuid, _org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _org IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.organization_id = _org
      AND p.role IN ('owner', 'admin')
      AND p.approval_status = 'approved'
  )
$$;

-- staff may read and manage the profiles of their own organization
DROP POLICY IF EXISTS "org staff read org profiles" ON public.profiles;
CREATE POLICY "org staff read org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_org_staff(auth.uid(), organization_id));

DROP POLICY IF EXISTS "org staff manage org profiles" ON public.profiles;
CREATE POLICY "org staff manage org profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_org_staff(auth.uid(), organization_id))
  WITH CHECK (public.is_org_staff(auth.uid(), organization_id));

-- ============ classroom settings ============
CREATE TABLE public.classroom_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  question_confirm_pct integer NOT NULL DEFAULT 60,
  audio_detect_pct integer NOT NULL DEFAULT 50,
  resolve_pct integer NOT NULL DEFAULT 75,
  followup_seconds integer NOT NULL DEFAULT 75,
  spam_sensitivity integer NOT NULL DEFAULT 50,
  cooldown_ms integer NOT NULL DEFAULT 2000,
  archive_minutes integer NOT NULL DEFAULT 10,
  allow_teacher_override boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classroom_settings_scope CHECK (num_nonnulls(organization_id, teacher_id) = 1)
);
CREATE UNIQUE INDEX classroom_settings_org_key ON public.classroom_settings (organization_id) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX classroom_settings_teacher_key ON public.classroom_settings (teacher_id) WHERE teacher_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.classroom_settings TO authenticated;
GRANT SELECT ON public.classroom_settings TO anon;
GRANT ALL ON public.classroom_settings TO service_role;
ALTER TABLE public.classroom_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read settings" ON public.classroom_settings
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "teachers manage own settings" ON public.classroom_settings
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());
CREATE POLICY "staff manage org settings" ON public.classroom_settings
  FOR ALL TO authenticated
  USING (public.is_org_staff(auth.uid(), organization_id))
  WITH CHECK (public.is_org_staff(auth.uid(), organization_id));

CREATE TRIGGER classroom_settings_updated_at BEFORE UPDATE ON public.classroom_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ safety controls ============
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS chat_paused boolean NOT NULL DEFAULT false;

CREATE TABLE public.session_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_label text NOT NULL,
  kind text NOT NULL DEFAULT 'mute',
  until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_blocks TO authenticated;
GRANT SELECT ON public.session_blocks TO anon;
GRANT ALL ON public.session_blocks TO service_role;
ALTER TABLE public.session_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read blocks of live sessions" ON public.session_blocks
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.status = 'live'));
CREATE POLICY "teachers manage blocks" ON public.session_blocks
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE OR REPLACE FUNCTION public.can_post(_session_id uuid, _label text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = _session_id AND s.status = 'live' AND s.chat_paused = false
  ) AND NOT EXISTS (
    SELECT 1 FROM public.session_blocks b
    WHERE b.session_id = _session_id
      AND b.student_label = _label
      AND (b.kind = 'remove' OR b.until IS NULL OR b.until > now())
  )
$$;

DROP POLICY IF EXISTS "post messages to live sessions" ON public.messages;
CREATE POLICY "post messages to live sessions" ON public.messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.can_post(session_id, sender_label));

-- ============ quick reactions ============
CREATE TABLE public.session_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  student_label text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, student_label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_reactions TO anon;
GRANT ALL ON public.session_reactions TO service_role;
ALTER TABLE public.session_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read reactions of live sessions" ON public.session_reactions
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.status = 'live'));
CREATE POLICY "react in live sessions" ON public.session_reactions
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.can_post(session_id, student_label));
CREATE POLICY "change own reaction" ON public.session_reactions
  FOR UPDATE TO anon, authenticated
  USING (public.can_post(session_id, student_label))
  WITH CHECK (public.can_post(session_id, student_label));
CREATE POLICY "clear reactions in live sessions" ON public.session_reactions
  FOR DELETE TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.sessions s WHERE s.id = session_id AND s.status = 'live'));

CREATE TRIGGER session_reactions_updated_at BEFORE UPDATE ON public.session_reactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ threads: archival + AI failure ============
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS archived_at timestamptz;
ALTER TABLE public.threads ADD COLUMN IF NOT EXISTS ai_failed boolean NOT NULL DEFAULT false;
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS ai_failed boolean NOT NULL DEFAULT false;

-- ============ activity logs ============
CREATE TABLE public.activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  teacher_id uuid,
  session_id uuid,
  kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_session_idx ON public.activity_logs (session_id, created_at DESC);
CREATE INDEX activity_logs_teacher_idx ON public.activity_logs (teacher_id, created_at DESC);

GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT INSERT ON public.activity_logs TO anon;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "write logs" ON public.activity_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "teachers read own logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (teacher_id = auth.uid());
CREATE POLICY "staff read org logs" ON public.activity_logs
  FOR SELECT TO authenticated USING (public.is_org_staff(auth.uid(), organization_id));

-- ============ realtime ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.session_blocks;
