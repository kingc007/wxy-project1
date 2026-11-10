// Strategy agent: 6 parallel slots, one typology each. "LLM proposes, geometry engine disposes":
// the model only ever supplies parameters and prose; every option is re-generated from its params by the engine and
// every number in the response comes from that engine run. Offline mode (fitPreset) is complete and deterministic.
import type Anthropic from "@anthropic-ai/sdk";
import {
  TYPOLOGIES,
  allowedNumbersFromOption,
  checkGrounding,
  classifyTypology,
  fmtFar,
  fmtRound10,
  formatZodError,
  generateOption,
  isNearDuplicate,
  presetParams,
  validateParams,
  TYPOLOGY_PRESETS,
} from "@wxy/massing";
import type { Assumptions, EnvelopeModel, MassingOption, MassingParams, ProgramSchedule, Typology } from "@wxy/massing";
import { MODELS, REQUEST_TIMEOUT_MS, costLimitUsd, getClient, type AiClient, type ModelId } from "./client";
import type { FailingRule, GenerateEvent, OptionPayload, SlotUsage, Source } from "./contracts";
import { CostMeter, emptyUsage, estimateTurnUsd, usageFromResponse, usdFor, type Totals } from "./cost";
import { DID_NOT_FINISH_INTENT, NO_KEY_MESSAGE, REFUSAL_MESSAGE, describeError, overBudget } from "./errors";
import { fitPreset, targetGfaOf } from "./fit";
import { templateIntent, templateNotes, targetAllowed } from "./intent";
import { STRATEGY_SYSTEM_PROMPT, TYPOLOGY_LIBRARY_DATA } from "./prompts";
import { contextAllowed, optionCounts, siteText } from "./site";
import { CheckComplianceInput, GenerateMassingInput, STRATEGY_TOOLS, SubmitOptionInput } from "./tools";

export const MAX_MODEL_TURNS = 4;
export const MAX_GENERATE_CALLS = 3;
const MAX_TOKENS = 6000;
export const LOOP_LIMIT_MESSAGE = "Loop limit reached — submit your best parameters";

export interface GenerateInput {
  model: EnvelopeModel;
  schedule: ProgramSchedule;
  assumptions: Assumptions;
  count?: number;
  mode: Source;
  thinkHarderSlot?: number;
  costLimitUsd?: number;
}

// ---------- payloads ----------
export function failingRulesOf(o: MassingOption): FailingRule[] {
  return o.compliance.filter((c) => c.status === "fail").map((c) => ({ rule: c.rule, allowed: c.allowed, proposed: c.proposed }));
}

export function toPayload(
  option: MassingOption,
  meta: { assigned: Typology; name: string; intent: string; notes: string[]; agentLog: string[]; source: Source; fit?: "ok" | "typology-not-realisable" },
): OptionPayload {
  return {
    typology: option.typology,
    assignedTypology: meta.assigned,
    name: meta.name,
    intent: meta.intent,
    params: option.params,
    notes: meta.notes,
    agentLog: meta.agentLog,
    source: meta.source,
    metrics: option.metrics,
    overall: option.overall,
    programFit: option.programFit,
    failingRules: failingRulesOf(option),
    ...(meta.fit ? { fit: meta.fit } : {}),
  };
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r10 = (v: number) => Math.round(v / 10) * 10;

function roundedMetrics(o: MassingOption) {
  const m = o.metrics;
  return {
    lotArea: r10(m.lotArea),
    gfa: r10(m.gfa),
    gfaByProgram: Object.fromEntries(Object.entries(m.gfaByProgram).map(([k, v]) => [k, r10(v)])),
    far: r2(m.far),
    floors: m.floors,
    height: r1(m.height),
    footprint: r10(m.footprint),
    lotCoveragePct: r1(m.lotCoveragePct),
    openSpacePct: r1(m.openSpacePct),
    unitsEst: m.unitsEst,
    streetWallHeight: r1(m.streetWallHeight),
    trimmedVolume: r10(m.trimmedVolume),
  };
}

interface Draft {
  id: string;
  typology: Typology;
  params: MassingParams;
  option: MassingOption;
}

const fitScore = (o: MassingOption) => (o.programFit.length ? o.programFit.reduce((s, r) => s + Math.abs(r.deltaPct), 0) / o.programFit.length : 0);

/** Fewest fails, then best program fit; earliest wins ties. */
export function bestDraft(drafts: Draft[]): Draft | null {
  let best: Draft | null = null;
  for (const d of drafts) {
    if (!best) best = d;
    else if (d.option.overall.failCount < best.option.overall.failCount) best = d;
    else if (d.option.overall.failCount === best.option.overall.failCount && fitScore(d.option) < fitScore(best.option) - 1e-9) best = d;
  }
  return best;
}

// ---------- one AI slot ----------
type Outcome =
  | { kind: "submitted"; draft: Draft; name: string; intent: string; notes: string; ungrounded: boolean }
  | { kind: "unfinished"; draft: Draft | null; reason: string }
  | { kind: "fallback"; reason: string };

interface SlotCtx {
  client: AiClient;
  meter: CostMeter;
  input: GenerateInput;
  extras: ReturnType<typeof contextAllowed>;
  target: number | null;
  site: string;
}

function userMessage(ctx: SlotCtx, assigned: Typology): string {
  const info = TYPOLOGY_LIBRARY_DATA.find((t) => t.typology === assigned);
  return [
    `Assigned typology: ${assigned} (${info?.name ?? ""}). Other slots are exploring other typologies; make yours unmistakably distinct.`,
    "",
    ctx.site,
    "",
    `Start with generateMassing using typology "${assigned}", read the result, adjust at most twice, then call submitOption.`,
  ].join("\n");
}

async function runAiSlot(ctx: SlotCtx, slot: number, assigned: Typology, usage: SlotUsage, log: string[]): Promise<Outcome> {
  const { client, meter, input } = ctx;
  const hard = input.thinkHarderSlot === slot;
  const modelId: ModelId = hard ? MODELS.hard : MODELS.strategy;
  const effort = hard ? "medium" : "low";
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userMessage(ctx, assigned) }];
  const drafts: Draft[] = [];
  let genCalls = 0;
  let submitAttempts = 0;
  let lastTurnUsd: number | null = null;
  const toolsChars = JSON.stringify(STRATEGY_TOOLS).length;

  const allowedFor = (o: MassingOption) => allowedNumbersFromOption(o, [...ctx.extras, ...optionCounts(o), ...targetAllowed(ctx.target)]);

  const run = (block: Anthropic.ToolUseBlock): { content: string; is_error?: boolean; submitted?: Outcome } => {
    const err = (m: string) => ({ content: m, is_error: true as const });
    switch (block.name) {
      case "listTypologies":
        return {
          content: JSON.stringify(
            TYPOLOGY_LIBRARY_DATA.map((t) => ({ typology: t.typology, name: t.name, idea: t.idea, keyParams: TYPOLOGY_PRESETS[t.typology].params, worksWhen: t.worksWhen, risk: t.risk })),
          ),
        };
      case "generateMassing": {
        const p = GenerateMassingInput.safeParse(block.input);
        if (!p.success) return err(formatZodError(p.error, 5));
        const v = validateParams(p.data.params as Partial<MassingParams>);
        if (!v.ok) return err(v.errors.slice(0, 5).join("; "));
        if (genCalls >= MAX_GENERATE_CALLS) return err(LOOP_LIMIT_MESSAGE);
        const params: MassingParams = { ...presetParams(p.data.typology), ...(p.data.params as Partial<MassingParams>) };
        let option: MassingOption;
        try {
          option = generateOption(input.model, input.schedule, input.assumptions, params);
        } catch (e) {
          return err(e instanceof Error ? e.message : "The engine could not build these parameters.");
        }
        genCalls++;
        const draft: Draft = { id: option.id, typology: p.data.typology, params, option };
        if (!drafts.some((d) => d.id === draft.id)) drafts.push(draft);
        log.push(`generateMassing(${p.data.typology}) -> GFA ${fmtRound10(option.metrics.gfa)} sf, FAR ${fmtFar(option.metrics.far)}, ${option.overall.label}`);
        return {
          content: JSON.stringify({
            optionDraftId: option.id,
            metrics: roundedMetrics(option),
            overall: option.overall.label,
            failingRules: failingRulesOf(option),
            programFit: option.programFit.map((r) => ({ use: r.use, target: r.use === "units" ? r.target : r10(r.target), proposed: r.use === "units" ? r.proposed : r10(r.proposed), deltaPct: r1(r.deltaPct), met: r.met })),
            trims: option.notes.concat(option.metrics.trimmedVolume > 0 ? [`Trimmed ${fmtRound10(option.metrics.trimmedVolume)} cf to fit the envelope`] : []),
          }),
        };
      }
      case "checkCompliance": {
        const p = CheckComplianceInput.safeParse(block.input);
        if (!p.success) return err(formatZodError(p.error, 5));
        const d = drafts.find((x) => x.id === p.data.optionDraftId);
        if (!d) return err(`Unknown optionDraftId ${p.data.optionDraftId}. Use an id returned by generateMassing.`);
        log.push("checkCompliance");
        return { content: JSON.stringify(d.option.compliance.map((c) => ({ rule: c.rule, allowed: c.allowed, proposed: c.proposed, status: c.status }))) };
      }
      case "submitOption": {
        const p = SubmitOptionInput.safeParse(block.input);
        if (!p.success) return err(formatZodError(p.error, 5));
        const d = drafts.find((x) => x.id === p.data.optionDraftId);
        if (!d) return err(`Unknown optionDraftId ${p.data.optionDraftId}. Use an id returned by generateMassing.`);
        const g = checkGrounding(`${p.data.name}\n${p.data.intent}\n${p.data.notes}`, allowedFor(d.option));
        if (!g.ok) {
          submitAttempts++;
          if (submitAttempts === 1) {
            log.push(`submitOption rejected: ungrounded ${g.unmatched.join(", ")}`);
            return err(`Not submitted. These numbers were not computed by the engine: ${g.unmatched.join(", ")}. Rewrite the name, intent and notes using only returned numbers, or none, and submit again.`);
          }
          log.push(`submitOption rejected twice: ungrounded ${g.unmatched.join(", ")}`);
          return { content: "Submitted with the built-in text.", submitted: { kind: "submitted", draft: d, name: p.data.name, intent: "", notes: "", ungrounded: true } };
        }
        log.push("submitOption accepted");
        return { content: "Submitted.", submitted: { kind: "submitted", draft: d, name: p.data.name, intent: p.data.intent, notes: p.data.notes, ungrounded: false } };
      }
      default:
        return err(`Unknown tool ${block.name}.`);
    }
  };

  for (let turn = 1; turn <= MAX_MODEL_TURNS; turn++) {
    const est = lastTurnUsd ?? estimateTurnUsd(modelId, STRATEGY_SYSTEM_PROMPT.length + toolsChars + JSON.stringify(messages).length);
    if (meter.wouldExceed(est)) return { kind: "fallback", reason: overBudget(meter.limitUsd) };

    const resp = await client.messages.create(
      {
        model: modelId,
        max_tokens: MAX_TOKENS,
        // ONE stable block, cached. Envelope/schedule/slot go in the user message.
        system: [{ type: "text", text: STRATEGY_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
        tools: STRATEGY_TOOLS,
        messages,
        output_config: { effort },
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );
    const u = usageFromResponse(resp.usage);
    lastTurnUsd = meter.add(modelId, u);
    usage.input += u.input;
    usage.output += u.output;
    usage.cacheRead += u.cacheRead;
    usage.cacheWrite += u.cacheWrite;
    usage.usd += usdFor(modelId, u);
    log.push(`turn ${turn}: ${resp.stop_reason}; cache read ${u.cacheRead} tokens`);

    if (resp.stop_reason === "refusal") return { kind: "fallback", reason: REFUSAL_MESSAGE };
    if (resp.stop_reason === "max_tokens" || resp.stop_reason === "model_context_window_exceeded")
      return { kind: "unfinished", draft: bestDraft(drafts), reason: "The AI's reply was cut off." };

    const uses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    messages.push({ role: "assistant", content: resp.content as Anthropic.ContentBlockParam[] });
    if (uses.length === 0) {
      if (turn === MAX_MODEL_TURNS) break;
      messages.push({ role: "user", content: "Use the tools: call generateMassing, then submitOption with the draft you choose." });
      continue;
    }
    const results: Anthropic.ToolResultBlockParam[] = [];
    let done: Outcome | null = null;
    for (const b of uses) {
      const r = run(b);
      results.push({ type: "tool_result", tool_use_id: b.id, content: r.content, ...(r.is_error ? { is_error: true } : {}) });
      if (r.submitted && !done) done = r.submitted;
    }
    if (done) return done;
    const content: Anthropic.ContentBlockParam[] = [...results];
    if (turn === MAX_MODEL_TURNS - 1) content.push({ type: "text", text: "This is your last turn. Call submitOption now with your best draft." });
    messages.push({ role: "user", content });
  }
  return { kind: "unfinished", draft: bestDraft(drafts), reason: "The AI ran out of turns." };
}

// ---------- request ----------
export async function runGenerate(input: GenerateInput, emit: (e: GenerateEvent) => void): Promise<Totals> {
  const t0 = Date.now();
  const { model, schedule, assumptions } = input;
  const typologies = TYPOLOGIES.slice(0, input.count ?? 6) as Typology[];
  const client = input.mode === "ai" ? getClient() : null;
  const mode: Source = client ? "ai" : "builtin";
  const meter = new CostMeter(input.costLimitUsd ?? costLimitUsd());
  emit({
    type: "start",
    mode,
    slots: typologies.map((typology, slot) => ({ slot, typology })),
    ...(input.mode === "ai" && !client ? { notice: NO_KEY_MESSAGE } : {}),
  });

  const target = targetGfaOf(schedule, assumptions);
  const ctx = client ? { client, meter, input, extras: contextAllowed(model, schedule, assumptions), target, site: siteText(model, schedule, assumptions) } : null;
  const accepted: { params: MassingParams; typology: ReturnType<typeof classifyTypology> }[] = [];

  const builtin = (typology: Typology, log: string[], extraNotes: string[], status: "done" | "fallback", usage: SlotUsage, slot: number, reason?: string) => {
    const fit = fitPreset(typology, model, schedule, assumptions);
    log.push("Built-in strategy (no AI)");
    const payload = toPayload(fit.option, { assigned: typology, name: fit.name, intent: fit.intent, notes: [...extraNotes, ...fit.notes], agentLog: log, source: "builtin", fit: fit.fit });
    accepted.push({ params: fit.option.params, typology: fit.option.typology });
    emit({ type: "slot", slot, status, option: payload, usage, ...(reason ? { reason } : {}) });
  };

  await Promise.all(
    typologies.map(async (typology, slot) => {
      const usage: SlotUsage = { ...emptyUsage(), usd: 0 };
      const log: string[] = [];
      emit({ type: "slot", slot, status: "running" });
      if (!ctx) return builtin(typology, log, [], "done", usage, slot);
      let outcome: Outcome;
      try {
        outcome = await runAiSlot(ctx, slot, typology, usage, log);
      } catch (e) {
        outcome = { kind: "fallback", reason: describeError(e).message };
      }
      if (outcome.kind === "fallback" || (outcome.kind === "unfinished" && !outcome.draft)) {
        const reason = outcome.reason;
        return builtin(typology, log, [reason], "fallback", usage, slot, reason);
      }
      const draft = outcome.draft as Draft;
      // never trust cached results: regenerate from the params
      let option: MassingOption;
      try {
        option = generateOption(model, schedule, assumptions, draft.params);
      } catch (e) {
        const reason = e instanceof Error ? e.message : "The engine rejected the parameters.";
        return builtin(typology, log, [reason], "fallback", usage, slot, reason);
      }
      const label = classifyTypology(option.params);
      if (accepted.some((a) => isNearDuplicate({ params: option.params, typology: label }, a))) {
        const reason = "AI option was a near-duplicate; replaced with the built-in preset";
        return builtin(typology, log, [reason], "fallback", usage, slot, reason);
      }
      let name: string;
      let intent: string;
      const notes: string[] = [];
      let status: "done" | "incomplete" = "done";
      if (outcome.kind === "submitted") {
        name = outcome.name;
        if (outcome.ungrounded) {
          intent = templateIntent(draft.typology, option);
          notes.push("The AI's note cited numbers the engine didn't compute; replaced with a built-in note.", ...templateNotes(option));
        } else {
          intent = outcome.intent;
          if (outcome.notes.trim()) notes.push(outcome.notes.trim());
        }
      } else {
        status = "incomplete";
        name = TYPOLOGY_PRESETS[draft.typology].name;
        intent = DID_NOT_FINISH_INTENT;
        notes.push(outcome.reason);
      }
      accepted.push({ params: option.params, typology: label });
      emit({
        type: "slot",
        slot,
        status,
        option: toPayload(option, { assigned: typology, name, intent, notes, agentLog: log, source: "ai" }),
        usage,
        ...(status === "incomplete" ? { reason: outcome.kind === "unfinished" ? outcome.reason : undefined } : {}),
      });
    }),
  );

  const totals = meter.totals(Date.now() - t0);
  emit({ type: "done", totals });
  return totals;
}

