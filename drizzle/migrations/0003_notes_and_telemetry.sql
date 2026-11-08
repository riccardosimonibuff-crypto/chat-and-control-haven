CREATE TABLE public.vega_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vega_notes TO authenticated;
GRANT ALL ON public.vega_notes TO service_role;
ALTER TABLE public.vega_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY notes_select_own ON public.vega_notes FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY notes_insert_own ON public.vega_notes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY notes_update_own ON public.vega_notes FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY notes_delete_own ON public.vega_notes FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.vega_telemetry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  model text NOT NULL DEFAULT '',
  latency_ms integer NOT NULL DEFAULT 0,
  tokens integer NOT NULL DEFAULT 0,
  ok boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.vega_telemetry TO authenticated;
GRANT ALL ON public.vega_telemetry TO service_role;
ALTER TABLE public.vega_telemetry ENABLE ROW LEVEL SECURITY;
CREATE POLICY tel_select_own ON public.vega_telemetry FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY tel_insert_own ON public.vega_telemetry FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());