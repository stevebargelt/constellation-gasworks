/**
 * Constellation design token — color palette.
 *
 * All colors are defined here as a single source of truth.
 * Web: consumed via tailwind.config.ts
 * Mobile: consumed via apps/mobile/src/theme.ts
 */

export const colors = {
  // --- Primary (indigo) ---
  primary: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
    950: "#1e1b4b",
  },

  // --- Secondary (violet) ---
  secondary: {
    50: "#f5f3ff",
    100: "#ede9fe",
    200: "#ddd6fe",
    300: "#c4b5fd",
    400: "#a78bfa",
    500: "#8b5cf6",
    600: "#7c3aed",
    700: "#6d28d9",
    800: "#5b21b6",
    900: "#4c1d95",
    950: "#2e1065",
  },

  // --- Neutral (slate) ---
  neutral: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
    950: "#020617",
  },

  // --- Semantic ---
  error: {
    light: "#fca5a5",
    DEFAULT: "#ef4444",
    dark: "#b91c1c",
  },
  warning: {
    light: "#fcd34d",
    DEFAULT: "#f59e0b",
    dark: "#b45309",
  },
  success: {
    light: "#86efac",
    DEFAULT: "#22c55e",
    dark: "#15803d",
  },

  // --- Person palette (8–12 distinct colors for per-person color assignment) ---
  // Used in constellation graph nodes and calendar overlays.
  // Each entry is the base hex; tints/shades can be derived as needed.
  person: [
    "#6366f1", // indigo-500
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
    "#f97316", // orange-500
    "#eab308", // yellow-500
    "#22c55e", // green-500
    "#06b6d4", // cyan-500
    "#3b82f6", // blue-500
    "#f43f5e", // rose-500
    "#84cc16", // lime-500
    "#14b8a6", // teal-500
    "#a855f7", // purple-500
  ],
} as const;

export type ColorScale = typeof colors.primary;
export type PersonColors = typeof colors.person;
