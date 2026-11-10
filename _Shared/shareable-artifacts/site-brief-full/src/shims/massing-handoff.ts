// Replaces app/lib/brief-client/massing-handoff.ts. The real one opens a localhost window and postMessages the
// envelope to it; that cannot work between two claude.ai artifacts. Here "Open in Massing" copies the envelope JSON
// to the clipboard and offers it as a download (envelope-<bbl>.json), then tells the user where to load it.
import { toast } from "sonner";
import { envelopeFilename } from "@/lib/brief-client/format";
import { saveBlob } from "../download";

export const MASSING_ARTIFACT_URL = "https://claude.ai/artifact/USAjpXT4MA6MNXmkeYCCDG";

export const TOAST_BLOCKED = "Could not hand off the envelope. Use Download JSON instead.";
export const TOAST_SENT = "Envelope copied. Load it in the Massing Studio artifact.";
export function toastTimeout(): string {
  return "Could not hand off the envelope. Use Download JSON instead.";
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* fall through to the legacy path (clipboard API is often blocked inside iframes) */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function openInMassing(opts: {
  envelope: unknown;
  address: string;
  bbl: string | null;
  onBlocked: () => void;
  onSent: () => void;
  onTimeout: () => void;
}): () => void {
  const json = JSON.stringify(opts.envelope, null, 2);
  const filename = envelopeFilename(opts.bbl);
  void (async () => {
    const copied = await copyText(json);
    void saveBlob(new Blob([json], { type: "application/json" }), filename);
    toast(copied ? "Envelope JSON copied to the clipboard" : "Envelope JSON ready to save", {
      description: `Open the Massing Studio artifact and load ${filename} (or paste the JSON).`,
      action: { label: "Open Massing Studio", onClick: () => window.open(MASSING_ARTIFACT_URL, "_blank", "noopener") },
      duration: 15000,
    });
  })();
  return () => {};
}
