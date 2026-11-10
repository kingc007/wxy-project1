// Event sequence for POST /api/narrative: meta, text*, citation*, sentences, crosscheck, usage*, done.
import type { SiteData } from "@/lib/types";
import type { ZoningBrief } from "@/lib/zoning/model";
import { runRuleAgent, type AgentDeps, type AgentResult } from "./agent";
import { getClient, type LlmClient } from "./client";
import { compareSelections } from "./crosscheck";
import { streamNarrative } from "./narrative";

export interface SseEvent { event: string; data: unknown }
export interface OrchestrateDeps { client?: LlmClient | null; agent?: AgentDeps }

export async function* narrativeEvents(site: SiteData, brief: ZoningBrief, deps: OrchestrateDeps = {}): AsyncGenerator<SseEvent> {
  const client = deps.client === undefined ? getClient() : deps.client;
  if (!client) {
    yield { event: "meta", data: { llm: false } };
    yield { event: "done", data: {} };
    return;
  }
  yield { event: "meta", data: { llm: true } };
  // Agent runs concurrently with the narrative stream.
  let agentFailure: string | null = null;
  const agentP: Promise<AgentResult | null> = runRuleAgent(site, brief, { ...deps.agent, client }).catch((e) => {
    agentFailure = e instanceof Error ? e.message.slice(0, 200) : "agent failed";
    return null;
  });

  for await (const ev of streamNarrative(brief, site, { client })) {
    if (ev.type === "text") yield { event: "text", data: { delta: ev.delta } };
    else if (ev.type === "usage") yield { event: "usage", data: { kind: "narrative", ...ev, type: undefined } };
    else {
      const { type, ...rest } = ev;
      yield { event: type, data: rest };
    }
  }

  const agent = await agentP;
  if (agent) {
    const x = compareSelections(agent.selections, brief);
    yield {
      event: "crosscheck",
      data: {
        model: agent.model, escalated: agent.escalated, comparisons: x.comparisons, flags: [...x.flags, ...agent.flags.map((f) => ({ kind: f.kind, message: `Model flag: ${f.message}` }))],
        conflictingFields: x.disagreements, ...(x.disagreements.length ? { controls: x.controls } : {}), selections: agent.selections,
      },
    };
    yield { event: "usage", data: { kind: "agent", model: agent.model, ...agent.usage, cost: agent.cost, passes: agent.passes.map((p) => ({ model: p.model, cost: p.cost })) } };
  } else {
    yield { event: "crosscheck", data: { error: agentFailure ?? "agent unavailable" } };
  }
  yield { event: "done", data: {} };
}
