import { createFileRoute } from "@tanstack/react-router";
import { Radar } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/informazioni")({
  head: () => ({ meta: [
    { title: "Informazioni · V.E.G.A" },
    { name: "description", content: "News e meteo in tempo reale tramite V.E.G.A." },
    { property: "og:title", content: "Informazioni · V.E.G.A" },
    { property: "og:description", content: "News e meteo in tempo reale tramite V.E.G.A." },
  ] }),
  component: () => <ModulePlaceholder name="Informazioni" code="MOD-04" icon={Radar} />,
});
