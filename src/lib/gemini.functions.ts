import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-flash-latest", "gemini-pro-latest"] as const;

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
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const key = resolveKey(data.apiKey);
    const today = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", dateStyle: "full", timeStyle: "short" }).format(new Date());
    const contents: any[] = data.history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
    const tools = [{
      functionDeclarations: [
        { name: "get_calendar_events", description: "Scansiona tutti i calendari di tutti gli account Google collegati e restituisce gli impegni di oggi in un'unica cronologia ordinata, con l'account di provenienza." },
        { name: "get_recent_emails", description: "Controlla tutte le caselle Gmail collegate e restituisce solo le email recenti importanti o urgenti, indicando l'account di provenienza." },
      ],
    }];

    for (let step = 0; step < 5; step++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${data.model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: `${SYSTEM}\nData e ora attuali: ${today} (Europe/Rome). Usa gli strumenti quando l'utente chiede di agenda, impegni o email. Tono da maggiordomo digitale: frasi brevi, adatte a essere lette ad alta voce, niente markdown.` }] },
            contents,
            tools,
          }),
        },
      );
      if (!res.ok) return { ok: false as const, error: await googleError(res) };
      const body = await res.json();
      const content = body?.candidates?.[0]?.content;
      const parts: any[] = content?.parts ?? [];
      const calls = parts.filter((p) => p.functionCall);
      if (calls.length === 0) {
        const text = parts.map((p) => (p.thought ? "" : p.text ?? "")).join("").trim();
        if (!text) return { ok: false as const, error: "Gemini non ha restituito alcuna risposta." };
        return { ok: true as const, text };
      }
      contents.push(content);
      const { getTodayEvents, getRecentEmails } = await import("./google.server");
      const responses = await Promise.all(calls.map(async (p) => {
        const name = p.functionCall.name;
        let response: unknown;
        try {
          if (name === "get_calendar_events") response = await getTodayEvents(context.userId);
          else if (name === "get_recent_emails") response = await getRecentEmails(context.userId, true);
          else response = { error: "Funzione sconosciuta" };
        } catch (e) {
          response = { error: e instanceof Error ? e.message : "Errore" };
        }
        return { functionResponse: { name, response } };
      }));
      contents.push({ role: "user", parts: responses });
    }
    return { ok: false as const, error: "Troppe chiamate agli strumenti." };
  });
