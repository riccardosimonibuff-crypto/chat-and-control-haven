import { createFileRoute } from "@tanstack/react-router";
import { Radar } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/informazioni")({
  head: () => ({ meta: [
    { title: "Informazioni · JARVIS" },
    { name: "description", content: "News e meteo in tempo reale tramite JARVIS." },
    { property: "og:title", content: "Informazioni · JARVIS" },
    { property: "og:description", content: "News e meteo in tempo reale tramite JARVIS." },
  ] }),
  component: () => <ModulePlaceholder name="Informazioni" code="MOD-04" icon={Radar} />,
});
