/**
 * Constellation design token — border radius scale.
 *
 * Values in px. Tailwind: used as theme.extend.borderRadius.
 * React Native: use directly as borderRadius style values.
 */

export const borderRadius = {
  none: 0,
  sm: 2,
  DEFAULT: 4,
  md: 6,
  lg: 8,
  xl: 12,
  "2xl": 16,
  "3xl": 24,
  full: 9999,
} as const;
