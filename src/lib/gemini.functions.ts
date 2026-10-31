import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const GEMINI_MODELS = ["gemini-flash-latest", "gemini-pro-latest"] as const;

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
  .inputValidator((d) =>
    base
      .extend({
        history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${data.model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": resolveKey(data.apiKey) },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: data.history.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
        }),
      },
    );
    if (!res.ok) return { ok: false as const, error: await googleError(res) };
    const body = await res.json();
    const text: string | undefined = body?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text ?? "")
      .join("");
    if (!text) return { ok: false as const, error: "Gemini non ha restituito alcuna risposta." };
    return { ok: true as const, text };
  });
