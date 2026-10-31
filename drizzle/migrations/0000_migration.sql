CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role text NOT NULL CHECK (role IN ('user','assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.messages TO anon, authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON public.messages FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "public insert" ON public.messages FOR INSERT TO anon, authenticated WITH CHECK (char_length(content) BETWEEN 1 AND 8000);
CREATE POLICY "public delete" ON public.messages FOR DELETE TO anon, authenticated USING (true);
CREATE INDEX messages_created_at_idx ON public.messages(created_at);