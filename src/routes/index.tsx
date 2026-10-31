import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "JARVIS · Chat Principale" },
    { name: "description", content: "Pannello di controllo centrale per dialogare con il tuo assistente JARVIS." },
    { property: "og:title", content: "JARVIS · Chat Principale" },
    { property: "og:description", content: "Pannello di controllo centrale per dialogare con il tuo assistente JARVIS." },
  ] }),
  component: ChatPage,
});

type Msg = { id: string; role: "user" | "assistant"; content: string; created_at: string };

function simulateReply(text: string) {
  return `Ricevuto, signore. Ho registrato: "${text.slice(0, 120)}". I miei moduli cognitivi saranno attivati nello Step successivo; per ora confermo che la memoria funziona correttamente.`;
}

function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    supabase.from("messages").select("*").order("created_at").then(({ data, error }) => {
      if (error) setError(error.message);
      else setMessages((data ?? []) as Msg[]);
      setLoading(false);
      inputRef.current?.focus();
    });
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, thinking]);

  async function save(role: Msg["role"], content: string) {
    const { data, error } = await supabase.from("messages").insert({ role, content }).select().single();
    if (error) throw error;
    setMessages((m) => [...m, data as Msg]);
  }

  async function send() {
    const text = input.trim();
    if (!text || thinking) return;
    setInput("");
    setError(null);
    setThinking(true);
    try {
      await save("user", text);
      await new Promise((r) => setTimeout(r, 700));
      await save("assistant", simulateReply(text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore di salvataggio");
    } finally {
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
              <p className="font-display text-xl tracking-widest text-primary text-glow">BUONGIORNO, SIGNORE.</p>
              <p className="mt-3 font-mono text-sm text-muted-foreground">Sistemi pronti. Come posso esserle utile?</p>
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
                  <span className="font-mono text-[10px] uppercase tracking-widest text-primary">Jarvis</span>
                  <p className="mt-1 text-lg leading-relaxed">{m.content}</p>
                </div>
              )}
            </div>
          ))}
          {thinking && (
            <div className="font-mono text-xs text-primary">
              <span className="animate-pulse">▍ Jarvis sta elaborando…</span>
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
            placeholder="Scrivi un comando per Jarvis…"
            className="max-h-40 flex-1 resize-none bg-transparent px-2 py-2 font-mono text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim() || thinking}
            aria-label="Invia"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
