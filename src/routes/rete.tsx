import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Network } from "lucide-react";
import { GEMINI_MODELS, testGemini } from "@/lib/gemini.functions";
import { loadGemini, saveGemini, type GeminiModel } from "@/lib/gemini-settings";

export const Route = createFileRoute("/rete")({
  head: () => ({ meta: [
    { title: "Rete & Connessione · V.E.G.A" },
    { name: "description", content: "Collega il cervello di V.E.G.A a Google Gemini." },
    { property: "og:title", content: "Rete & Connessione · V.E.G.A" },
    { property: "og:description", content: "Collega il cervello di V.E.G.A a Google Gemini." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: RetePage,
});

function RetePage() {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState<GeminiModel>("gemini-3.8-flash");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const test = useServerFn(testGemini);

  useEffect(() => { const s = loadGemini(); setApiKey(s.apiKey); setModel(s.model); }, []);
  useEffect(() => { saveGemini({ apiKey, model }); }, [apiKey, model]);

  async function runTest() {
    setTesting(true); setStatus(null);
    try { setStatus(await test({ data: { apiKey: apiKey || undefined, model } })); }
    catch (e) { setStatus({ ok: false, message: e instanceof Error ? e.message : "Errore" }); }
    finally { setTesting(false); }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-8 flex items-center gap-3">
        <Network className="h-6 w-6 text-primary" />
        <div>
          <h1 className="font-display text-sm tracking-[0.3em] text-primary">RETE & CONNESSIONE</h1>
          <p className="font-mono text-[10px] uppercase text-muted-foreground">MOD-02 · Google Gemini</p>
        </div>
      </div>
      <div className="panel space-y-6 rounded-lg p-6">
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Chiave API Google Gemini</span>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="•••• chiave salvata in modo sicuro sul server"
            className="mt-2 w-full rounded border bg-transparent px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          />
          <span className="mt-1 block font-mono text-[10px] text-muted-foreground">Lascia vuoto per usare la chiave salvata.</span>
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Modello</span>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value as GeminiModel)}
            className="mt-2 w-full rounded border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary"
          >
            {GEMINI_MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <button
          onClick={runTest}
          disabled={testing}
          className="rounded-md bg-primary px-4 py-2 font-mono text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50"
        >
          {testing ? "Test in corso…" : "Test Connessione"}
        </button>
        {status && (
          <p className={`font-mono text-xs ${status.ok ? "text-primary" : "text-destructive"}`}>
            {status.ok ? "✓" : "⚠"} {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
