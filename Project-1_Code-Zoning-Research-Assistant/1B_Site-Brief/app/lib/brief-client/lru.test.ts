import { describe, expect, it } from "vitest";
import { Lru } from "./lru";

describe("Lru", () => {
  it("evicts the least recently used entry and counts hits/misses", () => {
    const c = new Lru<number>(2);
    c.set("a", 1); c.set("b", 2);
    expect(c.get("a")).toBe(1); // a is now most recent
    c.set("c", 3); // evicts b
    expect(c.get("b")).toBeUndefined();
    expect(c.get("c")).toBe(3);
    expect(c.hits).toBe(2);
    expect(c.misses).toBe(1);
    expect(c.size).toBe(2);
  });
  it("expires entries after the TTL", () => {
    const c = new Lru<number>(5, 100);
    c.set("a", 1, 0);
    expect(c.get("a", 50)).toBe(1);
    expect(c.get("a", 500)).toBeUndefined();
  });
});
