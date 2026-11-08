import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Send, Trash2 } from "lucide-react";
import { SignInGate } from "@/components/SignInGate";
import { useVega } from "@/lib/vega-context";
import { useWakeListener } from "@/hooks/use-wake-listener";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { askGemini } from "@/lib/gemini.functions";
import { loadGemini } from "@/lib/gemini-settings";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "V.E.G.A · Chat Principale" },
    { name: "description", content: "Pannello di controllo centrale per dialogare con il tuo assistente V.E.G.A." },
    { property: "og:title", content: "V.E.G.A · Chat Principale" },
    { property: "og:description", content: "Pannello di controllo centrale per dialogare con il tuo assistente V.E.G.A." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <SignInGate><ChatPage /></SignInGate>,
});

type Msg = { id: string; role: "user" | "assistant"; content: string; created_at: string };

function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const ask = useServerFn(askGemini);
  const { speak, speaking } = useVega();
  const messagesRef = useRef<Msg[]>([]);
  messagesRef.current = messages;
  const busyRef = useRef(false);
  const locRef = useRef<{ lat: number; lon: number } | null>(null);
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((p) => { locRef.current = { lat: p.coords.latitude, lon: p.coords.longitude }; }, () => {}, { maximumAge: 600000 });
  }, []);
  const voice = useWakeListener((cmd) => { void submit(cmd, "voice"); }, speaking || thinking);

  useEffect(() => {
    supabase.from("messages").select("*").order("created_at").then(({ data, error }) => {
      if (error) setError(error.message);
      else setMessages((data ?? []) as Msg[]);
      setLoading(false);
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  async function save(role: Msg["role"], content: string, source: "typed" | "voice" = "typed") {
    const { data, error } = await supabase.from("messages").insert({ role, content, source }).select().single();
    if (error) throw error;
    setMessages((m) => [...m, data as Msg]);
    return data as Msg;
  }

  function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    void submit(text, "typed");
  }

  // Typed and wakeword commands share this single persistence/send path.
  async function submit(text: string, source: "typed" | "voice") {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setThinking(true);
    try {
      const userMsg = await save("user", text, source);
      const history = [...messagesRef.current, userMsg].slice(-20).map(({ role, content }) => ({ role, content }));
      const { apiKey, model } = loadGemini();
      const res = await ask({ data: { apiKey: apiKey || undefined, model, history, location: locRef.current } });
      if (!res.ok) throw new Error(res.error);
      speak(res.text);
      await save("assistant", res.text, source);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      busyRef.current = false;
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  async function clearAll() {
    if (!confirm("Cancellare tutta la cronologia?")) return;
    const { error } = await supabase.from("messages").delete().not("id", "is", null);
    if (error) setError(error.message);
    else setMessages([]);
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="panel flex h-16 items-center justify-between border-x-0 border-t-0 px-6">
        <div>
          <h1 className="font-display text-sm tracking-[0.3em] text-primary">CHAT PRINCIPALE</h1>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">
            {messages.length} messaggi in memoria
          </p>
        </div>
        <button onClick={clearAll} className="flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-xs text-muted-foreground hover:border-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" /> Reset
        </button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 px-6 py-8">
          {loading && <p className="font-mono text-xs text-muted-foreground">Caricamento memoria…</p>}
          {!loading && messages.length === 0 && (
            <div className="py-20 text-center">
              <p className="font-display text-xl tracking-widest text-primary text-glow">SISTEMI V.E.G.A ONLINE.</p>
              <p className="mt-3 font-mono text-sm text-muted-foreground">
                Pronto a gestire l'agenda e a risparmiarle ogni sforzo, signore. L'apatia è sotto controllo.
              </p>
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
              {m.role === "user" ? (
                <div className="max-w-[80%] rounded-lg border border-primary/40 bg-accent px-4 py-2.5 text-accent-foreground">
                  {m.content}
                </div>
              ) : (
                <div className="max-w-[85%]">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary">V.E.G.A</span>
                  <p className="mt-1 text-lg leading-relaxed">{m.content}</p>
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <div className="font-mono text-xs text-primary">
              <span className="animate-pulse">▍ V.E.G.A sta elaborando…</span>
            </div>
          )}
          {error && <p className="font-mono text-xs text-destructive">⚠ {error}</p>}
          <div ref={endRef} />
        </div>
      </div>

      <div className="border-t p-4">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="panel mx-auto flex max-w-3xl items-end gap-2 rounded-lg p-2 focus-within:glow"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            rows={1}
            placeholder="Scrivi un comando per V.E.G.A…"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => (voice.state === "off" || voice.state === "unsupported" || voice.state === "error" ? voice.start() : voice.stop())}
            aria-label={voice.state === "listening" ? "Disattiva ascolto" : "Attiva ascolto"}
            aria-pressed={voice.state === "listening" || voice.state === "paused"}
            className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${voice.state === "listening" ? "border-primary text-primary glow" : voice.state === "paused" || voice.state === "preparing" ? "border-primary/50 text-primary/70" : "text-muted-foreground hover:border-primary hover:text-primary"}`}
          >
            {voice.state === "listening" && <span className="animate-pulse-ring absolute inset-0 rounded-md border-2 border-primary" />}
            {voice.state === "unsupported" || voice.state === "error" ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            aria-label="Invia"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
        <p className="mx-auto mt-2 max-w-3xl font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {voice.message ?? (voice.state === "listening" ? "● In ascolto locale · dica \"Vega\" seguito dal comando" : voice.state === "paused" ? "Ascolto in pausa mentre V.E.G.A parla" : voice.state === "preparing" ? "Preparazione microfono…" : "Microfono spento")}
        </p>
      </div>
    </div>
  );
}
