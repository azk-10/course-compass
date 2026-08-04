-- Owner helper ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_owner(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'owner')
$$;

-- Grant owner role to the designated owner email, now and on future signup ----
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'owner'::app_role FROM auth.users WHERE lower(email) = 'ashhadzubair10@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.grant_owner_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF lower(NEW.email) = 'ashhadzubair10@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_owner
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_owner_role();

-- 1. Plans --------------------------------------------------------------------
CREATE TABLE public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('teacher','academy','enterprise')),
  base_price_cents integer NOT NULL DEFAULT 0,
  included_classes integer NOT NULL DEFAULT 0,
  included_teachers integer NOT NULL DEFAULT 0,
  included_students integer NOT NULL DEFAULT 0,
  included_ai_messages integer NOT NULL DEFAULT 0,
  extra_class_price_cents integer NOT NULL DEFAULT 0,
  extra_teacher_price_cents integer NOT NULL DEFAULT 0,
  student_block_size integer NOT NULL DEFAULT 10,
  extra_student_block_price_cents integer NOT NULL DEFAULT 0,
  is_custom boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans_public_read" ON public.plans FOR SELECT USING (true);
CREATE POLICY "plans_owner_write" ON public.plans FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE TRIGGER plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plans (id,name,kind,base_price_cents,included_classes,included_teachers,included_students,included_ai_messages,extra_class_price_cents,extra_teacher_price_cents,student_block_size,extra_student_block_price_cents,is_custom,sort_order) VALUES
 ('teacher','Teacher','teacher',2000,1,1,20,5000,500,0,10,500,false,1),
 ('academy','Academy','academy',10000,0,10,300,15000,0,1000,10,500,false,2),
 ('enterprise','School / Enterprise','enterprise',0,0,0,0,0,0,0,10,0,true,3);

-- 2. Subscriptions -------------------------------------------------------------
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','expired','pending')),
  classes_allowed integer NOT NULL DEFAULT 1,
  teachers_allowed integer NOT NULL DEFAULT 1,
  students_allowed integer NOT NULL DEFAULT 20,
  ai_messages_allowed integer NOT NULL DEFAULT 5000,
  storage_mb_allowed integer NOT NULL DEFAULT 1024,
  unlimited_classes boolean NOT NULL DEFAULT false,
  unlimited_teachers boolean NOT NULL DEFAULT false,
  unlimited_students boolean NOT NULL DEFAULT false,
  unlimited_ai boolean NOT NULL DEFAULT false,
  unlimited_storage boolean NOT NULL DEFAULT false,
  is_free boolean NOT NULL DEFAULT false,
  custom_base_price_cents integer,
  notes text,
  current_period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  current_period_end date NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month - 1 day')::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX subscriptions_owner_unique ON public.subscriptions(owner_user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subs_read_own" ON public.subscriptions FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.is_owner(auth.uid()));
CREATE POLICY "subs_owner_all" ON public.subscriptions FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Invoices ------------------------------------------------------------------
CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('draft','pending','paid','failed','overdue','waived','refunded')),
  base_cents integer NOT NULL DEFAULT 0,
  extra_classes integer NOT NULL DEFAULT 0,
  extra_classes_cents integer NOT NULL DEFAULT 0,
  extra_teachers integer NOT NULL DEFAULT 0,
  extra_teachers_cents integer NOT NULL DEFAULT 0,
  extra_student_blocks integer NOT NULL DEFAULT 0,
  extra_students_cents integer NOT NULL DEFAULT 0,
  discount_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  ai_messages_used integer NOT NULL DEFAULT 0,
  notes text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_subscription_idx ON public.invoices(subscription_id, period_start DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invoices_read_own" ON public.invoices FOR SELECT TO authenticated
  USING (public.is_owner(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND s.owner_user_id = auth.uid()));
CREATE POLICY "invoices_owner_all" ON public.invoices FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Usage counters --------------------------------------------------------------
CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  user_id uuid,
  period_month date NOT NULL DEFAULT date_trunc('month', now())::date,
  ai_messages integer NOT NULL DEFAULT 0,
  storage_bytes bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usage_counters_unique ON public.usage_counters(subscription_id, period_month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.usage_counters TO authenticated;
GRANT ALL ON public.usage_counters TO service_role;
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage_read_own" ON public.usage_counters FOR SELECT TO authenticated
  USING (public.is_owner(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND s.owner_user_id = auth.uid()));
CREATE POLICY "usage_owner_all" ON public.usage_counters FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE TRIGGER usage_counters_updated_at BEFORE UPDATE ON public.usage_counters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Capacity events (audit trail of upsells) --------------------------------------
CREATE TABLE public.capacity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('class','teacher','student_block','ai_messages','storage')),
  quantity integer NOT NULL DEFAULT 1,
  unit_price_cents integer NOT NULL DEFAULT 0,
  amount_cents integer NOT NULL DEFAULT 0,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX capacity_events_sub_idx ON public.capacity_events(subscription_id, created_at DESC);
GRANT SELECT, INSERT ON public.capacity_events TO authenticated;
GRANT ALL ON public.capacity_events TO service_role;
ALTER TABLE public.capacity_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "capacity_read_own" ON public.capacity_events FOR SELECT TO authenticated
  USING (public.is_owner(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_id AND s.owner_user_id = auth.uid()));
CREATE POLICY "capacity_owner_all" ON public.capacity_events FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));

-- 6. System settings ---------------------------------------------------------------
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_public_read" ON public.system_settings FOR SELECT USING (true);
CREATE POLICY "settings_owner_write" ON public.system_settings FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE TRIGGER system_settings_updated_at BEFORE UPDATE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.system_settings (key, value) VALUES
 ('maintenance_mode','{"enabled":false,"message":""}'::jsonb),
 ('announcement','{"enabled":false,"message":""}'::jsonb),
 ('feature_flags','{"ai_merge":true,"demo_mode":true}'::jsonb);

-- 7. Profiles: owner visibility + account state ---------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';
CREATE POLICY "profiles_owner_all" ON public.profiles FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "orgs_owner_all" ON public.organizations FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "courses_owner_all" ON public.courses FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "enrollments_owner_all" ON public.enrollments FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));
CREATE POLICY "leads_owner_all" ON public.sales_leads FOR ALL TO authenticated
  USING (public.is_owner(auth.uid())) WITH CHECK (public.is_owner(auth.uid()));