import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { fixtureMeta } from "virtual:fixtures";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { MotionProvider } from "@/components/motion-provider";
import { BriefApp } from "@/components/brief/brief-app";
import "./style.css";
import { installApi, PRELOADED } from "./api";
import { installDownloads } from "./download";

installApi();
installDownloads();

const recorded = fixtureMeta.firstFetchedAt.slice(0, 10) === fixtureMeta.lastFetchedAt.slice(0, 10)
  ? fixtureMeta.firstFetchedAt.slice(0, 10)
  : `${fixtureMeta.firstFetchedAt.slice(0, 10)} to ${fixtureMeta.lastFetchedAt.slice(0, 10)}`;

function DemoNote() {
  return (
    <aside data-testid="demo-note" className="border-b border-rule bg-paper-2 px-4 py-2 text-[0.8125rem] leading-[1.45] text-ink-2 sm:px-6">
      <strong className="font-medium text-ink">Shareable demo: preloaded NYC lots only.</strong>{" "}
      {PRELOADED.length} lots, data recorded {recorded} from NYC GeoSearch (Planning Labs), NYC PLUTO (NYC Open Data) and
      NYC DCP MapPLUTO / zoning layers (ArcGIS). Nothing is fetched live; other addresses will not resolve.
    </aside>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <MotionProvider>
      <TooltipProvider delayDuration={200}>
        <DemoNote />
        <BriefApp />
      </TooltipProvider>
    </MotionProvider>
    <Toaster />
  </StrictMode>,
);
