import { describe, expect, it } from "vitest";
import { exportParams, PARAMS_SCHEMA } from "../exportParams";
import { PARAM_SPECS } from "@wxy/massing";
import { buildFixture } from "./fixtures";

describe("exportParams", async () => {
  const fx = await buildFixture(2);
  const input = { envelopeId: "test-fixture-square", sample: true, options: fx.options, assumptions: fx.assumptions };
  const text = exportParams(input);
  const json = JSON.parse(text);

  it("has the schema, units and top-level key order", () => {
    expect(json.schema).toBe(PARAMS_SCHEMA);
    expect(json.units).toBe("ft");
    expect(Object.keys(json)).toEqual(["schema", "units", "envelopeId", "sample", "options", "paramSpecs"]);
    expect(json.sample).toBe(true);
  });
  it("options carry params, metrics (raw), compliance and assumptions", () => {
    expect(json.options).toHaveLength(2);
    const o = json.options[0];
    expect(Object.keys(o)).toEqual(["index", "name", "typology", "params", "assumptions", "metrics", "compliance"]);
    expect(Object.keys(o.params)).toEqual(PARAM_SPECS.map((s) => s.key));
    expect(o.metrics.gfa_sf).toBe(fx.options[0].option.metrics.gfa);
    expect(o.compliance[0]).toEqual({
      id: fx.options[0].option.compliance[0].id,
      rule: fx.options[0].option.compliance[0].rule,
      status: fx.options[0].option.compliance[0].status,
      allowed: fx.options[0].option.compliance[0].allowed,
      proposed: fx.options[0].option.compliance[0].proposed,
    });
    expect(o.assumptions.efficiency.value).toBe(fx.assumptions.efficiency.value);
  });
  it("paramSpecs mirror PARAM_SPECS", () => {
    expect(json.paramSpecs.map((s: { key: string }) => s.key)).toEqual(PARAM_SPECS.map((s) => s.key));
    expect(json.paramSpecs[0]).toHaveProperty("label");
  });
  it("is deterministic and pretty-printed", () => {
    expect(exportParams(input)).toBe(text);
    expect(text).toContain('\n  "schema"');
    expect(text.endsWith("}\n")).toBe(true);
  });
});
