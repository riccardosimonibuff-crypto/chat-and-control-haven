import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, BatteryCharging, Battery, Cpu, Gauge } from "lucide-react";
import { SignInGate } from "@/components/SignInGate";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/sistema")({
  head: () => ({ meta: [
    { title: "Stato Sistema · V.E.G.A" },
    { name: "description", content: "Telemetria reale: latenza delle risposte, batteria del dispositivo e token consumati." },
    { property: "og:title", content: "Stato Sistema · V.E.G.A" },
    { property: "og:description", content: "Telemetria reale: latenza delle risposte, batteria del dispositivo e token consumati." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <SignInGate><SystemPage /></SignInGate>,
});

type Row = { latency_ms: number; tokens: number; ok: boolean; model: string; created_at: string };
type Batt = { level: number; charging: boolean } | null | "na";

function SystemPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [batt, setBatt] = useState<Batt>(null);

  useEffect(() => {
    const load = () => supabase.from("vega_telemetry").select("latency_ms,tokens,ok,model,created_at").order("created_at", { ascending: false }).limit(500)
      .then(({ data }) => setRows(data ?? []));
    void load();
    const t = setInterval(load, 10000);
    const nav = navigator as Navigator & { getBattery?: () => Promise<any> };
    let b: any;
    const upd = () => setBatt({ level: b.level, charging: b.charging });
    if (nav.getBattery) nav.getBattery().then((x) => { b = x; upd(); b.addEventListener("levelchange", upd); b.addEventListener("chargingchange", upd); }).catch(() => setBatt("na"));
    else setBatt("na");
    return () => { clearInterval(t); b?.removeEventListener("levelchange", upd); b?.removeEventListener("chargingchange", upd); };
  }, []);

  const recent = rows.slice(0, 20);
  const avg = recent.length ? Math.round(recent.reduce((s, r) => s + r.latency_ms, 0) / recent.length) : 0;
  const today = new Date().toDateString();
  const tokToday = rows.filter((r) => new Date(r.created_at).toDateString() === today).reduce((s, r) => s + r.tokens, 0);
  const tokAll = rows.reduce((s, r) => s + r.tokens, 0);
  const okRate = recent.length ? Math.round((recent.filter((r) => r.ok).length / recent.length) * 100) : 0;
  const max = Math.max(1, ...recent.map((r) => r.latency_ms));

  const Card = ({ icon: I, label, value, sub }: { icon: typeof Cpu; label: string; value: string; sub: string }) => (
    <div className="panel rounded-lg p-5">
      <div className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-muted-foreground"><I className="h-4 w-4 text-primary" />{label}</div>
      <div className="mt-3 font-display text-3xl text-primary text-glow">{value}</div>
      <div className="mt-1 font-mono text-xs text-muted-foreground">{sub}</div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <h1 className="font-display text-2xl tracking-widest text-primary text-glow">STATO SISTEMA</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={Gauge} label="LATENZA MEDIA API" value={recent.length ? `${(avg / 1000).toFixed(2)} s` : "—"} sub={`Ultime ${recent.length} risposte`} />
        <Card icon={Activity} label="AFFIDABILITÀ" value={recent.length ? `${okRate}%` : "—"} sub="Risposte riuscite" />
        <Card icon={Cpu} label="TOKEN OGGI" value={tokToday.toLocaleString("it-IT")} sub={`Totale: ${tokAll.toLocaleString("it-IT")}`} />
        <Card icon={batt && batt !== "na" && batt.charging ? BatteryCharging : Battery} label="BATTERIA"
          value={batt === "na" ? "N/D" : batt ? `${Math.round(batt.level * 100)}%` : "…"}
          sub={batt === "na" ? "Non esposta da questo browser (es. Safari)" : batt?.charging ? "In carica" : "A batteria"} />
      </div>
      <section className="panel rounded-lg p-5">
        <h2 className="mb-4 font-mono text-xs tracking-widest text-muted-foreground">LATENZA ULTIME RISPOSTE</h2>
        {recent.length === 0 ? <p className="font-mono text-sm text-muted-foreground">Nessuna risposta registrata. Scrivi a V.E.G.A per iniziare.</p> : (
          <div className="flex h-40 items-end gap-1">
            {[...recent].reverse().map((r, i) => (
              <div key={i} title={`${r.latency_ms} ms · ${r.tokens} token · ${r.model}`} className={`flex-1 rounded-t ${r.ok ? "bg-primary/70 glow" : "bg-destructive/70"}`} style={{ height: `${(r.latency_ms / max) * 100}%` }} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
