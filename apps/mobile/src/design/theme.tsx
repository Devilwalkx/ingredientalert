import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AccessibilityInfo, Appearance, Platform, useColorScheme } from "react-native";
import { dark, light, type Palette } from "./tokens";

export type ThemePref = "system" | "light" | "dark";
interface ThemeValue { c: Palette; mode: "light" | "dark"; pref: ThemePref; setPref(p: ThemePref): void; reduceMotion: boolean }
const Ctx = createContext<ThemeValue>({ c: light, mode: "light", pref: "system", setPref: () => undefined, reduceMotion: false });

/** `?theme=dark` forces a theme for automated tests on web. */
function queryTheme(): "light" | "dark" | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  const m = /[?&]theme=(light|dark)/.exec(window.location?.search ?? "");
  return (m?.[1] as "light" | "dark" | undefined) ?? null;
}
function queryMotion(): boolean | null {
  if (Platform.OS !== "web" || typeof window === "undefined") return null;
  return /[?&]reducemotion=1/.test(window.location?.search ?? "") ? true : null;
}

export function ThemeProvider({ pref, setPref, children }: { pref: ThemePref; setPref(p: ThemePref): void; children: React.ReactNode }) {
  const system = useColorScheme();
  const forced = useMemo(queryTheme, []);
  const [reduce, setReduce] = useState(queryMotion() ?? false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (alive && queryMotion() === null) setReduce(!!v); }).catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v) => { if (queryMotion() === null) setReduce(!!v); });
    return () => { alive = false; sub.remove(); };
  }, []);
  const mode: "light" | "dark" = forced ?? (pref === "system" ? (system === "dark" ? "dark" : "light") : pref);
  const value = useMemo<ThemeValue>(() => ({ c: mode === "dark" ? dark : light, mode, pref, setPref, reduceMotion: reduce }), [mode, pref, setPref, reduce]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useTheme(): Palette { return useContext(Ctx).c; }
export function useThemeMode() { return useContext(Ctx); }
export function useReducedMotion(): boolean { return useContext(Ctx).reduceMotion; }
void Appearance;
