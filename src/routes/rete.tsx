import { createFileRoute } from "@tanstack/react-router";
import { Network } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/rete")({
  head: () => ({ meta: [
    { title: "Rete & Ollama · V.E.G.A" },
    { name: "description", content: "Configurazione connessione rete e Ollama per V.E.G.A." },
    { property: "og:title", content: "Rete & Ollama · V.E.G.A" },
    { property: "og:description", content: "Configurazione connessione rete e Ollama per V.E.G.A." },
  ] }),
  component: () => <ModulePlaceholder name="Rete & Ollama" code="MOD-02" icon={Network} />,
});
