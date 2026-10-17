/**
 * Design tokens. Pure data (no React Native imports) so contrast can be unit-tested.
 * Identity (IngredientAlert): herb green on a cool kitchen-paper background, with a violet reserved for UNKNOWN. Status is never colour alone: every status also carries an icon and words.
 * 
 */
export interface Palette {
  bg: string; surface: string; surfaceAlt: string; line: string;
  text: string; textMuted: string;
  primary: string; onPrimary: string; primaryContainer: string; onPrimaryContainer: string;
  okBg: string; okText: string; okIcon: string;
  warnBg: string; warnText: string; warnIcon: string;
  badBg: string; badText: string; badIcon: string;
  dangerSolid: string; onDangerSolid: string;
  infoBg: string; infoText: string;
  unkBg: string; unkText: string; unkIcon: string;
  scrim: string; inputBorder: string; placeholder: string;
}

export const light: Palette = {
  bg: "#F4F7F2", surface: "#FFFFFF", surfaceAlt: "#E8EFE9", line: "#BCC7BE",
  text: "#121A16", textMuted: "#3D4841",
  primary: "#1B5E43", onPrimary: "#FFFFFF", primaryContainer: "#D5EBDF", onPrimaryContainer: "#0C3523",
  okBg: "#DDF2E3", okText: "#0B3B19", okIcon: "#146C2E",
  warnBg: "#FCEFC7", warnText: "#4A3500", warnIcon: "#7A4E00",
  badBg: "#FBE1E1", badText: "#5C1010", badIcon: "#A12020",
  dangerSolid: "#8E1B1B", onDangerSolid: "#FFFFFF",
  infoBg: "#E2ECF5", infoText: "#17344F",
  unkBg: "#ECE5FA", unkText: "#2F1B63", unkIcon: "#5B3FB5",
  scrim: "rgba(10,14,12,0.55)", inputBorder: "#667068", placeholder: "#505A53"
};

export const dark: Palette = {
  bg: "#0E1511", surface: "#171F1A", surfaceAlt: "#212B25", line: "#35433A",
  text: "#ECF2EE", textMuted: "#B4C0B8",
  primary: "#8FD3B0", onPrimary: "#08261A", primaryContainer: "#244034", onPrimaryContainer: "#D2EEDF",
  okBg: "#17331F", okText: "#C4EDCF", okIcon: "#7FD99A",
  warnBg: "#3A2E0B", warnText: "#F6DE9A", warnIcon: "#F0C45A",
  badBg: "#431919", badText: "#F7C9C9", badIcon: "#F59A9A",
  dangerSolid: "#F2A0A0", onDangerSolid: "#3A0A0A",
  infoBg: "#1B2B3A", infoText: "#C9DDF0",
  unkBg: "#2B2347", unkText: "#E0D7F8", unkIcon: "#B8A5F0",
  scrim: "rgba(0,0,0,0.65)", inputBorder: "#8A988E", placeholder: "#A0ADA4"
};

/** 4-pt base scale. */
export const space = { xxs: 4, xs: 8, s: 12, m: 16, l: 24, xl: 32 } as const;
export const radius = { s: 10, m: 14, l: 20, pill: 999 } as const;
/** Minimum touch target (dp). */
export const TOUCH = 48;

export type Variant = "display" | "title" | "heading" | "body" | "small" | "label";
/** sp sizes. Body is 16sp with 1.5 line height; nothing is smaller than 14sp. */
export const type: Record<Variant, { size: number; line: number; weight: "400" | "600" | "700" }> = {
  display: { size: 30, line: 38, weight: "700" },
  title: { size: 24, line: 31, weight: "700" },
  heading: { size: 19, line: 26, weight: "700" },
  body: { size: 16, line: 24, weight: "400" },
  small: { size: 14, line: 20, weight: "400" },
  label: { size: 14, line: 20, weight: "600" }
};

// ---- WCAG contrast (used by the unit test)
function lin(c: number) { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); }
export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r!) + 0.7152 * lin(g!) + 0.0722 * lin(b!);
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
}
/** Foreground/background pairs that must be at least `min`:1. */
export function requiredPairs(p: Palette): Array<{ name: string; fg: string; bg: string; min: number }> {
  return [
    { name: "text on bg", fg: p.text, bg: p.bg, min: 7 },
    { name: "text on surface", fg: p.text, bg: p.surface, min: 7 },
    { name: "muted on bg", fg: p.textMuted, bg: p.bg, min: 4.5 },
    { name: "muted on surface", fg: p.textMuted, bg: p.surface, min: 4.5 },
    { name: "muted on surfaceAlt", fg: p.textMuted, bg: p.surfaceAlt, min: 4.5 },
    { name: "onPrimary on primary", fg: p.onPrimary, bg: p.primary, min: 4.5 },
    { name: "primary text on bg", fg: p.primary, bg: p.bg, min: 4.5 },
    { name: "primary text on surface", fg: p.primary, bg: p.surface, min: 4.5 },
    { name: "onContainer on container", fg: p.onPrimaryContainer, bg: p.primaryContainer, min: 4.5 },
    { name: "ok text", fg: p.okText, bg: p.okBg, min: 7 },
    { name: "warn text", fg: p.warnText, bg: p.warnBg, min: 7 },
    { name: "bad text", fg: p.badText, bg: p.badBg, min: 7 },
    { name: "info text", fg: p.infoText, bg: p.infoBg, min: 7 },
    { name: "unknown text", fg: p.unkText, bg: p.unkBg, min: 7 },
    { name: "unknown icon on unknown bg", fg: p.unkIcon, bg: p.unkBg, min: 3 },
    { name: "ok icon on ok bg", fg: p.okIcon, bg: p.okBg, min: 3 },
    { name: "warn icon on warn bg", fg: p.warnIcon, bg: p.warnBg, min: 3 },
    { name: "bad icon on bad bg", fg: p.badIcon, bg: p.badBg, min: 3 },
    { name: "danger button text", fg: p.onDangerSolid, bg: p.dangerSolid, min: 4.5 },
    { name: "input border on surface", fg: p.inputBorder, bg: p.surface, min: 3 },
    { name: "placeholder on surface", fg: p.placeholder, bg: p.surface, min: 4.5 },
    { name: "line on bg (non-text)", fg: p.line, bg: p.bg, min: 1.2 }
  ];
}
