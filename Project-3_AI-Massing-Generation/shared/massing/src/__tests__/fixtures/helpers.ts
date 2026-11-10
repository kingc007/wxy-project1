import { buildEnvelopeModel } from "../../envelope";
import { DEFAULT_PARAMS } from "../../grammar";
import { DEFAULT_ASSUMPTIONS, EMPTY_SCHEDULE } from "../../program";
import { generateOption } from "../../generate";
import type { MassingParams } from "../../types";

export const A = DEFAULT_ASSUMPTIONS;
export const S = EMPTY_SCHEDULE;
export const P = (o: Partial<MassingParams> = {}): MassingParams => ({ ...DEFAULT_PARAMS, ...o });
export const model = (json: unknown) => buildEnvelopeModel(json);
export const gen = (json: unknown, o: Partial<MassingParams>) => generateOption(model(json), S, A, P(o));
export const row = (opt: { compliance: { id: string }[] }, id: string) => {
  const r = opt.compliance.find((c) => c.id === id);
  if (!r) throw new Error(`no compliance row ${id}`);
  return r as ReturnType<typeof generateOption>["compliance"][number];
};
