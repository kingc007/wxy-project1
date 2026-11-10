// Strategy-agent tools: strict JSON schemas (from zod via toToolInputSchema) in a FIXED order, so the tools array is
// byte-stable and cacheable. Inputs are validated again with the same zod schemas before use.
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { PartialParamsSchema, TypologySchema, toToolInputSchema } from "@wxy/massing";

export const ListTypologiesInput = z.object({}).strict();
export const GenerateMassingInput = z.object({ typology: TypologySchema, params: PartialParamsSchema }).strict();
export const CheckComplianceInput = z.object({ optionDraftId: z.string().min(1) }).strict();
export const SubmitOptionInput = z
  .object({
    optionDraftId: z.string().min(1),
    name: z.string().min(1).max(40),
    intent: z.string().min(1).max(160),
    notes: z.string().max(300),
  })
  .strict();

export const TOOL_NAMES = ["listTypologies", "generateMassing", "checkCompliance", "submitOption"] as const;
export type ToolName = (typeof TOOL_NAMES)[number];

export const STRATEGY_TOOLS: Anthropic.Tool[] = [
  {
    name: "listTypologies",
    description: "List the six typologies with idea, preset parameters, when each works and its risk.",
    strict: true,
    input_schema: toToolInputSchema(ListTypologiesInput) as Anthropic.Tool.InputSchema,
  },
  {
    name: "generateMassing",
    description:
      "Run the geometry engine. Starts from the named typology's preset and applies params on top. Returns an optionDraftId, rounded metrics, zoning status, failing rules, program fit and trims.",
    strict: true,
    input_schema: toToolInputSchema(GenerateMassingInput) as Anthropic.Tool.InputSchema,
  },
  {
    name: "checkCompliance",
    description: "Return every zoning row (rule, allowed, proposed, status) for a draft from generateMassing.",
    strict: true,
    input_schema: toToolInputSchema(CheckComplianceInput) as Anthropic.Tool.InputSchema,
  },
  {
    name: "submitOption",
    description: "Submit one draft as your final option with a name, intent and notes. Ends your work. Pass an empty string for notes if none.",
    strict: true,
    input_schema: toToolInputSchema(SubmitOptionInput) as Anthropic.Tool.InputSchema,
  },
];
