import React, { createContext, useContext, useMemo } from "react";
import { Platform } from "react-native";

/**
 * Design tokens. One accent colour (ink blue). Status is always text plus a symbol, never colour alone.
 * Body text on white is 15:1, muted text 7.5:1, white on the accent 9:1.
 */
export const c = {
  bg: "#f3f5fa",
  card: "#ffffff",
  text: "#161c28",
  muted: "#4a5468",
  line: "#d9deea",
  accent: "#1f3fa8",
  accentSoft: "#e6ebfb",
  onAccent: "#ffffff",
  okBg: "#d8f1e2", okText: "#0b4a2a",
  waitBg: "#fff0cc", waitText: "#6b4200",
  badBg: "#fde1e1", badText: "#8a1414",
  unkBg: "#ebe4fb", unkText: "#3a2680"
};
export const radius = 16;
export const space = { xs: 6, s: 12, m: 16, l: 24 };

export const shadow = Platform.select({
  web: { boxShadow: "0 2px 10px rgba(22,28,40,0.10)" },
  default: { elevation: 3 }
}) as object;

export type TextSize = "normal" | "large" | "xlarge";
export const TEXT_SIZES: Array<{ id: TextSize; label: string; mult: number }> = [
  { id: "normal", label: "Normal", mult: 1 },
  { id: "large", label: "Large", mult: 1.2 },
  { id: "xlarge", label: "Extra large", mult: 1.4 }
];

/** Test hook: `?fontscale=2` multiplies every font size on web (on Android the system font scale already applies). */
export function testFontScale(): number {
  if (typeof window === "undefined" || !window.location?.search) return 1;
  const m = /[?&]fontscale=(\d(?:\.\d+)?)/.exec(window.location.search);
  return m ? Math.min(3, Math.max(1, Number(m[1]))) : 1;
}

interface Ctx { mult: number; size: TextSize; setSize: (s: TextSize) => void }
export const SizeContext = createContext<Ctx>({ mult: 1, size: "normal", setSize: () => {} });
export const useSize = () => useContext(SizeContext);

export const base = { body: 16, small: 14, h1: 26, h2: 20, btn: 17, chip: 14, label: 15 } as const;
export type Variant = keyof typeof base;

export function useFont(variant: Variant): number {
  const { mult } = useSize();
  return Math.round(base[variant] * mult);
}

export function useSizeValue(size: TextSize, setSize: (s: TextSize) => void) {
  const fs = testFontScale();
  const mult = (TEXT_SIZES.find((t) => t.id === size)?.mult ?? 1) * fs;
  return useMemo(() => ({ mult, size, setSize }), [mult, size, setSize]);
}
