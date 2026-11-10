// File export. Anchors with a blob: href and a `download` attribute (what the app's export menu and envelope
// download create) do not work from a sandboxed artifact iframe, so such clicks are routed to the platform
// `downloads` capability when it exists, and to a normal blob <a download> otherwise.
import { toast } from "sonner";

interface DownloadsCap {
  save(req: { filename: string; data: Blob | string }): Promise<{ status: string }>;
}
type ClaudeWin = { claude?: { use?: (name: string) => Promise<unknown> } };

let capPromise: Promise<DownloadsCap | null> | null = null;
/** Starts resolving the capability once (use() can take up to ~10 s); never blocks rendering. */
function capability(): Promise<DownloadsCap | null> {
  if (!capPromise) {
    capPromise = (async () => {
      try {
        const use = (window as unknown as ClaudeWin).claude?.use;
        if (typeof use !== "function") return null;
        return ((await (window as unknown as ClaudeWin).claude!.use!("downloads")) as DownloadsCap | null) ?? null;
      } catch {
        return null;
      }
    })();
  }
  return capPromise;
}

const origClick = HTMLAnchorElement.prototype.click;

function fallbackDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  origClick.call(a);
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function saveBlob(blob: Blob, filename: string): Promise<void> {
  const cap = await Promise.race([capability(), new Promise<null>((r) => setTimeout(() => r(null), 12_000))]);
  if (cap) {
    try {
      await cap.save({ filename, data: blob });
      return;
    } catch (e) {
      const code = (e as { code?: string } | null)?.code;
      if (code === "declined") return;
      if (code === "rejected_extension" || code === "too_large" || code === "bad_request") {
        toast(`Could not save ${filename}${code === "too_large" ? " (file too large)" : ""}.`);
        return;
      }
      // unavailable / not_granted / ...: fall through to the plain download.
    }
  }
  fallbackDownload(blob, filename);
}

export function installDownloads(): void {
  const blobs = new Map<string, Blob>();
  const origCreate = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (obj: Blob | MediaSource): string => {
    const url = origCreate(obj);
    if (obj instanceof Blob) {
      blobs.set(url, obj);
      if (blobs.size > 24) blobs.delete(blobs.keys().next().value as string);
    }
    return url;
  };
  HTMLAnchorElement.prototype.click = function patchedClick(this: HTMLAnchorElement) {
    const blob = this.hasAttribute("download") ? blobs.get(this.href) : undefined;
    if (!blob) return origClick.call(this);
    void saveBlob(blob, this.getAttribute("download") || "download");
  };
  void capability(); // warm up
}
