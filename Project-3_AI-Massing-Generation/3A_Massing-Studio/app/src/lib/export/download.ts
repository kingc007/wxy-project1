// Browser-only helper. Call from a user gesture (click handler).
export function downloadBlob(data: Blob | BlobPart, filename: string, mime = "application/octet-stream"): void {
  if (typeof document === "undefined") throw new Error("downloadBlob is browser-only");
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
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
