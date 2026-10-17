import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  DomainError, Engine, MAIN, generateContentKey, openState, sealState, syntheticExample,
  type AppState, type ReceivingInput, type SecureKeyStore, type SpecInput
} from "@ingredientalert/core";
import { expoKeyStore } from "./keystore";
import { storage } from "./storage";
import type { TextSize } from "./theme";

const ACCOUNT = "local-demo-account";
const KEY = "content";
const STATE_FILE = "ia-state";
const SETTINGS_FILE = "ia-settings";

export interface Settings { textSize: TextSize; printerFails: boolean }
const DEFAULT_SETTINGS: Settings = { textSize: "normal", printerFails: true };

export type Screen = "home" | "receive" | "review" | "publish" | "service" | "settings" | "about" | "demo";
export interface Prefill { receive?: ReceivingInput; spec?: SpecInput; specProduct?: { name: string; supplier: string } }

interface Store {
  ready: boolean;
  loadError: string | null;
  engine: Engine | null;
  state: AppState | null;
  site: string;
  personaId: string;
  setPersona: (id: string) => void;
  screen: Screen;
  go: (s: Screen) => void;
  settings: Settings;
  setSettings: (s: Partial<Settings>) => void;
  startExample: () => Promise<void>;
  eraseAll: () => Promise<void>;
  prefill: Prefill;
  setPrefill: (p: Prefill) => void;
  /** Run an engine command; returns an error message instead of throwing. */
  run: <T>(fn: (e: Engine) => T) => { ok: true; value: T } | { ok: false; error: string; code: string; detail?: unknown };
  keys: SecureKeyStore;
}
const Ctx = createContext<Store | null>(null);
export const useStore = () => useContext(Ctx)!;

async function contentKey(keys: SecureKeyStore, create: boolean): Promise<Uint8Array | null> {
  const k = await keys.get(KEY);
  if (k || !create) return k;
  const fresh = generateContentKey();
  await keys.set(KEY, fresh);
  return fresh;
}

export function StoreProvider({ children, onSettings }: { children: ReactNode; onSettings: (s: Settings) => void }) {
  const keys = expoKeyStore;
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [personaId, setPersona] = useState("alex");
  const [screen, setScreen] = useState<Screen>("home");
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [prefill, setPrefill] = useState<Prefill>({});
  const engineRef = useRef<Engine | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const writeChain = useRef<Promise<void>>(Promise.resolve());

  const attach = useCallback((s: AppState) => {
    const e = new Engine(s);
    e.adapter = (ch) => (ch === "printed_menu" && settingsRef.current.printerFails ? { ok: false, error: "Printer did not respond (simulated)" } : { ok: true });
    e.onCommit = (next) => {
      setState(next);
      writeChain.current = writeChain.current
        .then(async () => {
          const k = await contentKey(keys, true);
          await storage.set(STATE_FILE, JSON.stringify(sealState(k!, next, ACCOUNT)));
        })
        .catch(() => setLoadError("Could not save to this device. Your last change may be lost."));
    };
    engineRef.current = e;
    setState(e.state);
  }, [keys]);

  useEffect(() => {
    (async () => {
      try {
        const rawSettings = await storage.get(SETTINGS_FILE);
        if (rawSettings) {
          const parsed = { ...DEFAULT_SETTINGS, ...(JSON.parse(rawSettings) as Partial<Settings>) };
          setSettingsState(parsed);
          onSettings(parsed);
        }
        const raw = await storage.get(STATE_FILE);
        if (raw) {
          const k = await contentKey(keys, false);
          if (!k) throw new Error("key missing");
          attach(openState(k, JSON.parse(raw), ACCOUNT));
        }
      } catch {
        setLoadError("Your saved kitchen data could not be opened on this device. The key may be missing. It stays locked; nothing was shown.");
      }
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setSettings = useCallback((p: Partial<Settings>) => {
    const next = { ...settingsRef.current, ...p };
    setSettingsState(next);
    onSettings(next);
    storage.set(SETTINGS_FILE, JSON.stringify(next)).catch(() => {});
  }, [onSettings]);

  const startExample = useCallback(async () => {
    attach(syntheticExample());
    // persist immediately through the same path
    const e = engineRef.current!;
    e.advanceClock(0);
    setLoadError(null);
  }, [attach]);

  const eraseAll = useCallback(async () => {
    await storage.delete(STATE_FILE);
    await keys.delete(KEY);
    engineRef.current = null;
    setState(null);
    setScreen("home");
    setPersona("alex");
  }, [keys]);

  const run = useCallback(<T,>(fn: (e: Engine) => T) => {
    try {
      return { ok: true as const, value: fn(engineRef.current!) };
    } catch (err) {
      if (err instanceof DomainError) return { ok: false as const, error: err.message, code: err.code, detail: err.detail };
      return { ok: false as const, error: err instanceof Error ? err.message : "Something went wrong.", code: "error" };
    }
  }, []);

  const value = useMemo<Store>(
    () => ({
      ready, loadError, engine: engineRef.current, state, site: MAIN, personaId, setPersona, screen, go: setScreen, settings, setSettings,
      startExample, eraseAll, prefill, setPrefill, run, keys
    }),
    [ready, loadError, state, personaId, screen, settings, setSettings, startExample, eraseAll, prefill, run, keys]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
