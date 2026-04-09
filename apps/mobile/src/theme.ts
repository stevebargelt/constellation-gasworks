/**
 * Constellation mobile theme constants.
 *
 * Wraps shared design tokens from @constellation/theme into
 * React Native StyleSheet-compatible values (numbers for sizes,
 * hex strings for colors).
 *
 * Usage:
 *   import { theme } from "../src/theme";
 *   const styles = StyleSheet.create({ container: { padding: theme.spacing[4] } });
 */

import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from "@constellation/theme";

export const theme = {
  colors,

  /**
   * Person-color lookup by index (0-based, wraps around).
   * Assign colors to people deterministically via: personColor(index % personColors.length)
   */
  personColors: colors.person,

  fontFamily: {
    /** System sans-serif stack for React Native (first found is used) */
    sans: fontFamily.sans[0],
    mono: fontFamily.mono[0],
  },

  /**
   * Font sizes as numbers (px values).
   * lineHeight is provided as a separate map for convenience.
   */
  fontSize: Object.fromEntries(
    Object.entries(fontSize).map(([key, [size]]) => [key, size])
  ) as Record<keyof typeof fontSize, number>,

  lineHeight: Object.fromEntries(
    Object.entries(fontSize).map(([key, [size, lh]]) => [key, size * lh])
  ) as Record<keyof typeof fontSize, number>,

  fontWeight,

  /** Spacing values as numbers (px values). */
  spacing,

  /** Border radius values as numbers. */
  borderRadius,
} as const;

export { colors, spacing, borderRadius, fontWeight };
