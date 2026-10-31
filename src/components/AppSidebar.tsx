import { Link, useRouterState } from "@tanstack/react-router";
import { MessageSquareCode, Network, CalendarClock, Radar, NotebookPen, Cpu } from "lucide-react";

export const NAV = [
  { to: "/", label: "Chat Principale", icon: MessageSquareCode },
  { to: "/rete", label: "Rete & Ollama", icon: Network },
  { to: "/produttivita", label: "Produttività", icon: CalendarClock },
  { to: "/informazioni", label: "Informazioni", icon: Radar },
  { to: "/diario", label: "Diario & Documenti", icon: NotebookPen },
  { to: "/sistema", label: "Stato Sistema & Media", icon: Cpu },
] as const;

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
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
      <div className="hidden border-t p-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:block">
        <span className="text-primary">●</span> Core online · Step 1
      </div>
    </aside>
  );
}
