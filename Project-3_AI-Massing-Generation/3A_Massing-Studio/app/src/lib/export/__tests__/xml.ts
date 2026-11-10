import { expect } from "vitest";

/** Tiny well-formedness check: balanced, properly nested tags; attribute quotes balanced; no stray '<' or '&'. */
export function assertWellFormedXml(xml: string) {
  const stack: string[] = [];
  const re = /<(\/?)([A-Za-z][\w:-]*)((?:\s+[\w:-]+="[^"<]*")*)\s*(\/?)>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let roots = 0;
  while ((m = re.exec(xml))) {
    const between = xml.slice(last, m.index);
    expect(between.includes("<"), `stray < near ${m.index}`).toBe(false);
    expect(/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(between), "bad entity").toBe(false);
    last = re.lastIndex;
    const [, close, name, , self] = m;
    if (close) {
      expect(stack.pop(), `unbalanced </${name}>`).toBe(name);
    } else if (!self) {
      if (stack.length === 0) roots++;
      stack.push(name);
    } else if (stack.length === 0) roots++;
  }
  expect(xml.slice(last).trim()).toBe("");
  expect(stack).toEqual([]);
  expect(roots).toBe(1);
}

