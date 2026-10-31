import { GEMINI_MODELS } from "./gemini.functions";

export type GeminiModel = (typeof GEMINI_MODELS)[number];
const KEY = "vega.gemini";

export function loadGemini(): { apiKey: string; model: GeminiModel } {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return {
      apiKey: typeof s.apiKey === "string" ? s.apiKey : "",
      model: GEMINI_MODELS.includes(s.model) ? s.model : "gemini-flash-latest",
    };
  } catch {
    return { apiKey: "", model: "gemini-flash-latest" };
  }
}

export function saveGemini(v: { apiKey: string; model: GeminiModel }) {
  localStorage.setItem(KEY, JSON.stringify(v));
}
