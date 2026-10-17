// Back-compat shim: the real tokens live in ./design/tokens.ts and colours come from useTheme().
export { space, radius, TOUCH } from "./design/tokens";
export type TextSize = "normal" | "large" | "xlarge";
/** In-app text size multiplies on top of the Android system font scale (which is never disabled). Default 1. */
export const TEXT_FACTOR: Record<TextSize, number> = { normal: 1, large: 1.15, xlarge: 1.3 };
export const TEXT_SIZES: Array<{ id: TextSize; label: string }> = [
  { id: "normal", label: "Normal" }, { id: "large", label: "Large" }, { id: "xlarge", label: "Extra large" }
];
