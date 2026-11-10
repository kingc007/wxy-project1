// Envelope validation (spec §0): Ajv 2020-12 against the canonical ZoningEnvelope schema (bundled JSON import,
// so it works in the browser). Messages follow the copy deck: "This file isn't a valid zoning envelope: {field} {problem}…"
import Ajv2020 from "ajv/dist/2020";
import type { ErrorObject, ValidateFunction } from "ajv/dist/2020";
import addFormats from "ajv-formats";
import schema from "../data/zoning-envelope.schema.json";

/** A schema-valid ZoningEnvelope v1.0.0 (typed loosely; envelope.ts reads it). */
export type ZoningEnvelopeJson = Record<string, unknown>;

export interface EnvelopeError {
  /** Dotted/bracketed path, e.g. "controls.maxFar.residential.value". "" = document root. */
  path: string;
  /** Designer-readable sentence, "{field} {problem}". */
  message: string;
}
export type ValidateResult = { ok: true; envelope: ZoningEnvelopeJson } | { ok: false; errors: EnvelopeError[] };

let compiled: ValidateFunction | null = null;
function getValidator(): ValidateFunction {
  if (!compiled) {
    // strict:false tolerates annotation-only keywords; validation keywords are still enforced.
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    compiled = ajv.compile(schema);
  }
  return compiled;
}

export function pointerToPath(ptr: string): string {
  return ptr
    .split("/")
    .slice(1)
    .map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
    .reduce((acc, seg) => (/^\d+$/.test(seg) ? `${acc}[${seg}]` : acc ? `${acc}.${seg}` : seg), "");
}

function describe(e: ErrorObject): EnvelopeError {
  const base = pointerToPath(e.instancePath);
  const p = e.params as Record<string, unknown>;
  const join = (...parts: string[]) => parts.filter(Boolean).join(".");
  switch (e.keyword) {
    case "required": {
      const prop = String(p.missingProperty);
      return { path: join(base, prop), message: `${join(base, prop)} is missing` };
    }
    case "additionalProperties": {
      const prop = String(p.additionalProperty);
      return { path: join(base, prop), message: `${join(base, prop)} isn't an allowed field` };
    }
    case "type":
      return { path: base, message: `${base || "the file"} must be ${Array.isArray(p.type) ? p.type.join(" or ") : String(p.type)}` };
    case "enum":
      return { path: base, message: `${base} must be one of ${(p.allowedValues as unknown[]).map(String).join(", ")}` };
    case "const":
      return { path: base, message: `${base} must be ${JSON.stringify(p.allowedValue)}` };
    case "minimum":
    case "maximum":
    case "exclusiveMinimum":
    case "exclusiveMaximum":
      return { path: base, message: `${base} ${e.message ?? "is out of range"}` };
    case "format":
      return { path: base, message: `${base} must be a valid ${String(p.format)}` };
    default:
      return { path: base, message: `${base || "the file"} ${e.message ?? "is invalid"}` };
  }
}

export function validateEnvelope(json: unknown): ValidateResult {
  const validate = getValidator();
  if (validate(json)) return { ok: true, envelope: json as ZoningEnvelopeJson };
  const seen = new Set<string>();
  const errors: EnvelopeError[] = [];
  for (const e of validate.errors ?? []) {
    if (e.keyword === "if") continue; // noise: the real error is on the 'then' branch
    const d = describe(e);
    const key = `${d.path}|${d.message}`;
    if (!seen.has(key)) {
      seen.add(key);
      errors.push(d);
    }
  }
  return { ok: false, errors };
}

/** Full copy-deck sentence for the first error(s). */
export function formatEnvelopeErrors(errors: EnvelopeError[], max = 3): string {
  const shown = errors.slice(0, max).map((e) => e.message);
  const more = errors.length > max ? ` (and ${errors.length - max} more)` : "";
  return `This file isn't a valid zoning envelope: ${shown.join("; ")}${more}. Check it against zoning-envelope.schema.json.`;
}
