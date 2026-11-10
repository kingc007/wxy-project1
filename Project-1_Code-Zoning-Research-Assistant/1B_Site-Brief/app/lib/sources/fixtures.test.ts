// Parses recorded responses (app/fixtures/http) for 287 CONVENT AVENUE (bbl 1020500004), offline.
import { beforeAll, describe, expect, it } from "vitest";
import { getSiteData } from "./site";
import { search } from "./geosearch";

describe("287 CONVENT AVENUE recorded fixtures", () => {
  beforeAll(() => { process.env.SOURCE_MODE = "offline"; });

  it("geocodes address to BBL", async () => {
    const r = await search("287 Convent Avenue, Manhattan");
    expect(r[0].bbl).toBe("1020500004");
  });

  it("builds SiteData", async () => {
    const s = await getSiteData("287 Convent Avenue, Manhattan");
    expect(s.errors).toEqual([]);
    expect(s.pluto?.lotArea).toBe(4675);
    expect(s.pluto?.lotType).toBe(5);
    expect(s.pluto?.zoneDist).toEqual(["R6A"]);
    expect(s.pluto?.version).toBe("26v2");
    expect(s.pluto?.provenance.lotArea.version).toBe("26v2");
    // EPSG:2263 feet, not lon/lat
    expect(s.geometry!.ring2263[0][0]).toBeGreaterThan(900000);
    expect(s.geometry!.ring4326[0][0]).toBeLessThan(-73);
    expect(s.neighbors4326.length).toBeGreaterThan(0);
    const fronts = s.edges.filter((e) => e.kind === "front");
    expect(fronts).toHaveLength(1);
    expect(fronts[0].street?.widthRaw).toBeTruthy();
    const r6a = s.districts.find((d) => d.code === "R6A");
    expect(r6a?.share).toBeGreaterThan(0.99);
    const g = r6a?.geometry4326 ?? [];
    expect(g.length).toBeGreaterThan(0);
    expect(g[0][0][0]).toBeLessThan(-73); // lon/lat for the map
  });

  it("accepts a raw BBL", async () => {
    const s = await getSiteData("1020500004");
    expect(s.geocode?.bbl).toBe("1020500004");
    expect(s.pluto?.address).toBe("287 CONVENT AVENUE");
  });
});
