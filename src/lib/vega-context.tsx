import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { synthesizeVoice } from "@/lib/tts.functions";

type Ctx = {
  user: User | null | undefined;
  voiceEnabled: boolean;
  setVoiceEnabled: (v: boolean) => void;
  speak: (text: string) => void;
  speaking: boolean;
};
const VegaCtx = createContext<Ctx | null>(null);

export function useVega() {
  const c = useContext(VegaCtx);
  if (!c) throw new Error("VegaProvider mancante");
  return c;
}

export function VegaProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [voiceEnabled, setVoice] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const voiceRef = useRef(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seqRef = useRef(0);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setUser(session?.user ?? null);
      router.invalidate();
      if (event !== "SIGNED_OUT") qc.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, qc]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("voice_enabled").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data) { setVoice(data.voice_enabled); voiceRef.current = data.voice_enabled; }
    });
  }, [user]);

  const setVoiceEnabled = useCallback((v: boolean) => {
    setVoice(v);
    voiceRef.current = v;
    if (!v && typeof window !== "undefined") { window.speechSynthesis?.cancel(); audioRef.current?.pause(); seqRef.current++; setSpeaking(false); }
    if (user) void supabase.from("profiles").update({ voice_enabled: v }).eq("id", user.id);
  }, [user]);

  const speakLocal = useCallback((clean: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) { setSpeaking(false); return; }
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "it-IT";
    const voices = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith("it"));
    u.voice = voices.find((v) => /google|natural|enhanced|premium/i.test(v.name)) ?? voices[0] ?? null;
    u.rate = 1.05;
    u.onstart = () => setSpeaking(true);
    u.onend = u.onerror = () => setSpeaking(false);
    synth.speak(u);
  }, []);

  const speak = useCallback((text: string) => {
    if (!voiceRef.current || typeof window === "undefined") return;
    const clean = text.replace(/[*#_`]/g, "").trim();
    if (!clean) return;
    window.speechSynthesis?.cancel();
    audioRef.current?.pause();
    const seq = ++seqRef.current;
    setSpeaking(true);
    synthesizeVoice({ data: { text: clean } })
      .then(({ audio, type }) => {
        if (seq !== seqRef.current || !voiceRef.current) return;
        const el = new Audio(`data:${type};base64,${audio}`);
        audioRef.current = el;
        el.onended = el.onerror = () => { if (seq === seqRef.current) setSpeaking(false); };
        return el.play();
      })
      .catch((e) => {
        console.warn("Voce neurale non disponibile, uso voce del dispositivo", e);
        if (seq === seqRef.current && voiceRef.current) speakLocal(clean);
      });
  }, [speakLocal]);

  return <VegaCtx.Provider value={{ user, voiceEnabled, setVoiceEnabled, speak, speaking }}>{children}</VegaCtx.Provider>;
}
