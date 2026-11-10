// Replaces @/lib/export/download (same signature). In the artifact sandbox <a download> may be blocked, so files go
// through the platform `downloads` capability (viewer confirms). That capability only accepts an allowlist of
// extensions (no .3dm / .glb), so those are wrapped in a stored (uncompressed) .zip. Outside the artifact host
// (window.claude absent) it falls back to the ordinary blob <a download>.
type Downloads = { save(r: { filename: string; data: Blob | string | ArrayBuffer }): Promise<{ status: string }> };
type ClaudeHost = { use?: (name: string) => Promise<unknown> };

const ALLOWED = new Set("gif png jpg jpeg webp mp4 webm mov txt json md docx pptx epub csv ttf html svg pdf xlsx zip fig".split(" "));

let cached: Promise<Downloads | null> | null = null;
/** Resolves the capability (or null). Never rejects; called at startup so it is ready before the first export. */
export function getDownloads(): Promise<Downloads | null> {
  if (!cached) {
    cached = (async () => {
      try {
        const host = (window as unknown as { claude?: ClaudeHost }).claude;
        if (!host?.use) return null;
        const d = (await Promise.race([host.use("downloads"), new Promise((r) => setTimeout(() => r(null), 11_000))])) as Downloads | null;
        return d && typeof d.save === "function" ? d : null;
      } catch {
        return null;
      }
    })();
  }
  return cached;
}

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Single-entry ZIP, method 0 (stored). */
export function zipStored(name: string, data: Uint8Array): Uint8Array {
  const nm = new TextEncoder().encode(name);
  const crc = crc32(data);
  const date = ((2026 - 1980) << 9) | (1 << 5) | 1;
  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true);
  local.setUint16(4, 20, true);
  local.setUint16(6, 0x0800, true); // UTF-8 names
  local.setUint16(8, 0, true);
  local.setUint16(10, 0, true);
  local.setUint16(12, date, true);
  local.setUint32(14, crc, true);
  local.setUint32(18, data.length, true);
  local.setUint32(22, data.length, true);
  local.setUint16(26, nm.length, true);
  local.setUint16(28, 0, true);
  const cen = new DataView(new ArrayBuffer(46));
  cen.setUint32(0, 0x02014b50, true);
  cen.setUint16(4, 20, true);
  cen.setUint16(6, 20, true);
  cen.setUint16(8, 0x0800, true);
  cen.setUint16(10, 0, true);
  cen.setUint16(12, 0, true);
  cen.setUint16(14, date, true);
  cen.setUint32(16, crc, true);
  cen.setUint32(20, data.length, true);
  cen.setUint32(24, data.length, true);
  cen.setUint16(28, nm.length, true);
  cen.setUint32(42, 0, true);
  const cdOffset = 30 + nm.length + data.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, 1, true);
  end.setUint16(10, 1, true);
  end.setUint32(12, 46 + nm.length, true);
  end.setUint32(16, cdOffset, true);
  const out = new Uint8Array(cdOffset + 46 + nm.length + 22);
  let o = 0;
  for (const part of [new Uint8Array(local.buffer), nm, data, new Uint8Array(cen.buffer), nm, new Uint8Array(end.buffer)]) {
    out.set(part, o);
    o += part.length;
  }
  return out;
}

function anchorDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function deliver(data: Blob | BlobPart, filename: string, mime: string): Promise<void> {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const d = await getDownloads();
  if (d) {
    const ext = filename.includes(".") ? filename.split(".").pop()!.toLowerCase() : "";
    try {
      if (ALLOWED.has(ext)) await d.save({ filename, data: blob });
      else await d.save({ filename: `${filename}.zip`, data: new Blob([zipStored(filename, new Uint8Array(await blob.arrayBuffer()))]) });
      return;
    } catch (e) {
      if ((e as { code?: string })?.code === "declined") return;
      /* any other failure: fall through to the plain download */
    }
  }
  anchorDownload(blob, filename);
}

export function downloadBlob(data: Blob | BlobPart, filename: string, mime = "application/octet-stream"): void {
  void deliver(data, filename, mime);
}
