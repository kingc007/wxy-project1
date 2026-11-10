// Client-side "Built-in (no AI)" strategy set: the six typology presets, unfitted. Used only when the generate
// service can't be reached, so the studio keeps working offline. (The server's offline path additionally fits floor
// counts to the program; this fallback does not, and says so.)
import { TYPOLOGY_PRESETS, type Typology } from "@wxy/massing";
import type { SlotProposal } from "@/lib/store/logic";

export const BUILTIN_ORDER: Typology[] = [
  "podium_tower",
  "perimeter_courtyard",
  "stepped_terraces",
  "slab_bar",
  "split_massing",
  "carved_volume",
];

export function builtinProposals(): SlotProposal[] {
  return BUILTIN_ORDER.map((t) => ({
    name: TYPOLOGY_PRESETS[t].name,
    intent: TYPOLOGY_PRESETS[t].intent,
    params: TYPOLOGY_PRESETS[t].params,
    notes: ["Built-in preset, not fitted to your program targets."],
  }));
}
