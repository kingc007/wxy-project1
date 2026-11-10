// 1B side of "Browser handoff: Site Brief -> Massing Studio"
// (see _Shared/ZoningEnvelope Contract.md, steps 1, 3, 5).

export const MASSING_PORT = 3301;

/**
 * NEXT_PUBLIC_MASSING_URL if set; otherwise the same host the page is served from, on port 3301
 * (so an iPad opening the Mac's LAN address reaches Massing at that same address). Browser only.
 */
export function resolveMassingUrl(
  loc: { protocol: string; hostname: string } | undefined = typeof window === "undefined" ? undefined : window.location,
  envUrl: string | undefined = process.env.NEXT_PUBLIC_MASSING_URL,
): string {
  if (envUrl) return envUrl;
  if (!loc) return `http://localhost:${MASSING_PORT}`;
  const host = loc.hostname.includes(":") && !loc.hostname.startsWith("[") ? `[${loc.hostname}]` : loc.hostname;
  return `${loc.protocol}//${host}:${MASSING_PORT}`;
}
export const MASSING_WINDOW_NAME = "wxy-massing";
export const READY_TIMEOUT_MS = 10_000;

export const MSG_READY = "wxy:massing-ready";
export const MSG_ENVELOPE = "wxy:envelope";

export interface EnvelopeMessage<E = unknown> {
  type: typeof MSG_ENVELOPE;
  version: 1;
  envelope: E;
  source: { app: "site-brief"; address: string; bbl: string | null };
}

export function massingOrigin(url: string = resolveMassingUrl()): string {
  return new URL(url).origin;
}

export function massingOpenUrl(url: string = resolveMassingUrl()): string {
  return `${massingOrigin(url)}/?from=site-brief`;
}

export function isReadyMessage(data: unknown): boolean {
  if (typeof data !== "object" || data === null) return false;
  const d = data as Record<string, unknown>;
  return d.type === MSG_READY && d.version === 1;
}

/** Accept only a ready message from the Massing origin sent by the window we opened. */
export function shouldAcceptReady(
  event: { origin: string; source: unknown; data: unknown },
  popup: unknown,
  origin: string = massingOrigin(),
): boolean {
  return event.origin === origin && popup != null && event.source === popup && isReadyMessage(event.data);
}

export function buildEnvelopeMessage<E>(envelope: E, address: string, bbl: string | null): EnvelopeMessage<E> {
  return { type: MSG_ENVELOPE, version: 1, envelope, source: { app: "site-brief", address, bbl } };
}

export const TOAST_BLOCKED = "Your browser blocked the new tab. Allow pop-ups for this site, or use Download JSON.";
export const TOAST_SENT = "Sent to Massing Studio.";
export function toastTimeout(url: string = resolveMassingUrl()): string {
  return `Massing Studio didn't answer. Is it running at ${url}? You can also use Download JSON.`;
}

/**
 * Opens Massing Studio and sends the envelope once it announces itself.
 * Returns a cancel function that removes the listener and timer. Call from a click handler (popup rules).
 */
export function openInMassing(opts: {
  envelope: unknown;
  address: string;
  bbl: string | null;
  onBlocked: () => void;
  onSent: () => void;
  onTimeout: () => void;
}): () => void {
  const popup = window.open(massingOpenUrl(), MASSING_WINDOW_NAME);
  if (!popup) {
    opts.onBlocked();
    return () => {};
  }
  const origin = massingOrigin();
  const cleanup = () => {
    window.removeEventListener("message", onMessage);
    clearTimeout(timer);
  };
  function onMessage(event: MessageEvent) {
    if (!shouldAcceptReady(event, popup, origin)) return;
    cleanup();
    popup!.postMessage(buildEnvelopeMessage(opts.envelope, opts.address, opts.bbl), origin);
    opts.onSent();
  }
  window.addEventListener("message", onMessage);
  const timer = setTimeout(() => {
    cleanup();
    opts.onTimeout();
  }, READY_TIMEOUT_MS);
  return cleanup;
}
