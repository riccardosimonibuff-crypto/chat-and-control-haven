import { createFileRoute } from "@tanstack/react-router";
import { Cpu } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/sistema")({
  head: () => ({ meta: [
    { title: "Stato Sistema & Media · JARVIS" },
    { name: "description", content: "Monitoraggio sistema e controllo media di JARVIS." },
    { property: "og:title", content: "Stato Sistema & Media · JARVIS" },
    { property: "og:description", content: "Monitoraggio sistema e controllo media di JARVIS." },
  ] }),
  component: () => <ModulePlaceholder name="Stato Sistema & Media" code="MOD-06" icon={Cpu} />,
});
