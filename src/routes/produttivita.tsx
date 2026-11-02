import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Mail, Plus, RefreshCw, Trash2, UserRound } from "lucide-react";
import { fetchRecentEmails, fetchTodayEvents } from "@/lib/google.functions";
import { completeGoogleOAuth, listGoogleAccounts, removeGoogleAccount, startGoogleOAuth } from "@/lib/google-oauth.functions";
import { SignInGate } from "@/components/SignInGate";
import type { CalEvent, Email } from "@/lib/google-data";

export const Route = createFileRoute("/produttivita")({
  head: () => ({ meta: [
    { title: "Produttività · V.E.G.A" },
    { name: "description", content: "Account Google collegati, agenda unificata di oggi ed email importanti, gestiti da V.E.G.A." },
    { property: "og:title", content: "Produttività · V.E.G.A" },
    { property: "og:description", content: "Account Google collegati, agenda unificata di oggi ed email importanti, gestiti da V.E.G.A." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <SignInGate><ProduttivitaPage /></SignInGate>,
});

type Acc = { id: string; email: string; reconnect_required: boolean };
const time = (iso: string) => new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" });
const sender = (f: string) => f.replace(/<.*>/, "").replace(/"/g, "").trim() || f;

function ProduttivitaPage() {
  const listFn = useServerFn(listGoogleAccounts);
  const startFn = useServerFn(startGoogleOAuth);
  const completeFn = useServerFn(completeGoogleOAuth);
  const removeFn = useServerFn(removeGoogleAccount);
  const evFn = useServerFn(fetchTodayEvents);
  const emFn = useServerFn(fetchRecentEmails);
  const [tab, setTab] = useState<"agenda" | "email">("agenda");
  const [accounts, setAccounts] = useState<Acc[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [emails, setEmails] = useState<Email[] | null>(null);
  const [onlyImportant, setOnlyImportant] = useState(true);
  const [errs, setErrs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErrs([]);
    try {
      const a = await listFn();
      setAccounts(a.accounts); setConfigured(a.configured);
      if (a.accounts.length) {
        const [e, m] = await Promise.all([evFn(), emFn()]);
        setEvents(e.events); setEmails(m.emails); setErrs([...e.errors, ...m.errors]);
      } else { setEvents([]); setEmails([]); }
    } catch (e) { setErrs([e instanceof Error ? e.message : "Errore"]); }
    setLoading(false);
  }, [listFn, evFn, emFn]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    async function onMsg(ev: MessageEvent) {
      if (ev.origin !== window.location.origin || ev.data?.type !== "vega-google-oauth") return;
      setLinking(false);
      if (ev.data.error || !ev.data.code || !ev.data.state) { setErrs([`Collegamento annullato${ev.data.error ? `: ${ev.data.error}` : ""}.`]); return; }
      try { await completeFn({ data: { code: ev.data.code, state: ev.data.state } }); await load(); }
      catch (e) { setErrs([e instanceof Error ? e.message : "Errore"]); }
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [completeFn, load]);

  async function link() {
    setErrs([]);
    const popup = window.open("about:blank", "vega-google", "width=520,height=680");
    setLinking(true);
    try {
      const { authorizationUrl } = await startFn();
      if (popup) popup.location.href = authorizationUrl; else window.location.href = authorizationUrl;
    } catch (e) { popup?.close(); setLinking(false); setErrs([e instanceof Error ? e.message : "Errore"]); }
  }

  async function remove(a: Acc) {
    if (!confirm(`Scollegare ${a.email}?`)) return;
    try { await removeFn({ data: { id: a.id } }); await load(); }
    catch (e) { setErrs([e instanceof Error ? e.message : "Errore"]); }
  }

  const shownEmails = (emails ?? []).filter((m) => !onlyImportant || m.important);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CalendarClock className="h-6 w-6 text-primary" />
          <div>
            <h1 className="font-display text-sm tracking-[0.3em] text-primary">PRODUTTIVITÀ</h1>
            <p className="font-mono text-[10px] uppercase text-muted-foreground">MOD-03 · Multi-account Calendario & Email</p>
          </div>
        </div>
        <button onClick={load} disabled={loading} aria-label="Aggiorna" className="rounded border p-2 text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-40">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <section className="panel mb-6 rounded-lg p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-mono text-xs uppercase tracking-widest text-primary">Account Connessi</h2>
          <button onClick={link} disabled={linking || !configured} className="flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-primary-foreground disabled:opacity-40">
            <Plus className="h-3.5 w-3.5" /> {linking ? "In attesa di Google…" : "Collega nuovo account Google"}
          </button>
        </div>
        {!configured && <p className="mb-2 font-mono text-xs text-destructive">Credenziali OAuth Google non configurate.</p>}
        {accounts === null ? <p className="font-mono text-xs text-muted-foreground">Verifica connessioni…</p>
          : accounts.length === 0 ? <p className="font-mono text-xs text-muted-foreground">Nessun account collegato. Le sue caselle attendono, signore.</p>
          : (
            <ul className="space-y-1.5">
              {accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-3 rounded border px-3 py-2">
                  <UserRound className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-mono text-xs">{a.email}</span>
                  {a.reconnect_required
                    ? <span className="flex items-center gap-1 font-mono text-[10px] uppercase text-destructive"><AlertTriangle className="h-3 w-3" /> Da ricollegare</span>
                    : <span className="font-mono text-[10px] uppercase text-primary">● Attivo</span>}
                  <button onClick={() => remove(a)} aria-label={`Rimuovi ${a.email}`} className="rounded p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
      </section>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["agenda", "email"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 rounded border px-3 py-1.5 font-mono text-xs uppercase tracking-wider ${tab === t ? "border-primary text-primary glow" : "text-muted-foreground"}`}>
            {t === "agenda" ? <CalendarClock className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
            {t === "agenda" ? "Agenda di oggi" : "Email recenti"}
          </button>
        ))}
        {tab === "email" && (
          <label className="ml-auto flex items-center gap-2 font-mono text-[11px] uppercase text-muted-foreground">
            <input type="checkbox" checked={onlyImportant} onChange={(e) => setOnlyImportant(e.target.checked)} className="accent-primary" />
            Solo importanti
          </label>
        )}
      </div>

      {errs.map((e) => <p key={e} className="mb-2 font-mono text-xs text-destructive">⚠ {e}</p>)}

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
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {e.account}{e.calendar && e.calendar !== e.account ? ` · ${e.calendar}` : ""}{e.location ? ` · ${e.location}` : ""}
                  </p>
                </div>
              </div>
            ))}
        </div>
      ) : (
        <div className="space-y-2">
          {emails === null ? <p className="font-mono text-xs text-muted-foreground">Caricamento…</p>
            : shownEmails.length === 0 ? <p className="font-mono text-xs text-muted-foreground">{onlyImportant ? "Nulla di urgente. Può continuare a non fare nulla." : "Casella vuota."}</p>
            : shownEmails.map((m) => (
              <div key={m.id} className={`panel rounded-lg p-4 ${m.urgent ? "border-destructive/60" : ""}`}>
                <div className="flex justify-between gap-4">
                  <span className="truncate font-mono text-xs text-primary">
                    {m.urgent && <span className="mr-2 text-destructive">URGENTE</span>}{sender(m.from)}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {m.date && new Date(m.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                  </span>
                </div>
                <p className="mt-1 truncate">{m.subject}</p>
                <p className="mt-1 line-clamp-2 font-mono text-[11px] text-muted-foreground">{m.snippet}</p>
                <p className="mt-1 font-mono text-[10px] uppercase text-muted-foreground">→ {m.account}</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
