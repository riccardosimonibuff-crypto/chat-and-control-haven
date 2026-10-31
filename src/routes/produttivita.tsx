import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/produttivita")({
  head: () => ({ meta: [
    { title: "Produttività · V.E.G.A" },
    { name: "description", content: "Calendario ed email gestiti da V.E.G.A." },
    { property: "og:title", content: "Produttività · V.E.G.A" },
    { property: "og:description", content: "Calendario ed email gestiti da V.E.G.A." },
  ] }),
  component: () => <ModulePlaceholder name="Produttività" code="MOD-03" icon={CalendarClock} />,
});
