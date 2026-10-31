import type { LucideIcon } from "lucide-react";

export function ModulePlaceholder({ name, code, icon: Icon }: { name: string; code: string; icon: LucideIcon }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="panel relative w-full max-w-xl rounded-lg p-10 text-center">
        <span className="absolute left-3 top-3 font-mono text-[10px] text-muted-foreground">{code}</span>
        <span className="absolute right-3 top-3 font-mono text-[10px] text-primary">STANDBY</span>
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-primary/50 glow">
          <Icon className="h-9 w-9 text-primary" />
        </div>
        <h1 className="font-display text-2xl tracking-widest text-primary text-glow">{name.toUpperCase()}</h1>
        <p className="mt-4 font-mono text-sm leading-relaxed text-muted-foreground">
          Modulo {name} integrato a livello grafico. Pronto per l'attivazione logica nello Step successivo.
        </p>
        <div className="mt-8 h-1 overflow-hidden rounded bg-muted">
          <div className="h-full w-1/3 bg-primary glow" />
        </div>
      </div>
    </div>
  );
}
