// Walks controls / an envelope / any object and lists paths where a non-null provenanced value lacks support.
// A "provenanced value" is any object with `value`, `unit` and `status` keys.

function isPValueLike(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x) && "value" in x && "unit" in x && "status" in x;
}

function nonEmptyArray(x: unknown): x is unknown[] {
  return Array.isArray(x) && x.length > 0;
}

function citationsOk(cs: unknown[]): boolean {
  return cs.every((c) => {
    const o = c as Record<string, unknown>;
    return !!o && typeof o.quote === "string" && o.quote.length > 0 && typeof o.section === "string" && o.section.length > 0;
  });
}

function problem(o: Record<string, unknown>): string | null {
  const status = o.status as string;
  if (o.value === null || o.value === undefined) return null;
  switch (status) {
    case "cited":
      return nonEmptyArray(o.citations) && citationsOk(o.citations) ? null : "cited value without a valid citation";
    case "data":
      return nonEmptyArray(o.provenance) ? null : "data value without provenance";
    case "computed":
      return typeof o.formula === "string" && o.formula.length > 0 && nonEmptyArray(o.inputs) ? null : "computed value without formula and inputs";
    case "assumed":
      return nonEmptyArray(o.assumptionIds) ? null : "assumed value without assumptionIds";
    case "overridden":
      return o.override ? null : "overridden value without override record";
    case "needs_input":
    case "not_applicable":
    case "manual":
      return `${status} value must be null`;
    default:
      return `unknown status ${String(status)}`;
  }
}

/** Returns "path: reason" entries; an empty list means every non-null value is supported. */
export function checkProvenance(root: unknown, basePath = ""): string[] {
  const out: string[] = [];
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((n, i) => walk(n, `${path}[${i}]`));
      return;
    }
    if (!node || typeof node !== "object") return;
    if (isPValueLike(node)) {
      const p = problem(node);
      if (p) out.push(`${path || "(root)"}: ${p}`);
    }
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (v && typeof v === "object") walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(root, basePath);
  return out;
}
