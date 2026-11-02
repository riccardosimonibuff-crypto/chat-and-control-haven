import { useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { useVega } from "@/lib/vega-context";

export function SignInGate({ children }: { children: ReactNode }) {
  const { user } = useVega();
  const [err, setErr] = useState<string | null>(null);
  if (user === undefined) return <p className="p-10 font-mono text-xs text-muted-foreground">Verifica identità…</p>;
  if (user) return <>{children}</>;
  async function go(p: "google" | "lovable") {
    setErr(null);
    const r = await lovable.auth.signInWithOAuth(p, { redirect_uri: window.location.origin });
    if (r && "error" in r && r.error) setErr(r.error instanceof Error ? r.error.message : String(r.error));
  }
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="panel w-full max-w-sm rounded-lg p-8 text-center glow">
        <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
        <h1 className="mt-4 font-display text-sm tracking-[0.3em] text-primary text-glow">IDENTIFICAZIONE</h1>
        <p className="mt-2 font-mono text-xs text-muted-foreground">Accedi, signore. La sua apatia merita riservatezza.</p>
        <div className="mt-6 space-y-2">
          <button onClick={() => go("google")} className="w-full rounded-md bg-primary px-4 py-2 font-mono text-xs uppercase tracking-widest text-primary-foreground">Accedi con Google</button>
          <button onClick={() => go("lovable")} className="w-full rounded-md border px-4 py-2 font-mono text-xs uppercase tracking-widest text-muted-foreground hover:border-primary hover:text-primary">Accedi con Lovable</button>
        </div>
        {err && <p className="mt-3 font-mono text-xs text-destructive">⚠ {err}</p>}
      </div>
    </div>
  );
}
