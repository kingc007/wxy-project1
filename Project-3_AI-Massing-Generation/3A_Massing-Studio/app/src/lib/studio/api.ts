// Client for the studio's API routes (contracts: _manager/ai-spec-3A.md). Responses are validated here again:
// the client never trusts server-supplied metrics, it re-runs the engine from parameters.
import {
  AssumptionsSchema,
  PartialParamsSchema,
  ProgramScheduleSchema,
  type Assumptions,
  type MassingParams,
  type ProgramSchedule,
} from "@wxy/massing";
import type { ParamChange } from "@/lib/store/logic";

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  usd: number;
  ms: number;
}
export const ZERO_USAGE: Usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, usd: 0, ms: 0 };

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Accepts the totals shape {input, output, cacheRead, cacheWrite, usd, ms} plus common SDK spellings. */
export function normalizeUsage(u: unknown): Usage {
  if (!u || typeof u !== "object") return { ...ZERO_USAGE };
  const o = u as Record<string, unknown>;
  return {
    input: num(o.input ?? o.input_tokens),
    output: num(o.output ?? o.output_tokens),
    cacheRead: num(o.cacheRead ?? o.cache_read_input_tokens),
    cacheWrite: num(o.cacheWrite ?? o.cache_creation_input_tokens),
    usd: num(o.usd ?? o.costUsd),
    ms: num(o.ms ?? o.latencyMs),
  };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    usd: a.usd + b.usd,
    ms: a.ms + b.ms,
  };
}

export interface AiStatus {
  ai: boolean;
  models?: Record<string, string>;
  costLimitUsd?: number;
}

async function postJson(url: string, body: unknown, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error body */
  }
  if (!res.ok) {
    const msg = json && typeof json === "object" && "error" in json ? String((json as { error: unknown }).error) : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

export async function fetchStatus(signal?: AbortSignal): Promise<AiStatus> {
  const res = await fetch("/api/status", { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const j = (await res.json()) as Record<string, unknown>;
  return {
    ai: j.ai === true,
    models: j.models && typeof j.models === "object" ? (j.models as Record<string, string>) : undefined,
    costLimitUsd: typeof j.costLimitUsd === "number" ? j.costLimitUsd : undefined,
  };
}

// ---------- parse brief ----------
export interface EnvelopeSummary {
  envelopeId: string;
  district: string;
  lotAreaSf: number;
  lotType: string;
  maxFar: Record<string, number>;
  maxBuildingHeightFt: number | null;
}

export interface ParseBriefResult {
  schedule: ProgramSchedule;
  assumptions: Partial<Assumptions>;
  usage: Usage;
  /** Server notice, e.g. AI off or AI failed and the built-in reader was used. */
  warning: string | null;
  source: "ai" | "builtin" | null;
}

export async function parseBriefRequest(brief: string, envelopeSummary: EnvelopeSummary, mode: "ai" | "builtin", signal?: AbortSignal): Promise<ParseBriefResult> {
  const j = (await postJson("/api/parse-brief", { brief, envelopeSummary, mode }, signal)) as Record<string, unknown>;
  const sched = ProgramScheduleSchema.safeParse(j.schedule);
  if (!sched.success) throw new Error("the schedule came back in an unexpected shape");
  // Assumptions may be partial: validate each known piece on its own.
  const assumptions: Partial<Assumptions> = {};
  const a = (j.assumptions ?? {}) as Record<string, unknown>;
  const full = AssumptionsSchema.safeParse(a);
  if (full.success) Object.assign(assumptions, full.data);
  else {
    const one = AssumptionsSchema.shape;
    for (const k of ["groundFloorHeight", "avgUnitNetSf", "efficiency"] as const) {
      const r = one[k].safeParse(a[k]);
      if (r.success) (assumptions as Record<string, unknown>)[k] = r.data;
    }
    const f = a.floorToFloor as Record<string, unknown> | undefined;
    if (f) {
      const ftf: Partial<Assumptions["floorToFloor"]> = {};
      for (const k of ["residential", "commercial", "community_facility"] as const) {
        const r = one.floorToFloor.shape[k].safeParse(f[k]);
        if (r.success) ftf[k] = r.data;
      }
      if (Object.keys(ftf).length) assumptions.floorToFloor = ftf as Assumptions["floorToFloor"];
    }
  }
  return { schedule: { ...sched.data, confirmed: false }, assumptions, usage: normalizeUsage(j.usage),
    warning: typeof j.warning === "string" ? j.warning : null,
    source: j.source === "ai" || j.source === "builtin" ? j.source : null,
  };
}

// ---------- generate (NDJSON stream) ----------
export interface GeneratedProposal {
  typology?: string;
  name: string;
  intent: string;
  params: Partial<MassingParams>;
  notes: string[];
  source: "ai" | "builtin" | null;
}

export type GenerateEvent =
  | { kind: "start"; notice: string | null }
  | { kind: "option"; slot: number | null; status: string; proposal: GeneratedProposal; usage: Usage; reason: string | null }
  | { kind: "progress"; slot: number | null; status: string; message: string | null }
  | { kind: "error"; message: string }
  | { kind: "done"; totals: Usage };

/**
 * One NDJSON line -> typed event (contract: lib/ai/contracts.ts GenerateEvent). Unknown shapes return null.
 * Only parameters and prose are read from the option; its metrics are ignored (the client re-runs the engine).
 */
export function parseGenerateLine(line: string): GenerateEvent | null {
  let j: unknown;
  try {
    j = JSON.parse(line);
  } catch {
    return null;
  }
  if (!j || typeof j !== "object") return null;
  const o = j as Record<string, unknown>;
  if (o.type === "done") return { kind: "done", totals: normalizeUsage(o.totals) };
  if (o.type === "start") return { kind: "start", notice: typeof o.notice === "string" ? o.notice : null };
  if (o.type === "error") return { kind: "error", message: typeof o.message === "string" ? o.message : "the generate service reported an error" };
  if (o.type !== "slot") return null;
  const slot = typeof o.slot === "number" && Number.isInteger(o.slot) ? o.slot : null;
  const status = typeof o.status === "string" ? o.status : "";
  const opt = o.option;
  if (!opt || typeof opt !== "object") return { kind: "progress", slot, status, message: null };
  const p = opt as Record<string, unknown>;
  const params = PartialParamsSchema.safeParse(p.params);
  if (!params.success || typeof p.name !== "string" || typeof p.intent !== "string")
    return { kind: "progress", slot, status: "error", message: "an option came back with invalid parameters" };
  const notes = Array.isArray(p.notes) ? p.notes.map(String) : typeof p.notes === "string" && p.notes ? [p.notes] : [];
  return {
    kind: "option",
    slot,
    status,
    usage: normalizeUsage(o.usage),
    reason: typeof o.reason === "string" ? o.reason : null,
    proposal: {
      typology: typeof p.typology === "string" ? p.typology : undefined,
      name: p.name,
      intent: p.intent,
      params: params.data,
      notes,
      source: p.source === "ai" || p.source === "builtin" ? p.source : null,
    },
  };
}

export interface GenerateRequest {
  envelope: unknown;
  schedule: ProgramSchedule;
  assumptions: Assumptions;
  count: 1 | 2 | 3 | 4 | 5 | 6;
  mode?: "ai" | "builtin";
  /** 0-based slot to run on the hard model. */
  thinkHarderSlot?: number;
}

export async function streamGenerate(req: GenerateRequest, onEvent: (e: GenerateEvent) => void, signal?: AbortSignal): Promise<void> {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  if (!res.ok || !res.body) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as { error?: unknown };
      if (j.error) msg = String(j.error);
    } catch {
      /* keep status text */
    }
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) {
        const ev = parseGenerateLine(line);
        if (ev) onEvent(ev);
      }
    }
  }
  const tail = buf.trim();
  if (tail) {
    const ev = parseGenerateLine(tail);
    if (ev) onEvent(ev);
  }
}

// ---------- iterate ----------
export interface IterateResult {
  changes: ParamChange[];
  usage: Usage;
  /** "ai" or "builtin" when the server says so; used for the label on the change list. */
  source: "ai" | "builtin" | null;
}

export async function iterateRequest(
  req: { envelope: unknown; schedule: ProgramSchedule; assumptions: Assumptions; option: { typology: string; params: MassingParams }; instruction: string; history: { instruction: string }[]; mode?: "ai" | "builtin" },
  signal?: AbortSignal,
): Promise<IterateResult> {
  const j = (await postJson("/api/iterate", req, signal)) as Record<string, unknown>;
  const diff = j.diff as { changes?: unknown } | undefined;
  if (!diff || !Array.isArray(diff.changes) || diff.changes.length === 0) throw new Error("no changes came back");
  const changes: ParamChange[] = [];
  for (const c of diff.changes) {
    if (!c || typeof c !== "object") continue;
    const o = c as Record<string, unknown>;
    if (typeof o.key !== "string") continue;
    const to = o.to;
    if (typeof to !== "number" && typeof to !== "string" && typeof to !== "boolean") continue;
    const from = o.from;
    changes.push({
      key: o.key as keyof MassingParams,
      to,
      from: typeof from === "number" || typeof from === "string" || typeof from === "boolean" ? from : undefined,
      reason: typeof o.reason === "string" ? o.reason : undefined,
    });
  }
  if (changes.length === 0) throw new Error("no usable changes came back");
  const src = j.source === "ai" || j.source === "builtin" ? j.source : j.mode === "offline" ? "builtin" : null;
  return { changes, usage: normalizeUsage(j.usage), source: src };
}
