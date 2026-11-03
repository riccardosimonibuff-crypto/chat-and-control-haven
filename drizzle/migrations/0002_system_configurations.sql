CREATE TABLE public.system_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  key text NOT NULL CHECK (char_length(key) BETWEEN 1 AND 64),
  value text NOT NULL CHECK (char_length(value) <= 4000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_configurations TO authenticated;
GRANT ALL ON public.system_configurations TO service_role;
ALTER TABLE public.system_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY sc_select_own ON public.system_configurations FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY sc_insert_own ON public.system_configurations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY sc_update_own ON public.system_configurations FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY sc_delete_own ON public.system_configurations FOR DELETE TO authenticated USING (user_id = auth.uid());