import { describe, it, expect } from "vitest";
import { colors } from "@constellation/theme";
import { assignPersonColor } from "./assignPersonColor";

const PALETTE = colors.person as readonly string[];

describe("assignPersonColor", () => {
  it("returns the first palette color when no colors are used", () => {
    expect(assignPersonColor([])).toBe(PALETTE[0]);
  });

  it("skips used colors and returns the next available slot", () => {
    const used = [PALETTE[0]];
    expect(assignPersonColor(used)).toBe(PALETTE[1]);
  });

  it("skips multiple consecutive used colors", () => {
    const used = [PALETTE[0], PALETTE[1], PALETTE[2]];
    expect(assignPersonColor(used)).toBe(PALETTE[3]);
  });

  it("falls back to palette[0] when all palette slots are in use", () => {
    const allUsed = [...PALETTE];
    expect(assignPersonColor(allUsed)).toBe(PALETTE[0]);
  });

  it("ignores colors not in the palette when searching for a free slot", () => {
    // Non-palette colors should not count as used palette slots
    const used = ["#ffffff", "#000000"];
    expect(assignPersonColor(used)).toBe(PALETTE[0]);
  });

  it("is stable — same input produces same output", () => {
    const used = [PALETTE[0], PALETTE[2]];
    expect(assignPersonColor(used)).toBe(assignPersonColor(used));
  });

  it("returns a different color for each of the first 12 sequential assignments", () => {
    const assigned: string[] = [];
    for (let i = 0; i < PALETTE.length; i++) {
      const color = assignPersonColor(assigned);
      expect(assigned).not.toContain(color);
      assigned.push(color);
    }
    // All 12 palette colors should have been used exactly once
    expect(assigned.sort()).toEqual([...PALETTE].sort());
  });
});
