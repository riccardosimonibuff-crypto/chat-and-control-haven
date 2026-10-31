import { createFileRoute } from "@tanstack/react-router";
import { NotebookPen } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/diario")({
  head: () => ({ meta: [
    { title: "Diario & Documenti · JARVIS" },
    { name: "description", content: "Note personali e documenti archiviati da JARVIS." },
    { property: "og:title", content: "Diario & Documenti · JARVIS" },
    { property: "og:description", content: "Note personali e documenti archiviati da JARVIS." },
  ] }),
  component: () => <ModulePlaceholder name="Diario & Documenti" code="MOD-05" icon={NotebookPen} />,
});
