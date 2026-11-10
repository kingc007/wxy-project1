// Minimal SSE framing for the brief stream (server writer + client reader). No dependencies.
import type { BriefEvent } from "./events";

export function formatSse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/** Splits a text stream into complete SSE frames. Keeps the trailing partial frame in `rest`. */
export function splitFrames(buffer: string): { frames: string[]; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  return { frames: parts, rest };
}

export function parseFrame(frame: string): BriefEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
  }
  if (!data.length) return null;
  try {
    return { event, data: JSON.parse(data.join("\n")) } as BriefEvent;
  } catch {
    return null;
  }
}

export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<BriefEvent> {
  yield* readEventsRaw(body) as AsyncGenerator<BriefEvent>;
}

export async function* readEventsRaw(body: ReadableStream<Uint8Array>): AsyncGenerator<{ event: string; data: unknown }> {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const { frames, rest } = splitFrames(buf);
      buf = rest;
      for (const f of frames) {
        const ev = parseFrame(f);
        if (ev) yield ev;
      }
    }
    if (buf.trim()) {
      const ev = parseFrame(buf);
      if (ev) yield ev;
    }
  } finally {
    reader.releaseLock();
  }
}
