import { createServerFn } from "@tanstack/react-start";
import { generateSpeech } from "@lovable.dev/ai-gateway";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const synthesizeVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string }) => {
    const text = String(d?.text ?? "").slice(0, 1500).trim();
    if (!text) throw new Error("Testo vuoto");
    return { text };
  })
  .handler(async ({ data }) => {
    const audio = await generateSpeech({
      model: "google/gemini-3.1-flash-tts-preview",
      contents: [{ role: "user", parts: [{ text: `Leggi in italiano con voce maschile calma, elegante e distaccata da maggiordomo digitale: ${data.text}` }] }],
      generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Charon" } } } },
    });
    const buf = new Uint8Array(await (await audio.blob()).arrayBuffer());
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { audio: btoa(bin), type: audio.contentType || "audio/wav" };
  });
