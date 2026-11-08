import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CloudSun, Newspaper, RefreshCw } from "lucide-react";
import { fetchInfo } from "@/lib/info.functions";

export const Route = createFileRoute("/informazioni")({
  head: () => ({ meta: [
    { title: "Informazioni · V.E.G.A" },
    { name: "description", content: "Meteo reale dalla tua posizione e notizie ANSA in tempo reale." },
    { property: "og:title", content: "Informazioni · V.E.G.A" },
    { property: "og:description", content: "Meteo reale dalla tua posizione e notizie ANSA in tempo reale." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: InfoPage,
});

type Info = Awaited<ReturnType<typeof fetchInfo>>;

function InfoPage() {
  const get = useServerFn(fetchInfo);
  const [info, setInfo] = useState<Info | null>(null);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const pos = await new Promise<GeolocationPosition | null>((r) => {
      if (!navigator.geolocation) return r(null);
      navigator.geolocation.getCurrentPosition(r, () => r(null), { maximumAge: 600000, timeout: 8000 });
    });
    setGeoErr(pos ? null : "Posizione non disponibile: consenti la geolocalizzazione per il meteo.");
    setInfo(await get({ data: { lat: pos?.coords.latitude ?? null, lon: pos?.coords.longitude ?? null } }));
    setBusy(false);
  }
  useEffect(() => { void load(); }, []);

  const w = info?.weather;
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl tracking-widest text-primary text-glow">INFORMAZIONI</h1>
        <button onClick={load} disabled={busy} className="flex items-center gap-2 rounded border border-primary/40 px-3 py-1.5 font-mono text-xs text-primary hover:bg-primary/10 disabled:opacity-50">
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} /> AGGIORNA
        </button>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <section className="panel rounded-lg p-5">
          <h2 className="mb-4 flex items-center gap-2 font-mono text-xs tracking-widest text-muted-foreground"><CloudSun className="h-4 w-4 text-primary" /> METEO · OPEN-METEO</h2>
          {!info && <p className="font-mono text-sm text-muted-foreground">Rilevamento in corso…</p>}
          {(geoErr || info?.weatherError) && <p className="font-mono text-sm text-destructive">{geoErr || info?.weatherError}</p>}
          {w && (
            <>
              <div className="flex items-end gap-4">
                <span className="font-display text-6xl text-primary text-glow">{Math.round(w.current.temp)}°</span>
                <div className="pb-2 font-mono text-sm">
                  <div className="text-foreground">{w.current.label}</div>
                  <div className="text-muted-foreground">Percepita {Math.round(w.current.feels)}° · Umidità {w.current.humidity}% · Vento {Math.round(w.current.wind)} km/h</div>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-4 gap-2">
                {w.days.map((d) => (
                  <div key={d.date} className="rounded border border-border p-2 text-center font-mono text-xs">
                    <div className="text-muted-foreground">{new Date(d.date).toLocaleDateString("it-IT", { weekday: "short" })}</div>
                    <div className="my-1 text-primary">{Math.round(d.max)}° / {Math.round(d.min)}°</div>
                    <div className="truncate text-muted-foreground" title={d.label}>{d.label}</div>
                    <div className="text-muted-foreground">☂ {d.rain}%</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
        <section className="panel rounded-lg p-5">
          <h2 className="mb-4 flex items-center gap-2 font-mono text-xs tracking-widest text-muted-foreground"><Newspaper className="h-4 w-4 text-primary" /> NOTIZIE · ANSA</h2>
          {info?.newsError && <p className="font-mono text-sm text-destructive">{info.newsError}</p>}
          <ul className="space-y-3">
            {info?.news.map((n) => (
              <li key={n.link} className="border-l-2 border-primary/40 pl-3">
                <a href={n.link} target="_blank" rel="noreferrer" className="text-sm text-foreground hover:text-primary">{n.title}</a>
                {n.summary && <p className="mt-1 line-clamp-2 font-mono text-xs text-muted-foreground">{n.summary}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
