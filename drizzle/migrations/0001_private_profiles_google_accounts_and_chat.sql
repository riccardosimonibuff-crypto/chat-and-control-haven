CREATE TABLE public.profiles (
 id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 display_name text NOT NULL DEFAULT '',
 avatar_url text,
 voice_enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_read_own ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE FUNCTION public.create_vega_profile() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN INSERT INTO public.profiles(id, display_name) VALUES(NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', '')) ON CONFLICT(id) DO NOTHING; RETURN NEW; END; $$;
CREATE TRIGGER vega_profile_on_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.create_vega_profile();
INSERT INTO public.profiles(id, display_name) SELECT id, COALESCE(raw_user_meta_data->>'full_name','') FROM auth.users ON CONFLICT(id) DO NOTHING;
CREATE TABLE public.google_accounts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 google_subject text NOT NULL,
 email text NOT NULL,
 access_token_ciphertext text NOT NULL,
 refresh_token_ciphertext text NOT NULL,
 expires_at timestamptz NOT NULL,
 scopes text NOT NULL,
 reconnect_required boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(user_id, google_subject)
);
GRANT ALL ON public.google_accounts TO service_role;
ALTER TABLE public.google_accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX google_accounts_user_idx ON public.google_accounts(user_id);
CREATE TABLE public.google_oauth_states (
 state text PRIMARY KEY,
 user_id uuid NOT NULL,
 verifier_ciphertext text NOT NULL,
 redirect_uri text NOT NULL,
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);
GRANT ALL ON public.google_oauth_states TO service_role;
ALTER TABLE public.google_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ADD COLUMN user_id uuid DEFAULT auth.uid();
ALTER TABLE public.messages ADD COLUMN source text NOT NULL DEFAULT 'typed' CHECK(source IN ('typed', 'voice', 'assistant'));
DROP POLICY "public read" ON public.messages;
DROP POLICY "public insert" ON public.messages;
DROP POLICY "public delete" ON public.messages;
REVOKE ALL ON public.messages FROM anon;
CREATE POLICY messages_read_own ON public.messages FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY messages_insert_own ON public.messages FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND char_length(content) BETWEEN 1 AND 8000);
CREATE POLICY messages_delete_own ON public.messages FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE INDEX messages_user_time_idx ON public.messages(user_id, created_at);
COMMENT ON TABLE public.messages IS 'Private per-user chat. Historical rows without user_id remain inaccessible and are not assigned to an arbitrary user.';