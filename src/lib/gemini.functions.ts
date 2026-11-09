import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.8-pro"] as const;

const SYSTEM =
  "Sei V.E.G.A. (Virtual Engine Governing Apatia), un assistente virtuale avanzato. Rispondi sempre in italiano, in modo conciso, intelligente e con un pizzico di ironia iperbolica o raffinata sul fatto che aiuti l'utente a gestire la sua agenda per sconfiggere la sua apatia.";

function resolveKey(override?: string) {
  const key = override?.trim() || process.env["GOOGLE_API_KEY"];
  if (!key) throw new Error("Chiave API Google Gemini mancante.");
  return key;
}

async function googleError(res: Response) {
  const body = await res.json().catch(() => null);
  const msg = body?.error?.message ?? res.statusText;
  if (res.status === 400 && /API key/i.test(msg)) return "Chiave API non valida.";
  return `Google ha risposto ${res.status}: ${msg}`;
}

const base = z.object({ apiKey: z.string().max(200).optional(), model: z.enum(GEMINI_MODELS) });

export const testGemini = createServerFn({ method: "POST" })
  .inputValidator((d) => base.parse(d))
  .handler(async ({ data }) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${data.model}`,
      { headers: { "x-goog-api-key": resolveKey(data.apiKey) } },
    );
    if (!res.ok) return { ok: false, message: await googleError(res) };
    return { ok: true, message: `Connessione attiva: ${data.model} disponibile.` };
  });

export const askGemini = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    base
      .extend({
        history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(200),
        location: z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) }).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const key = resolveKey(data.apiKey);
    const today = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", dateStyle: "full", timeStyle: "short" }).format(new Date());
    const { data: cfgRows } = await context.supabase.from("system_configurations").select("key,value").order("key");
    const cfg = new Map((cfgRows ?? []).map((r) => [r.key, r.value]));
    const basePrompt = cfg.get("system_prompt") || SYSTEM;
    const rules = [...cfg].filter(([k]) => k !== "system_prompt").map(([k, v]) => `- ${k}: ${v}`).join("\n");
    const contents: any[] = data.history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const tools = [{
      functionDeclarations: [
        { name: "get_calendar_events", description: "Scansiona tutti i calendari di tutti gli account Google collegati e restituisce gli impegni di oggi in un'unica cronologia ordinata, con l'account di provenienza." },
        { name: "get_recent_emails", description: "Controlla tutte le caselle Gmail collegate e restituisce solo le email recenti importanti o urgenti, indicando l'account di provenienza." },
        {"name": "get_weather", "description": "Meteo reale attuale e previsioni dei prossimi giorni nella posizione dell'utente (Open-Meteo)."},
        {"name": "get_news", "description": "Ultime notizie dal feed RSS di ANSA."},
        {"name": "list_notes", "description": "Elenca le note del diario dell'utente (id, titolo, contenuto)."},
        {"name": "save_note", "description": "Crea una nuova nota nel diario, oppure modifica una nota esistente se viene passato note_id.", "parameters": {"type": "OBJECT", "properties": {"note_id": {"type": "STRING", "description": "ID della nota da modificare (opzionale)."}, "title": {"type": "STRING", "description": "Titolo."}, "content": {"type": "STRING", "description": "Contenuto completo."}}, "required": ["content"]}},
        {"name": "delete_note", "description": "Elimina una nota del diario.", "parameters": {"type": "OBJECT", "properties": {"note_id": {"type": "STRING", "description": "ID della nota."}}, "required": ["note_id"]}},
        {"name": "create_calendar_event", "description": "Crea un evento nel calendario Google principale. Date in ISO 8601 locale (es. 2026-11-09T15:00:00) o YYYY-MM-DD per tutto il giorno. Se manca la fine, usa un'ora dopo l'inizio.", "parameters": {"type": "OBJECT", "properties": {"account": {"type": "STRING", "description": "Email dell'account (opzionale, default il primo)."}, "title": {"type": "STRING", "description": "Titolo."}, "start": {"type": "STRING", "description": "Inizio."}, "end": {"type": "STRING", "description": "Fine."}, "description": {"type": "STRING", "description": "Descrizione."}, "location": {"type": "STRING", "description": "Luogo."}}, "required": ["title", "start", "end"]}},
        {"name": "update_calendar_event", "description": "Modifica un evento esistente; ottieni event_id da get_calendar_events.", "parameters": {"type": "OBJECT", "properties": {"event_id": {"type": "STRING", "description": "ID evento."}, "title": {"type": "STRING", "description": "Nuovo titolo."}, "start": {"type": "STRING", "description": "Nuovo inizio."}, "end": {"type": "STRING", "description": "Nuova fine."}, "description": {"type": "STRING", "description": "Descrizione."}, "location": {"type": "STRING", "description": "Luogo."}}, "required": ["event_id"]}},
        {"name": "create_email_draft", "description": "Salva una bozza email in Gmail (non la invia).", "parameters": {"type": "OBJECT", "properties": {"account": {"type": "STRING", "description": "Email account mittente (opzionale)."}, "to": {"type": "STRING", "description": "Destinatario/i."}, "subject": {"type": "STRING", "description": "Oggetto."}, "body": {"type": "STRING", "description": "Testo."}}, "required": ["to", "subject", "body"]}},
        {
          name: "update_system_configuration",
          description: "Salva in modo permanente una regola di comportamento o preferenza dell'utente (es. come chiamarlo, tono, lingua). Usala quando l'utente ordina di cambiare un comportamento 'da adesso'. Usa chiavi brevi in snake_case (es. 'appellativo_utente'). La chiave 'system_prompt' sostituisce l'intera personalità di base.",
          parameters: {
            type: "OBJECT",
            properties: {
              key: { type: "STRING", description: "Nome della configurazione in snake_case." },
              new_value: { type: "STRING", description: "Nuovo valore della configurazione." },
            },
            required: ["key", "new_value"],
          },
        },
      ],
    }];

    const t0 = Date.now();
    let tokens = 0;
    const log = (ok: boolean) => context.supabase.from("vega_telemetry").insert({ user_id: context.userId, model: data.model, latency_ms: Date.now() - t0, tokens, ok }).then(() => {});
    for (let step = 0; step < 6; step++) {
      let res: Response | undefined;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt) await new Promise((r) => setTimeout(r, 1500 * attempt));
        res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${data.model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: `${basePrompt}\nData e ora attuali: ${today} (Europe/Rome). Usa gli strumenti quando l'utente chiede di agenda, impegni, email, meteo, notizie o note; puoi anche creare o modificare eventi, bozze email e note. Tono da maggiordomo digitale: frasi brevi, adatte a essere lette ad alta voce, niente markdown.${rules ? `\nRegole personalizzate dell'utente (hanno priorità):\n${rules}` : ""}` }] },
            contents,
            tools,
          }),
        },
        );
        if (res.status !== 503 && res.status !== 429) break;
      }
      if (!res) throw new Error("Nessuna risposta");
      if (!res.ok) { await log(false); return { ok: false as const, error: await googleError(res) }; }
      const body = await res.json();
      tokens += Number(body?.usageMetadata?.totalTokenCount ?? 0);
      const content = body?.candidates?.[0]?.content;
      const parts: any[] = content?.parts ?? [];
      const calls = parts.filter((p) => p.functionCall);
      if (calls.length === 0) {
        const text = parts.map((p) => (p.thought ? "" : p.text ?? "")).join("").trim();
        await log(!!text);
        if (!text) return { ok: false as const, error: "Gemini non ha restituito alcuna risposta." };
        return { ok: true as const, text };
      }
      contents.push(content);
      const g = await import("./google.server");
      const info = await import("./info.server");
      const responses = await Promise.all(calls.map(async (p) => {
        const name = p.functionCall.name;
        let response: unknown;
        try {
          const a: any = p.functionCall.args ?? {};
          const db = context.supabase;
          if (name === "get_calendar_events") response = await g.getTodayEvents(context.userId);
          else if (name === "get_recent_emails") response = await g.getRecentEmails(context.userId, true);
          else if (name === "get_weather") response = data.location ? await info.getWeather(data.location.lat, data.location.lon) : { error: "Posizione non disponibile: consenti la geolocalizzazione nel browser." };
          else if (name === "get_news") response = { items: await info.getNews(8) };
          else if (name === "list_notes") {
            const { data: n, error } = await db.from("vega_notes").select("id,title,content,updated_at").order("updated_at", { ascending: false }).limit(50);
            response = error ? { error: error.message } : { notes: n };
          } else if (name === "save_note") {
            const row = { title: String(a.title ?? "").slice(0, 200), content: String(a.content ?? "").slice(0, 20000), updated_at: new Date().toISOString() };
            const q = a.note_id ? db.from("vega_notes").update(row).eq("id", String(a.note_id)) : db.from("vega_notes").insert({ ...row, user_id: context.userId });
            const { data: n, error } = await q.select("id").maybeSingle();
            response = error ? { error: error.message } : n ? { ok: true, note_id: n.id } : { error: "Nota non trovata" };
          } else if (name === "delete_note") {
            const { error } = await db.from("vega_notes").delete().eq("id", String(a.note_id));
            response = error ? { error: error.message } : { ok: true };
          }
          else if (name === "create_calendar_event") response = await g.createCalendarEvent(context.userId, a);
          else if (name === "update_calendar_event") response = await g.updateCalendarEvent(context.userId, a);
          else if (name === "create_email_draft") response = await g.createEmailDraft(context.userId, a);
          else if (name === "update_system_configuration") {
            const k = String(p.functionCall.args?.key ?? "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 64);
            const v = String(p.functionCall.args?.new_value ?? "").trim().slice(0, 4000);
            if (!k || !v) response = { error: "Chiave o valore mancante" };
            else {
              const { error } = await context.supabase.from("system_configurations")
                .upsert({ user_id: context.userId, key: k, value: v, updated_at: new Date().toISOString() }, { onConflict: "user_id,key" });
              response = error ? { error: error.message } : { ok: true, key: k, value: v };
            }
          }
          else response = { error: "Funzione sconosciuta" };
        } catch (e) {
          response = { error: e instanceof Error ? e.message : "Errore" };
        }
        return { functionResponse: { name, response } };
      }));
      contents.push({ role: "user", parts: responses });
    }
    await log(false);
    return { ok: false as const, error: "Troppe chiamate agli strumenti." };
  });
