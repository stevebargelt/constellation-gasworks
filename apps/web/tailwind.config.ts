import type { Config } from "tailwindcss";
import {
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  spacing,
  borderRadius,
} from "@constellation/theme";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: colors.primary,
        secondary: colors.secondary,
        neutral: colors.neutral,
        error: colors.error,
        warning: colors.warning,
        success: colors.success,
      },
      fontFamily: {
        sans: fontFamily.sans,
        mono: fontFamily.mono,
      },
      fontSize: Object.fromEntries(
        Object.entries(fontSize).map(([key, [size, lineHeight]]) => [
          key,
          [`${size}px`, { lineHeight: String(lineHeight) }],
        ])
      ),
      fontWeight,
      spacing: Object.fromEntries(
        Object.entries(spacing).map(([key, value]) => [key, `${value}px`])
      ),
      borderRadius: Object.fromEntries(
        Object.entries(borderRadius).map(([key, value]) => [
          key,
          value === 9999 ? "9999px" : `${value}px`,
        ])
      ),
    },
  },
  plugins: [],
} satisfies Config;
