import { describe, expect, it } from "vitest";
import { contrast, dark, light, requiredPairs, type, TOUCH } from "./tokens";

describe("design tokens", () => {
  for (const [name, pal] of [["light", light], ["dark", dark]] as const) {
    it(`${name} theme meets the contrast targets for every text/background pair it uses`, () => {
      const failures = requiredPairs(pal).filter((p) => contrast(p.fg, p.bg) < p.min).map((p) => `${p.name}: ${contrast(p.fg, p.bg).toFixed(2)} < ${p.min}`);
      expect(failures).toEqual([]);
    });
  }
  it("contrast function matches known values", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#FFFFFF")).toBeCloseTo(4.48, 1);
  });
  it("body text is 16 sp with generous line height and nothing is under 14 sp", () => {
    expect(type.body.size).toBe(16);
    expect(type.body.line / type.body.size).toBeGreaterThanOrEqual(1.5);
    for (const t of Object.values(type)) expect(t.size).toBeGreaterThanOrEqual(14);
  });
  it("touch target is 48 dp", () => { expect(TOUCH).toBe(48); });
});
