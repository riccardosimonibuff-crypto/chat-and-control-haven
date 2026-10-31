import { createFileRoute } from "@tanstack/react-router";
import { Cpu } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/sistema")({
  head: () => ({ meta: [
    { title: "Stato Sistema & Media · V.E.G.A" },
    { name: "description", content: "Monitoraggio sistema e controllo media di V.E.G.A." },
    { property: "og:title", content: "Stato Sistema & Media · V.E.G.A" },
    { property: "og:description", content: "Monitoraggio sistema e controllo media di V.E.G.A." },
  ] }),
  component: () => <ModulePlaceholder name="Stato Sistema & Media" code="MOD-06" icon={Cpu} />,
});
