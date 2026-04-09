/**
 * Constellation design token — typography scale.
 *
 * font-size values in px, line-height as unitless ratio.
 * Tailwind: consumed as theme.extend.fontSize entries.
 * React Native: use fontSize / lineHeight directly.
 */

export const fontFamily = {
  sans: [
    "Inter",
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "BlinkMacSystemFont",
    "Segoe UI",
    "sans-serif",
  ],
  mono: [
    "JetBrains Mono",
    "ui-monospace",
    "SFMono-Regular",
    "Menlo",
    "monospace",
  ],
} as const;

/** [fontSize (px), lineHeight (unitless)] */
export const fontSize = {
  xs: [12, 1.5],
  sm: [14, 1.5],
  base: [16, 1.5],
  lg: [18, 1.5],
  xl: [20, 1.4],
  "2xl": [24, 1.3],
  "3xl": [30, 1.25],
  "4xl": [36, 1.2],
  "5xl": [48, 1.1],
} as const satisfies Record<string, [number, number]>;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;
