import { useCallback, useEffect, useRef, useState } from "react";
import { extractWakeCommand, localRecognitionReady } from "@/lib/voice-command";

export type ListenState = "off" | "preparing" | "listening" | "paused" | "unsupported" | "error";

// Recognition runs only when Italian on-device processing is available; no cloud fallback.
export function useWakeListener(onCommand: (cmd: string) => void, paused: boolean) {
  const [state, setState] = useState<ListenState>("off");
  const [message, setMessage] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const wantRef = useRef(false);
  const pausedRef = useRef(paused);
  const cmdRef = useRef(onCommand);
  cmdRef.current = onCommand;

  const startRec = useCallback(() => {
    const rec = recRef.current;
    if (!rec || !wantRef.current || pausedRef.current) return;
    try { rec.start(); } catch { /* already running */ }
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
    const rec = recRef.current;
    if (!rec || !wantRef.current) return;
    if (paused) { setState("paused"); try { rec.abort(); } catch { /* noop */ } }
    else { setState("listening"); startRec(); }
  }, [paused, startRec]);

  useEffect(() => () => { wantRef.current = false; try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  const stop = useCallback(() => {
    wantRef.current = false;
    try { recRef.current?.abort(); } catch { /* noop */ }
    setState("off");
  }, []);

  const start = useCallback(async () => {
    setMessage(null);
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR || typeof SR.available !== "function") {
      setState("unsupported");
      setMessage("Questo browser non offre il riconoscimento vocale locale. Usi Chrome aggiornato su desktop.");
      return;
    }
    setState("preparing");
    const opts = { langs: ["it-IT"], processLocally: true };
    let status: string = await SR.available(opts).catch(() => "unavailable");
    if (status === "downloadable" || status === "downloading") {
      setMessage("Scarico il modello vocale italiano sul dispositivo…");
      const ok = await SR.install?.(opts).catch(() => false);
      status = ok ? await SR.available(opts).catch(() => "unavailable") : "unavailable";
    }
    if (!localRecognitionReady(status)) {
      setState("unsupported");
      setMessage("Riconoscimento italiano on-device non disponibile: per riservatezza resto in silenzio.");
      return;
    }
    const rec = new SR();
    rec.lang = "it-IT";
    rec.processLocally = true;
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (ev: any) => {
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (!ev.results[i].isFinal) continue;
        const cmd = extractWakeCommand(ev.results[i][0].transcript);
        if (cmd) cmdRef.current(cmd);
      }
    };
    rec.onerror = (e: any) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed" || e.error === "language-not-supported") {
        wantRef.current = false;
        setState("error");
        setMessage(e.error === "not-allowed" ? "Accesso al microfono negato." : "Riconoscimento locale non consentito.");
      }
    };
    rec.onend = () => { if (wantRef.current && !pausedRef.current) setTimeout(startRec, 250); };
    recRef.current = rec;
    wantRef.current = true;
    setMessage(null);
    setState(pausedRef.current ? "paused" : "listening");
    startRec();
  }, [startRec]);

  return { state, message, start, stop };
}
