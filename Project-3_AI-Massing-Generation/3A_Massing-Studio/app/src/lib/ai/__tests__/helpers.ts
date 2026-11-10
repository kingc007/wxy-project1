import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_ASSUMPTIONS, buildEnvelopeModel, initGeometry } from "@wxy/massing";
import type { Assumptions, ProgramSchedule } from "@wxy/massing";
import type { AiClient } from "../client";

export const SAMPLES_DIR = path.join(process.cwd(), "node_modules/@wxy/massing/data/samples");
export const loadSample = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(SAMPLES_DIR, file), "utf8"));
export const sampleA = () => loadSample("sample-a-r7a-interior.json");

export async function modelA() {
  await initGeometry();
  return buildEnvelopeModel(sampleA());
}

export const A: Assumptions = DEFAULT_ASSUMPTIONS;
export const scheduleOf = (over: Partial<ProgramSchedule> = {}): ProgramSchedule => ({
  uses: [{ use: "residential", targetGfa: null, targetUnits: 120, floors: null, placement: "any", source: "brief", accepted: true }],
  groundFloorUse: "residential",
  openSpaceTargetPct: null,
  publicCourtyard: false,
  moves: [],
  confirmed: true,
  ...over,
});

// ---------- scripted fake client ----------
export type Block = Anthropic.ContentBlock;
let idc = 0;
export const toolUse = (name: string, input: unknown): Block => ({ type: "tool_use", id: `tu_${++idc}`, name, input, caller: { type: "direct" } }) as unknown as Block;
export const text = (t: string): Block => ({ type: "text", text: t, citations: null }) as unknown as Block;

export function message(content: Block[], stop_reason: Anthropic.StopReason = "tool_use", usage: Partial<Anthropic.Usage> = {}): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content,
    stop_reason,
    stop_details: null,
    stop_sequence: null,
    usage: { input_tokens: 1000, output_tokens: 200, cache_creation_input_tokens: 0, cache_read_input_tokens: 0, ...usage },
  } as unknown as Anthropic.Message;
}

export type Script = (req: Anthropic.Messages.MessageCreateParamsNonStreaming, callIndex: number) => Anthropic.Message | Error;

export function fakeClient(script: Script) {
  const calls: Anthropic.Messages.MessageCreateParamsNonStreaming[] = [];
  const client: AiClient = {
    messages: {
      create: async (req) => {
        calls.push(JSON.parse(JSON.stringify(req)));
        const r = script(req, calls.length - 1);
        if (r instanceof Error) throw r;
        return r;
      },
      parse: async (req) => {
        calls.push(JSON.parse(JSON.stringify(req)));
        const r = script(req, calls.length - 1);
        if (r instanceof Error) throw r;
        return r as Anthropic.Message & { parsed_output: unknown };
      },
    },
  };
  return { client, calls };
}

/** Last tool_result ids of the latest user message, so a script can read what the loop answered. */
export function lastToolResults(req: Anthropic.Messages.MessageCreateParamsNonStreaming): { content: string; is_error: boolean }[] {
  const last = req.messages[req.messages.length - 1];
  if (typeof last.content === "string") return [];
  return (last.content as Anthropic.ContentBlockParam[])
    .filter((b): b is Anthropic.ToolResultBlockParam => b.type === "tool_result")
    .map((b) => ({ content: String(b.content), is_error: Boolean(b.is_error) }));
}
