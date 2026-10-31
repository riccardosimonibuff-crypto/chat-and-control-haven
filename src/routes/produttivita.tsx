import { createFileRoute } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/produttivita")({
  head: () => ({ meta: [
    { title: "Produttività · JARVIS" },
    { name: "description", content: "Calendario ed email gestiti da JARVIS." },
    { property: "og:title", content: "Produttività · JARVIS" },
    { property: "og:description", content: "Calendario ed email gestiti da JARVIS." },
  ] }),
  component: () => <ModulePlaceholder name="Produttività" code="MOD-03" icon={CalendarClock} />,
});
