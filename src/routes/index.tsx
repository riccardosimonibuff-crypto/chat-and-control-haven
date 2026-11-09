import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BarChart3, Mail, MessageSquare, Mic, MicOff, Send, Trash2 } from "lucide-react";
import { listGoogleAccounts } from "@/lib/google-oauth.functions";
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
      const msg = e instanceof Error ? e.message : String(e);
      if (/unauthor|401|jwt|session/i.test(msg)) {
        setError("Sessione scaduta: effettua di nuovo l'accesso.");
        await supabase.auth.signOut();
      } else setError(msg || "Errore sconosciuto");
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

  const listening = voice.state === "listening";
  const time = (iso: string) => new Date(iso).toLocaleTimeString("it-IT");

  return (
    <div className="hud-bg flex min-h-screen flex-col gap-4 p-4 xl:h-screen">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 60 40" className="h-9 w-12 text-primary drop-shadow-[0_0_6px_var(--glow)]" aria-hidden>
            <path d="M2 4 L30 36 L58 4 L44 4 L30 22 L16 4 Z" fill="none" stroke="currentColor" strokeWidth="3" />
          </svg>
          <div>
            <h1 className="font-display text-2xl tracking-[0.35em] text-primary text-glow">V.E.G.A.</h1>
            <p className="text-sm text-primary/80">Virtual Engine Governing Apatia</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="hidden font-display text-xs tracking-[0.3em] text-primary md:inline">ANALYSE // PROCESS // RESPOND</span>
          <button onClick={clearAll} aria-label="Cancella cronologia" className="hud-chip flex items-center gap-1 px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" /> RESET
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
        {/* CHAT */}
        <section className="hud-panel flex min-h-[520px] flex-col xl:min-h-0">
          <PanelTitle icon={<MessageSquare className="h-5 w-5" />}>CHAT INTERFACE</PanelTitle>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {loading && <p className="font-mono text-xs text-muted-foreground">Caricamento memoria…</p>}
            {!loading && messages.length === 0 && (
              <p className="py-10 text-center font-display text-sm tracking-widest text-primary text-glow">SISTEMI V.E.G.A ONLINE.</p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "hud-bubble" : "hud-bubble hud-bubble-vega"}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-primary">{m.role === "user" ? "Tu" : "V.E.G.A."}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{time(m.created_at)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-base leading-snug">{m.content}</p>
              </div>
            ))}
            {thinking && <p className="animate-pulse font-mono text-xs text-primary">▍ V.E.G.A sta elaborando…</p>}
            {error && <p className="font-mono text-xs text-destructive">⚠ {error}</p>}
            <div ref={endRef} />
          </div>

          <div className="border-t border-primary/20 px-4 pt-3 pb-4">
            <div className="flex items-center justify-center gap-3">
              <Wave active={listening} />
              <button
                type="button"
                onClick={() => (voice.state === "off" || voice.state === "unsupported" || voice.state === "error" ? voice.start() : voice.stop())}
                aria-label={listening ? "Disattiva ascolto" : "Attiva ascolto"}
                aria-pressed={listening || voice.state === "paused"}
                className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 ${listening ? "border-primary text-primary glow" : "border-primary/40 text-primary/70 hover:border-primary"}`}
              >
                {listening && <span className="animate-pulse-ring absolute inset-0 rounded-full border-2 border-primary" />}
                {voice.state === "unsupported" || voice.state === "error" ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
              </button>
              <Wave active={listening} />
            </div>
            <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-primary/80">
              {voice.message ?? (listening ? "Awaiting vocal command… listening for 'Vega'" : voice.state === "paused" ? "Ascolto in pausa mentre V.E.G.A parla" : voice.state === "preparing" ? "Preparazione microfono…" : "Microfono spento")}
            </p>
            <form onSubmit={(e) => { e.preventDefault(); send(); }} className="hud-chip mt-3 flex items-end gap-2 p-1.5">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                rows={1}
                placeholder="Scrivi un comando per V.E.G.A…"
                className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 font-mono text-sm outline-none placeholder:text-muted-foreground"
              />
              <button type="submit" disabled={!input.trim() || thinking} aria-label="Invia" className="flex h-8 w-8 items-center justify-center rounded bg-primary text-primary-foreground disabled:opacity-40">
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </section>

        {/* CORE */}
        <section className="flex flex-col items-center justify-center gap-6 py-6">
          <div className="hud-core">
            <div className="hud-ring hud-ring-1" />
            <div className="hud-ring hud-ring-2" />
            <div className="hud-ring hud-ring-3" />
            <div className="hud-core-center">
              <span className="font-display text-4xl font-black tracking-wider text-foreground text-glow">V.E.G.A.</span>
              <span className="font-display text-lg tracking-widest text-primary">INTEL CORE</span>
            </div>
          </div>
          <div className="hud-chip flex items-center gap-3 rounded-full px-5 py-2">
            <span className={`h-3 w-3 rounded-full bg-primary ${listening || thinking ? "animate-pulse glow" : "opacity-40"}`} />
            <span className="font-display text-xs tracking-widest text-primary">
              STATUS: {thinking ? "ELABORAZIONE" : listening ? "ACTIVE // ASCOLTO CONTINUO WAKEWORD" : "STANDBY"}
            </span>
          </div>
          <p className="hud-chip px-6 py-2 font-display text-xs tracking-[0.4em] text-primary/90">V.E.G.A. // SMARTER. ALWAYS.</p>
        </section>

        {/* RIGHT */}
        <div className="flex min-h-0 flex-col gap-4">
          <Telemetry />
          <Accounts />
        </div>
      </div>
    </div>
  );
}

function PanelTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-primary/20 px-4 py-3 text-primary">
      {icon}
      <h2 className="font-display text-sm tracking-[0.2em]">{children}</h2>
    </div>
  );
}

function Wave({ active }: { active: boolean }) {
  const bars = [3, 6, 10, 5, 14, 8, 18, 11, 6, 15, 9, 4, 12, 7, 3];
  return (
    <div className="flex h-10 flex-1 items-center justify-center gap-[3px]" aria-hidden>
      {bars.map((h, i) => (
        <span key={i} className={`w-[3px] rounded-full bg-primary ${active ? "hud-wave" : "opacity-40"}`} style={{ height: `${h * 2}px`, animationDelay: `${i * 70}ms` }} />
      ))}
    </div>
  );
}

function Telemetry() {
  const [lat, setLat] = useState<number[]>([]);
  const [battery, setBattery] = useState<{ level: number; charging: boolean } | null>(null);
  useEffect(() => {
    const load = () => supabase.from("vega_telemetry").select("latency_ms").order("created_at", { ascending: false }).limit(40)
      .then(({ data }) => setLat((data ?? []).map((r) => r.latency_ms as number).reverse()));
    load();
    const t = setInterval(load, 15000);
    const nav = navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener: (e: string, f: () => void) => void }> };
    nav.getBattery?.().then((b) => {
      const upd = () => setBattery({ level: b.level, charging: b.charging });
      upd(); b.addEventListener("levelchange", upd); b.addEventListener("chargingchange", upd);
    }).catch(() => {});
    return () => clearInterval(t);
  }, []);
  const max = Math.max(1, ...lat);
  const pts = lat.map((v, i) => `${(i / Math.max(1, lat.length - 1)) * 300},${70 - (v / max) * 64}`).join(" ");
  const pct = battery ? Math.round(battery.level * 100) : null;
  return (
    <section className="hud-panel">
      <PanelTitle icon={<BarChart3 className="h-5 w-5" />}>SYSTEM TELEMETRY</PanelTitle>
      <div className="space-y-4 p-4">
        <div>
          <p className="font-display text-xs tracking-wider text-primary">
            LATENZA API: {lat.length ? `${((lat.at(-1) ?? 0) / 1000).toFixed(1)}s` : "—"}
          </p>
          <svg viewBox="0 0 300 72" className="mt-2 h-20 w-full" preserveAspectRatio="none" aria-label="Grafico latenza">
            <line x1="0" y1="71" x2="300" y2="71" className="stroke-primary/30" />
            {lat.length > 1 && <polyline points={pts} fill="none" className="stroke-primary" strokeWidth="2" />}
          </svg>
        </div>
        <div>
          <p className="font-display text-xs tracking-wider text-primary">
            BATTERIA: {pct === null ? "NON DISPONIBILE" : `${pct}% · ${battery?.charging ? "IN CARICA" : "OPTIMAL"}`}
          </p>
          <div className="mt-3 flex items-center gap-4">
            <div className="hud-gauge" style={{ ["--p" as string]: `${pct ?? 0}%` }}>
              <span className="font-display text-sm">{pct ?? "—"}{pct !== null && "%"}</span>
            </div>
            <div className="flex flex-1 gap-[3px]">
              {Array.from({ length: 20 }).map((_, i) => (
                <span key={i} className={`h-7 flex-1 rounded-sm bg-primary ${pct !== null && i < pct / 5 ? "glow" : "opacity-15"}`} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Accounts() {
  const list = useServerFn(listGoogleAccounts);
  const [accounts, setAccounts] = useState<{ id: string; email: string; reconnect_required: boolean }[] | null>(null);
  useEffect(() => { list().then((a) => setAccounts(a as never)).catch(() => setAccounts([])); }, [list]);
  return (
    <section className="hud-panel min-h-0 flex-1 overflow-y-auto">
      <PanelTitle icon={<span className="font-display text-lg font-black">G</span>}>CONNECTED GOOGLE ACCOUNTS</PanelTitle>
      <ul className="space-y-2 p-4">
        {accounts === null && <li className="font-mono text-xs text-muted-foreground">Scansione account…</li>}
        {accounts?.length === 0 && (
          <li className="text-sm text-muted-foreground">Nessun account. <Link to="/produttivita" className="text-primary underline">Collega Google</Link></li>
        )}
        {accounts?.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{a.email}</span></span>
            <span className={`hud-badge ${a.reconnect_required ? "hud-badge-warn" : ""}`}>{a.reconnect_required ? "RECONNECT" : "LINKED"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
