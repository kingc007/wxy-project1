import { describe, expect, it } from "vitest";
import { getSection } from "./corpus";
import { locateQuote } from "./locate";
import { districtColumn, getPermittedUses } from "./uses";

describe("districtColumn", () => {
  it.each([
    ["R6A", "R6"], ["R10H", "R10"], ["R1-2", "R1"], ["C1-4", "C1"], ["C4-4A", "C4"], ["C6-2A", "C6"], ["M1-1", "M1"],
  ])("%s -> %s", (d, c) => expect(districtColumn(d)?.column).toBe(c));
  it("returns null for non-table districts", () => expect(districtColumn("PARK")).toBeNull());
});

describe("getPermittedUses", () => {
  const r6 = getPermittedUses("R6A", []);
  it("R6 UG II is as-of-right in every row (verified row 7)", () => {
    const ug2 = r6.find((g) => g.useGroup === "II")!;
    expect(ug2.column).toBe("R6");
    expect(ug2.status).toBe("as_of_right");
    expect(ug2.counts.asOfRight).toBeGreaterThan(0);
    expect(ug2.counts.notPermitted + ug2.counts.specialPermit + ug2.counts.limited).toBe(0);
    expect(ug2.title).toBe("Residences");
    expect(ug2.citation.section).toBe("22-12");
    expect(ug2.counts.asOfRight).toBe(5); // the five rows of the 22-121 table
    expect(ug2.examples).toHaveLength(3);
    expect(ug2.examples[0].citation.quote).toBe("Single-family residence ; Detached ; ● ; ● ; ● ; ● ; ● ; ● ; ● ; ● ; ● ; ● ; ● ; ●");
    // R1 column keeps the "P" suffix (second-level symbol) in the example symbol
    expect(getPermittedUses("R1").find((g) => g.useGroup === "II")!.examples.some((e) => e.symbol === "● P")).toBe(true);
  });
  it("residence chapter has no UG VI / IX / X section -> unknown with note, cites 22-10", () => {
    const ug6 = r6.find((g) => g.useGroup === "VI")!;
    expect(ug6.status).toBe("unknown");
    expect(ug6.citation.section).toBe("22-10");
    expect(ug6.note).toBe("No Use Group VI section in Article II Chapter 2");
    expect(ug6.title).toBe("Retail and Services");
  });
  it("UG V/VII/VIII in residence districts: special permit from the section's own prose", () => {
    for (const [n, sec] of [["V", "22-15"], ["VII", "22-17"], ["VIII", "22-18"]]) {
      const g = r6.find((x) => x.useGroup === n)!;
      expect(g.status).toBe("special_permit");
      expect(g.note).toBe("Special permit only (prose section; no use table)");
      expect(g.citation.section).toBe(sec);
      expect(g.citation.quote).toMatch(/special permit/);
      expect(g.examples).toEqual([]);
      expect(locateQuote(getSection(sec)!, g.citation.quote).found).toBe(true);
    }
    expect(r6.find((x) => x.useGroup === "V")!.citation.quote).toContain("overnight camps");
  });
  it("M1 UG II (prose only, not a residence column) stays unknown", () => {
    expect(getPermittedUses("M1-1").find((g) => g.useGroup === "II")!.status).toBe("unknown");
  });
  it("C2 overlay: UG VII offices are as-of-right (verified row 15)", () => {
    const all = getPermittedUses("R6A", ["C2-4"]);
    const ug7 = all.find((g) => g.column === "C2" && g.useGroup === "VII")!;
    expect(ug7.examples.some((e) => /^Offices, business/.test(e.use) && e.symbol === "●")).toBe(true);
    expect(ug7.counts.asOfRight).toBeGreaterThanOrEqual(2);
    expect(ug7.citation.section).toBe("32-17");
  });
  it("C1 differs from C2 on automobile dealers (row 16) so UG VI is mixed", () => {
    const ug6 = getPermittedUses("C1-4").find((g) => g.useGroup === "VI")!;
    expect(ug6.column).toBe("C1");
    expect(ug6.status).toBe("mixed");
  });
  it("M1 and C4 columns resolve", () => {
    expect(getPermittedUses("M1-1").some((g) => g.column === "M1" && g.useGroup === "VII" && g.status === "as_of_right")).toBe(true);
    expect(getPermittedUses("C4-4A").every((g) => g.column === "C4")).toBe(true);
  });
  it("duplicate overlay columns collapse; unknown districts yield nothing", () => {
    expect(getPermittedUses("R6", ["C1-4", "C1-5"]).filter((g) => g.column === "C1" && g.useGroup === "I")).toHaveLength(1);
    expect(getPermittedUses("PARK")).toEqual([]);
  });
  it("every example and group citation quote is locatable in its own section", () => {
    for (const g of [...r6, ...getPermittedUses("R6A", ["C2-4"]), ...getPermittedUses("M1-1")]) {
      for (const c of [g.citation, ...g.examples.map((e) => e.citation)]) {
        const sec = getSection(c.section)!;
        expect(locateQuote(sec, c.quote).found, `${c.section}: ${c.quote}`).toBe(true);
        expect(c.url).toBe(sec.url);
        expect(c.lastAmended).toBe(sec.lastAmended);
      }
    }
  });
});
