import { colors } from "@constellation/theme";

const PALETTE = colors.person as readonly string[];

/**
 * Picks the first color from the person palette not already in `usedColors`.
 * Falls back to palette[0] if all slots are taken.
 * Mirrors the SQL assign_person_color() function.
 */
export function assignPersonColor(usedColors: readonly string[]): string {
  for (const color of PALETTE) {
    if (!usedColors.includes(color)) return color;
  }
  return PALETTE[0];
}
