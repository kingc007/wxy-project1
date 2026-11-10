"use client";
import { ChevronDown, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { runExport, type ExportKind } from "@/lib/studio/actions";
import { useStudio } from "@/lib/store/studio";

const ITEMS: { kind: ExportKind; label: string }[] = [
  { kind: "3dm", label: "Export .3dm for Rhino" },
  { kind: "gltf", label: "Export glTF" },
  { kind: "boards", label: "Export boards (PNG)" },
  { kind: "params", label: "Export parameters (JSON for Grasshopper)" },
];

export function ExportMenu() {
  const open = useStudio((s) => s.exportOpen);
  const set = useStudio((s) => s.set);
  const has = useStudio((s) => s.slots.some(Boolean));
  const go = async (kind: ExportKind) => {
    set({ notice: "Exporting…" });
    try {
      set({ notice: `Exported ${await runExport(kind)}.` });
    } catch (e) {
      set({ notice: `Export failed: ${e instanceof Error ? e.message : "unknown reason"}.` });
    }
  };
  return (
    <DropdownMenu open={open} onOpenChange={(o) => set({ exportOpen: o })}>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={!has} aria-keyshortcuts="E" className="shrink-0 whitespace-nowrap" title={has ? "Export (E)" : "Generate options to export"} />}>
        <Download data-icon="inline-start" />
        Export
        <ChevronDown data-icon="inline-end" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {ITEMS.map((i) => (
          <DropdownMenuItem key={i.kind} onClick={() => void go(i.kind)}>
            {i.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
