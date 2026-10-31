import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CalendarClock, Mail, RefreshCw, Link2 } from "lucide-react";
import { fetchRecentEmails, fetchTodayEvents, getGoogleStatus } from "@/lib/google.functions";

export const Route = createFileRoute("/produttivita")({
  head: () => ({ meta: [
    { title: "Produttività · V.E.G.A" },
    { name: "description", content: "Agenda di oggi ed email recenti, lette da V.E.G.A." },
    { property: "og:title", content: "Produttività · V.E.G.A" },
    { property: "og:description", content: "Agenda di oggi ed email recenti, lette da V.E.G.A." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: ProduttivitaPage,
});

type Ev = Awaited<ReturnType<typeof fetchTodayEvents>>["events"][number];
type Em = Awaited<ReturnType<typeof fetchRecentEmails>>["emails"][number];

const time = (iso: string) => new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
const sender = (f: string) => f.replace(/<.*>/, "").replace(/"/g, "").trim() || f;

function ProduttivitaPage() {
  const status = useServerFn(getGoogleStatus);
  const evFn = useServerFn(fetchTodayEvents);
  const emFn = useServerFn(fetchRecentEmails);
  const [tab, setTab] = useState<"agenda" | "email">("agenda");
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  const [events, setEvents] = useState<Ev[] | null>(null);
  const [emails, setEmails] = useState<Em[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setErr(null);
    const s = await status();
    setEmail(s.email);
    if (s.connected) {
      const [e, m] = await Promise.all([evFn(), emFn()]);
      setEvents(e.events); setEmails(m.emails);
      if (!e.ok || !m.ok) setErr((!e.ok && e.error) || (!m.ok && m.error) || null);
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-display text-sm tracking-[0.3em] text-primary">PRODUTTIVITÀ</h1>
            <p className="font-mono text-[10px] uppercase text-muted-foreground">MOD-03 · Calendario & Email</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} aria-label="Aggiorna" className="rounded border p-2 text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-40">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="panel mb-6 flex items-center justify-between rounded-lg p-4">
        {email === undefined ? (
          <span className="font-mono text-xs text-muted-foreground">Verifica connessione…</span>
        ) : email ? (
          <span className="font-mono text-xs text-primary">● Account Connesso: {email}</span>
        ) : (
          <>
            <span className="font-mono text-xs text-destructive">○ Nessun account collegato</span>
            <span className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-mono text-xs uppercase tracking-widest text-primary-foreground">
              <Link2 className="h-4 w-4" /> Connetti Account Google
            </span>
          </>
        )}
      </div>

      <div className="mb-4 flex gap-2">
        {(["agenda", "email"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-xs uppercase tracking-wider ${tab === t ? "border-primary text-primary glow" : "text-muted-foreground"}`}>
            {t === "agenda" ? <CalendarClock className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            {t === "agenda" ? "Agenda di oggi" : "Email recenti"}
          </button>
        ))}
      </div>

      {err && <p className="mb-4 font-mono text-xs text-destructive">⚠ {err}</p>}

      {tab === "agenda" ? (
        <div className="space-y-2">
          {events === null ? <p className="font-mono text-xs text-muted-foreground">Caricamento…</p>
            : events.length === 0 ? <p className="font-mono text-xs text-muted-foreground">Nessun impegno oggi. L'apatia ringrazia.</p>
            : events.map((e) => (
              <div key={e.id} className="panel flex gap-4 rounded-lg p-4">
                <span className="w-24 shrink-0 font-mono text-xs text-primary">
                  {e.allDay ? "TUTTO IL GIORNO" : `${time(e.start)}–${time(e.end)}`}
                </span>
                <div className="min-w-0">
                  <p className="truncate">{e.title}</p>
                  {e.location && <p className="truncate font-mono text-[11px] text-muted-foreground">{e.location}</p>}
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="space-y-2">
          {emails === null ? <p className="font-mono text-xs text-muted-foreground">Caricamento…</p>
            : emails.length === 0 ? <p className="font-mono text-xs text-muted-foreground">Casella vuota.</p>
            : emails.map((m) => (
              <div key={m.id} className="panel rounded-lg p-4">
                <div className="flex justify-between gap-4">
                  <span className="truncate font-mono text-xs text-primary">{sender(m.from)}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {m.date && new Date(m.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                <p className="mt-1 truncate">{m.subject}</p>
                <p className="mt-1 line-clamp-2 font-mono text-[11px] text-muted-foreground">{m.snippet}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
