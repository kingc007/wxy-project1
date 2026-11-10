// Built-in (no AI) intent and notes: templates filled ONLY with computed values, so they always pass checkGrounding.
import { TYPOLOGY_PRESETS, fmtFar, fmtInt, fmtRound10, fmtSf } from "@wxy/massing";
import type { AllowedNumber, MassingOption, TypologyLabel } from "@wxy/massing";

const ROW_LABEL: Record<string, string> = { residential: "residential", commercial: "commercial", community_facility: "community facility", units: "units" };

/** One sentence per program row, computed values only: the real delta is never hidden. */
export function programRowNotes(option: MassingOption): string[] {
  return option.programFit.map((r) => {
    const fmt = (v: number) => (r.use === "units" ? `${fmtInt(v)} units` : fmtSf(v));
    return r.met
      ? `${ROW_LABEL[r.use]}: ${fmt(r.proposed)} against a target of ${fmt(r.target)}.`
      : `Can't reach ${fmt(r.target)}${r.use === "units" ? "" : ` (${ROW_LABEL[r.use]})`} inside this envelope — closest is ${fmt(r.proposed)}.`;
  });
}

/** One line (well under 160 chars): the typology's idea plus computed floors and FAR. */
export function templateIntent(typology: TypologyLabel, option: MassingOption): string {
  const idea = typology === "block" ? "A simple block massing." : TYPOLOGY_PRESETS[typology].intent;
  return `${idea} ${option.metrics.floors} floors, FAR ${fmtFar(option.metrics.far)}.`;
}

export function templateNotes(option: MassingOption): string[] {
  const notes: string[] = programRowNotes(option);
  if (option.overall.failCount > 0) notes.push(`Fails ${option.overall.failCount} ${option.overall.failCount === 1 ? "rule" : "rules"}; see the zoning table.`);
  return notes;
}

export const targetAllowed = (targetGfa: number | null): AllowedNumber[] =>
  targetGfa === null ? [] : [{ label: "program.targetGfa", value: targetGfa, decimals: -1 }];

export { fmtRound10 };
