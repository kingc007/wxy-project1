"use client";
// Browser handoff: Site Brief -> Massing Studio (see _Shared/ZoningEnvelope Contract.md, "Browser handoff").
// 3A side: steps 2 (announce readiness), 4 (accept the envelope from the allowed origin), 5 (remove listeners).
import { useStudio } from "@/lib/store/studio";
import { loadEnvelope } from "./actions";

export const HANDOFF_TIMEOUT_MS = 10_000;
export const HANDOFF_REPEAT_MS = 500;
export const HANDOFF_GUIDANCE = "Couldn't receive the lot from Site Brief. In Site Brief, use Download JSON, then Load envelope here.";
const SITE_BRIEF_PORT = 3101;

export interface EnvelopeMessage {
  type: "wxy:envelope";
  version: 1;
  envelope: unknown;
  source: { app: "site-brief"; address: string; bbl: string | null };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** True for any message that claims to be a Site Brief envelope (whether or not it is well formed). */
export function isEnvelopeType(d: unknown): boolean {
  return isObj(d) && d.type === "wxy:envelope";
}

/** Full shape check of a `wxy:envelope` message. The envelope itself is validated later against the schema. */
export function isEnvelopeMessage(d: unknown): d is EnvelopeMessage {
  if (!isObj(d) || d.type !== "wxy:envelope" || d.version !== 1 || !("envelope" in d) || d.envelope == null) return false;
  const s = d.source;
  return isObj(s) && s.app === "site-brief" && typeof s.address === "string" && (s.bbl === null || typeof s.bbl === "string");
}

/**
 * Origin Site Brief posts from. `NEXT_PUBLIC_SITE_BRIEF_URL` overrides; otherwise the page's own host on port 3101,
 * so the pair also works over a LAN address (e.g. an iPad opening http://192.168.1.20:3301).
 */
export function allowedSenderOrigin(envUrl: string | undefined, loc: { protocol: string; hostname: string }): string {
  if (envUrl) {
    try {
      return new URL(envUrl).origin;
    } catch {
      /* fall through to the default */
    }
  }
  const host = loc.hostname.includes(":") && !loc.hostname.startsWith("[") ? `[${loc.hostname}]` : loc.hostname;
  return `${loc.protocol}//${host}:${SITE_BRIEF_PORT}`;
}

export function isAllowedOrigin(origin: string, allowed: string): boolean {
  return origin === allowed;
}

export const wantsHandoff = (search: string): boolean => new URLSearchParams(search).get("from") === "site-brief";

function clearFromParam(): void {
  try {
    const u = new URL(location.href);
    u.searchParams.delete("from");
    history.replaceState(history.state, "", u.pathname + u.search + u.hash);
  } catch {
    /* ignore */
  }
}

/** Runs the handoff. Returns a cleanup that removes the listener and timers (safe to call more than once). */
export function startHandoff(): () => void {
  const st = () => useStudio.getState();
  const opener = window.opener as Window | null;
  let finished = false;
  const timers: { repeat?: ReturnType<typeof setInterval>; timeout?: ReturnType<typeof setTimeout> } = {};

  const stop = () => {
    finished = true;
    window.removeEventListener("message", onMessage);
    clearInterval(timers.repeat);
    clearTimeout(timers.timeout);
  };
  const fail = () => {
    stop();
    clearFromParam();
    st().set({ handoff: "failed", notice: HANDOFF_GUIDANCE, announcement: HANDOFF_GUIDANCE });
  };

  const allowed = allowedSenderOrigin(process.env.NEXT_PUBLIC_SITE_BRIEF_URL, location);

  function onMessage(e: MessageEvent) {
    if (finished || !isAllowedOrigin(e.origin, allowed) || (opener && e.source !== opener)) return;
    if (!isEnvelopeType(e.data)) return;
    stop();
    clearFromParam();
    if (!isEnvelopeMessage(e.data)) {
      st().set({ handoff: "failed", notice: HANDOFF_GUIDANCE, announcement: HANDOFF_GUIDANCE });
      return;
    }
    const msg = e.data;
    void loadEnvelope(msg.envelope, null).then(() => {
      if (st().model) {
        const text = `Loaded from Site Brief: ${msg.source.address}`;
        st().set({ handoff: "idle", notice: text, announcement: text });
      } else {
        st().set({ handoff: "failed", notice: HANDOFF_GUIDANCE, announcement: HANDOFF_GUIDANCE });
      }
    });
  }

  if (!opener) {
    fail();
    return stop;
  }
  st().set({ handoff: "waiting" });
  window.addEventListener("message", onMessage);
  const ping = () => {
    try {
      opener.postMessage({ type: "wxy:massing-ready", version: 1 }, "*");
    } catch {
      /* opener closed or inaccessible */
    }
  };
  ping();
  timers.repeat = setInterval(ping, HANDOFF_REPEAT_MS);
  timers.timeout = setTimeout(fail, HANDOFF_TIMEOUT_MS);
  return () => {
    // Unmount (or StrictMode re-run) before completion: stop listening and don't leave the UI stuck "waiting".
    const wasPending = !finished;
    stop();
    if (wasPending && st().handoff === "waiting") st().set({ handoff: "idle" });
  };
}
