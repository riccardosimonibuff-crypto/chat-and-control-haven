import { createFileRoute } from "@tanstack/react-router";
import { NotebookPen } from "lucide-react";
import { ModulePlaceholder } from "@/components/ModulePlaceholder";

export const Route = createFileRoute("/diario")({
  head: () => ({ meta: [
    { title: "Diario & Documenti · V.E.G.A" },
    { name: "description", content: "Note personali e documenti archiviati da V.E.G.A." },
    { property: "og:title", content: "Diario & Documenti · V.E.G.A" },
    { property: "og:description", content: "Note personali e documenti archiviati da V.E.G.A." },
  ] }),
  component: () => <ModulePlaceholder name="Diario & Documenti" code="MOD-05" icon={NotebookPen} />,
});
