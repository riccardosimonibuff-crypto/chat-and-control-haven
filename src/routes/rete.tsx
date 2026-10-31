import { createFileRoute } from "@tanstack/react-router";
import { Network } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/rete")({
  head: () => ({ meta: [
    { title: "Rete & Ollama · JARVIS" },
    { name: "description", content: "Configurazione connessione rete e Ollama per JARVIS." },
    { property: "og:title", content: "Rete & Ollama · JARVIS" },
    { property: "og:description", content: "Configurazione connessione rete e Ollama per JARVIS." },
  ] }),
  component: () => <ModulePlaceholder name="Rete & Ollama" code="MOD-02" icon={Network} />,
});
