import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { SignInGate } from "@/components/SignInGate";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/diario")({
  head: () => ({ meta: [
    { title: "Diario & Documenti · V.E.G.A" },
    { name: "description", content: "Note personali che V.E.G.A può leggere e modificare su tuo comando." },
    { property: "og:title", content: "Diario & Documenti · V.E.G.A" },
    { property: "og:description", content: "Note personali che V.E.G.A può leggere e modificare su tuo comando." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <SignInGate><DiaryPage /></SignInGate>,
});

type Note = { id: string; title: string; content: string; updated_at: string };

function DiaryPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", content: "" });
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase.from("vega_notes").select("id,title,content,updated_at").order("updated_at", { ascending: false });
    if (error) return setErr(error.message);
    setNotes(data ?? []);
  }
  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === "visible") void load(); }, 5000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (dirty) return;
    const n = notes.find((x) => x.id === sel);
    if (n) setDraft({ title: n.title, content: n.content });
  }, [notes, sel, dirty]);

  async function create() {
    const { data, error } = await supabase.from("vega_notes").insert({ title: "Nuova nota", content: "" }).select("id").single();
    if (error) return setErr(error.message);
    setDirty(false); setSel(data.id); await load();
  }
  async function save() {
    if (!sel) return;
    const { error } = await supabase.from("vega_notes").update({ ...draft, updated_at: new Date().toISOString() }).eq("id", sel);
    if (error) return setErr(error.message);
    setDirty(false); await load();
  }
  async function remove(id: string) {
    const { error } = await supabase.from("vega_notes").delete().eq("id", id);
    if (error) return setErr(error.message);
    if (id === sel) { setSel(null); setDraft({ title: "", content: "" }); }
    await load();
  }

  return (
    <div className="mx-auto grid h-screen max-w-6xl gap-4 p-6 md:grid-cols-[280px_1fr]">
      <aside className="panel flex flex-col overflow-hidden rounded-lg">
        <div className="flex items-center justify-between border-b border-border p-3">
          <h1 className="font-display text-sm tracking-widest text-primary text-glow">DIARIO</h1>
          <button onClick={create} aria-label="Nuova nota" className="rounded border border-primary/40 p-1.5 text-primary hover:bg-primary/10"><Plus className="h-4 w-4" /></button>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {notes.length === 0 && <li className="p-4 font-mono text-xs text-muted-foreground">Nessuna nota. Crea la prima o di' "Vega, annota…".</li>}
          {notes.map((n) => (
            <li key={n.id} className={`group flex items-center border-b border-border/50 ${n.id === sel ? "bg-primary/10" : ""}`}>
              <button onClick={() => { setDirty(false); setSel(n.id); }} className="flex-1 p-3 text-left">
                <div className="truncate text-sm text-foreground">{n.title || "(senza titolo)"}</div>
                <div className="font-mono text-[10px] text-muted-foreground">{new Date(n.updated_at).toLocaleString("it-IT")}</div>
              </button>
              <button onClick={() => remove(n.id)} aria-label="Elimina nota" className="p-3 text-muted-foreground opacity-0 hover:text-destructive group-hover:opacity-100"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </aside>
      <section className="panel flex flex-col rounded-lg p-4">
        {err && <p className="mb-2 font-mono text-xs text-destructive">{err}</p>}
        {sel ? (
          <>
            <div className="flex items-center gap-2">
              <input value={draft.title} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setDirty(true); }} className="flex-1 bg-transparent font-display text-lg tracking-wide text-primary outline-none" placeholder="Titolo" />
              <button onClick={save} disabled={!dirty} className="flex items-center gap-1.5 rounded border border-primary/40 px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary/10 disabled:opacity-40"><Save className="h-3.5 w-3.5" /> SALVA</button>
            </div>
            <textarea value={draft.content} onChange={(e) => { setDraft({ ...draft, content: e.target.value }); setDirty(true); }} className="mt-4 flex-1 resize-none bg-transparent font-mono text-sm leading-relaxed text-foreground outline-none" placeholder="Scrivi qui…" />
          </>
        ) : (
          <p className="m-auto font-mono text-sm text-muted-foreground">Seleziona una nota. V.E.G.A le legge e le modifica su tuo ordine.</p>
        )}
      </section>
    </div>
  );
}
