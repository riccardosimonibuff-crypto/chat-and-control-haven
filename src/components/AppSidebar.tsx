import { Link, useRouterState } from "@tanstack/react-router";
import { useVega } from "@/lib/vega-context";
import { supabase } from "@/integrations/supabase/client";
import { Volume2, VolumeX, LogOut, MessageSquareCode, Network, CalendarClock, Radar, NotebookPen, Cpu } from "lucide-react";

export const NAV = [
  { to: "/", label: "Chat Principale", icon: MessageSquareCode },
  { to: "/rete", label: "Rete & Connessione", icon: Network },
  { to: "/produttivita", label: "Produttività", icon: CalendarClock },
  { to: "/informazioni", label: "Informazioni", icon: Radar },
  { to: "/diario", label: "Diario & Documenti", icon: NotebookPen },
  { to: "/sistema", label: "Stato Sistema & Media", icon: Cpu },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { voiceEnabled, setVoiceEnabled, speaking, user } = useVega();
  return (
    <aside className="panel fixed inset-y-0 left-0 z-20 flex w-16 flex-col border-y-0 border-l-0 md:w-64">
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="relative h-8 w-8 shrink-0">
          <span className="animate-pulse-ring absolute inset-0 rounded-full border-2 border-primary glow" />
          <span className="absolute inset-2 rounded-full bg-primary" />
        </div>
        <div className="hidden min-w-0 md:block">
          <span className="block font-display text-lg leading-none tracking-[0.3em] text-primary text-glow">
            V.E.G.A
          </span>
          <span className="mt-1 block font-mono text-[9px] uppercase leading-tight tracking-[0.14em] text-muted-foreground">
            Virtual Engine
            <br />
            Governing Apatia
          </span>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = path === to;
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 rounded-md border px-3 py-2.5 font-mono text-xs uppercase tracking-wider transition-colors ${
                active
                  ? "border-primary/60 bg-accent text-accent-foreground glow"
                  : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="space-y-2 border-t p-2">
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          role="switch"
          aria-checked={voiceEnabled}
          aria-label="Voce di V.E.G.A"
          className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 font-mono text-xs uppercase tracking-wider ${voiceEnabled ? "border-primary/60 text-primary" : "text-muted-foreground"}`}
        >
          {voiceEnabled ? <Volume2 className={`h-4 w-4 shrink-0 ${speaking ? "animate-pulse" : ""}`} /> : <VolumeX className="h-4 w-4 shrink-0" />}
          <span className="hidden flex-1 text-left md:inline">Voce</span>
          <span className={`hidden h-4 w-8 rounded-full border p-0.5 md:block ${voiceEnabled ? "border-primary bg-primary/20" : ""}`}>
            <span className={`block h-2.5 w-2.5 rounded-full transition-transform ${voiceEnabled ? "translate-x-3.5 bg-primary glow" : "bg-muted-foreground"}`} />
          </span>
        </button>
        {user && (
          <button onClick={() => supabase.auth.signOut()} aria-label="Esci" className="flex w-full items-center gap-3 rounded-md px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-destructive">
            <LogOut className="h-4 w-4 shrink-0" /><span className="hidden truncate md:inline">{user.email}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
