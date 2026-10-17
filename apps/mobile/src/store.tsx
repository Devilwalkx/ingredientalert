import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState as RNAppState } from "react-native";
import {
  DomainError, Engine, checkPin, generateContentKey, lockoutMs, makePinRecord, openItem, openState, ownKitchenState, sealItem, sealState, syntheticExample,
  validatePin, type AppState, type ReceivingInput, type SecureKeyStore, type SealedItem, type SpecInput, type Staff
} from "@ingredientalert/core";
import { expoKeyStore } from "./keystore";
import { storage } from "./storage";
import type { TextSize } from "./theme";
import type { ThemePref } from "./design/theme";

const ACCOUNT = "local-demo-account";
const KEY = "content";
const STATE_FILE = "ia-state";
const SETTINGS_FILE = "ia-settings";
const DRAFT_FILE = "ia-drafts";

export interface Settings { textSize: TextSize; theme: ThemePref; printerFails: boolean; autoLockMin: number; failures: Record<string, { n: number; until: number }> }
const DEFAULT_SETTINGS: Settings = { textSize: "normal", theme: "system", printerFails: true, autoLockMin: 2, failures: {} };

export type Screen = "home" | "receive" | "review" | "publish" | "service" | "settings" | "setup";
export interface Prefill { receive?: ReceivingInput; spec?: SpecInput; specProduct?: { name: string; supplier: string } }
export interface Toast { text: string; tone: "ok" | "bad" | "info" }
type Run<T> = { ok: true; value: T } | { ok: false; error: string; code: string; detail?: unknown };
export type SignIn = { ok: true } | { ok: false; error: string; waitMs?: number };

interface Ctx {
  loaded: boolean;
  loadError: string | null;
  engine: Engine | null;
  state: AppState | null;
  siteId: string;
  /** True only for the made-up demonstration kitchen. Its people have no PINs; this is shown on every screen. */
  isDemo: boolean;
  actorId: string | null;
  actor: Staff | null;
  locked: boolean;
  lock(): void;
  signIn(staffId: string, pin: string): Promise<SignIn>;
  /** First sign-in of a real person who has no PIN yet: they choose their own. */
  needsPin(staffId: string): boolean;
  choosePin(staffId: string, pin: string): Promise<SignIn>;
  /** Re-ask for the PIN before a consequential action (real kitchens only; the demonstration kitchen has none). */
  stepUpRequired: boolean;
  confirmPin(pin: string): SignIn;
  touch(): void;
  screen: Screen;
  go(s: Screen, param?: string): void;
  takeParam(): string | null;
  navNonce: number;
  back(): boolean;
  registerBack(fn: (() => boolean) | null): void;
  settings: Settings;
  setSettings(p: Partial<Settings>): void;
  toast: Toast | null;
  say(text: string, tone?: Toast["tone"]): void;
  dismissToast(): void;
  startExample(): Promise<void>;
  createKitchen(i: { kitchenName: string; siteName: string; ownerName: string; pin: string }): Promise<SignIn>;
  eraseAll(): Promise<void>;
  prefill: Prefill;
  setPrefill(p: Prefill): void;
  run<T>(fn: (e: Engine, actorId: string) => T): Run<T>;
  keys: SecureKeyStore;
  draft(key: string): string;
  setDraft(key: string, value: string): void;
  clearDrafts(prefix: string): void;
}
const C = createContext<Ctx | null>(null);
export function useApp(): Ctx {
  const v = useContext(C);
  if (!v) throw new Error("outside provider");
  return v;
}
/** Old name used by screens. */
export const useStore = useApp;

async function contentKey(keys: SecureKeyStore, create: boolean): Promise<Uint8Array | null> {
  const k = await keys.get(KEY);
  if (k || !create) return k;
  const fresh = generateContentKey();
  await keys.set(KEY, fresh);
  return fresh;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const keys = expoKeyStore;
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, setState] = useState<AppState | null>(null);
  const [actorId, setActorId] = useState<string | null>(null);
  const [locked, setLocked] = useState(true);
  const [screen, setScreen] = useState<Screen>("home");
  const [nonce, setNonce] = useState(0);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [prefill, setPrefill] = useState<Prefill>({});
  const [toast, setToast] = useState<Toast | null>(null);
  const [, bump] = useState(0);
  const engineRef = useRef<Engine | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const writeChain = useRef<Promise<void>>(Promise.resolve());
  const drafts = useRef<Record<string, string>>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subBack = useRef<(() => boolean) | null>(null);
  const param = useRef<string | null>(null);
  const lastTouch = useRef(Date.now());
  const leftAt = useRef<number | null>(null);
  const actorRef = useRef<string | null>(null);
  actorRef.current = actorId;

  const say = useCallback((text: string, tone: Toast["tone"] = "info") => setToast({ text, tone }), []);

  const saveSettings = useCallback((next: Settings) => {
    setSettingsState(next);
    settingsRef.current = next;
    storage.set(SETTINGS_FILE, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const flushDrafts = useCallback(() => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    (async () => {
      const present = Object.keys(drafts.current).filter((k) => drafts.current[k]);
      if (present.length === 0) { await storage.delete(DRAFT_FILE); return; }
      const k = await contentKey(keys, true);
      const sealed = sealItem(k!, JSON.stringify(drafts.current), { accountId: ACCOUNT, itemId: "drafts", version: 1 });
      await storage.set(DRAFT_FILE, JSON.stringify(sealed));
    })().catch(() => undefined);
  }, [keys]);

  const attach = useCallback((s: AppState) => {
    const e = new Engine(s);
    e.adapter = (ch) => (ch === "printed_menu" && settingsRef.current.printerFails && engineRef.current?.state.synthetic
      ? { ok: false, error: "Printer did not respond (simulated)" } : { ok: true });
    e.onCommit = (next) => {
      setState(next);
      writeChain.current = writeChain.current
        .then(async () => {
          const k = await contentKey(keys, true);
          await storage.set(STATE_FILE, JSON.stringify(sealState(k!, next, ACCOUNT)));
        })
        .catch(() => say("Could not save to this device. Your last change may be lost.", "bad"));
    };
    engineRef.current = e;
    setState(e.state);
  }, [keys, say]);

  useEffect(() => {
    (async () => {
      try {
        const rawSettings = await storage.get(SETTINGS_FILE);
        if (rawSettings) setSettingsState({ ...DEFAULT_SETTINGS, ...(JSON.parse(rawSettings) as Partial<Settings>) });
      } catch { /* settings are conveniences; defaults apply */ }
      try {
        const raw = await storage.get(STATE_FILE);
        if (raw) {
          const k = await contentKey(keys, false);
          if (!k) throw new Error("key missing");
          attach(openState(k, JSON.parse(raw), ACCOUNT));
          try {
            const d = await storage.get(DRAFT_FILE);
            if (d) drafts.current = JSON.parse(openItem(k, JSON.parse(d) as SealedItem, { accountId: ACCOUNT, itemId: "drafts", version: 1 })) as Record<string, string>;
          } catch { await storage.delete(DRAFT_FILE); }
        }
      } catch {
        setLoadError("Your saved kitchen data could not be opened on this device. The key may be missing. It stays locked; nothing was shown.");
      }
      setLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the app for a while locks it (a shared device is often put down mid-task); unsent drafts are written first.
  useEffect(() => {
    const sub = RNAppState.addEventListener("change", (st) => {
      if (st !== "active") { leftAt.current = Date.now(); flushDrafts(); }
      else if (leftAt.current !== null) {
        const away = Date.now() - leftAt.current;
        leftAt.current = null;
        if (away > 30_000 && engineRef.current) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [flushDrafts]);

  const isDemo = !!state?.synthetic;
  const actor = state && actorId ? state.staff.find((x) => x.id === actorId) ?? null : null;
  const siteId = state?.sites[0]?.id ?? "";

  const touch = useCallback(() => { lastTouch.current = Date.now(); }, []);
  // idle auto-lock
  useEffect(() => {
    if (!actorId || locked) return;
    const t = setInterval(() => {
      if (Date.now() - lastTouch.current > settingsRef.current.autoLockMin * 60_000) setLocked(true);
    }, 5_000);
    return () => clearInterval(t);
  }, [actorId, locked]);

  const failure = (id: string, ok: boolean) => {
    const cur = settingsRef.current.failures;
    const next = { ...cur };
    if (ok) delete next[id];
    else { const n = (cur[id]?.n ?? 0) + 1; next[id] = { n, until: Date.now() + lockoutMs(n) }; }
    saveSettings({ ...settingsRef.current, failures: next });
  };
  const waitFor = (id: string) => Math.max(0, (settingsRef.current.failures[id]?.until ?? 0) - Date.now());

  const startSession = useCallback((id: string) => {
    const changed = actorRef.current !== id;
    setActorId(id); actorRef.current = id; setLocked(false); lastTouch.current = Date.now();
    if (changed) { subBack.current = null; setScreen("home"); setNonce((n) => n + 1); setPrefill({}); }
    setToast(null);
  }, []);

  const signIn = useCallback(async (staffId: string, pin: string): Promise<SignIn> => {
    const e = engineRef.current;
    const s = e?.state;
    const st = s?.staff.find((x) => x.id === staffId);
    if (!e || !s || !st || st.status !== "active") return { ok: false, error: "That person cannot sign in." };
    const rec = s.pins?.[staffId];
    if (!rec) {
      if (s.synthetic) { startSession(staffId); return { ok: true }; }
      return { ok: false, error: "This person has not chosen a PIN yet." };
    }
    const wait = waitFor(staffId);
    if (wait > 0) return { ok: false, error: `Too many wrong PINs. Try again in ${Math.ceil(wait / 1000)} seconds.`, waitMs: wait };
    const ok = checkPin(rec, pin);
    failure(staffId, ok);
    if (!ok) {
      try { e.recordSession(staffId, "pin_failed"); } catch { /* ignore */ }
      const w = waitFor(staffId);
      return { ok: false, error: w > 0 ? `Wrong PIN. Wait ${Math.ceil(w / 1000)} seconds before trying again.` : "Wrong PIN. Try again.", waitMs: w };
    }
    try { e.recordSession(staffId, "signed_in"); } catch { /* ignore */ }
    startSession(staffId);
    return { ok: true };
  }, [startSession]);

  const needsPin = useCallback((id: string) => !!state && !state.synthetic && !state.pins?.[id], [state]);

  const choosePin = useCallback(async (staffId: string, pin: string): Promise<SignIn> => {
    const e = engineRef.current;
    if (!e || e.state.pins?.[staffId] || e.state.synthetic) return { ok: false, error: "A PIN is already set." };
    const bad = validatePin(pin);
    if (bad) return { ok: false, error: bad };
    try { e.setPin(staffId, staffId, pin); } catch { return { ok: false, error: "Could not set the PIN." }; }
    try { e.recordSession(staffId, "signed_in"); } catch { /* ignore */ }
    startSession(staffId);
    return { ok: true };
  }, [startSession]);

  const confirmPin = useCallback((pin: string): SignIn => {
    const e = engineRef.current; const id = actorRef.current;
    const rec = id ? e?.state.pins?.[id] : undefined;
    if (!e || !id || !rec) return { ok: true };
    const wait = waitFor(id);
    if (wait > 0) return { ok: false, error: `Too many wrong PINs. Try again in ${Math.ceil(wait / 1000)} seconds.`, waitMs: wait };
    const ok = checkPin(rec, pin);
    failure(id, ok);
    if (!ok) return { ok: false, error: "Wrong PIN." };
    try { e.recordSession(id, "reconfirmed"); } catch { /* ignore */ }
    return { ok: true };
  }, []);

  const setSettings = useCallback((p: Partial<Settings>) => saveSettings({ ...settingsRef.current, ...p }), [saveSettings]);

  const startExample = useCallback(async () => {
    drafts.current = {}; flushDrafts();
    attach(syntheticExample());
    setLoadError(null);
    setScreen("home"); setNonce((n) => n + 1);
    setActorId(null); actorRef.current = null; setLocked(true);
    setToast(null);
    // persist through the same path
    engineRef.current!.advanceClock(0);
  }, [attach, flushDrafts]);

  const createKitchen = useCallback(async (i: { kitchenName: string; siteName: string; ownerName: string; pin: string }): Promise<SignIn> => {
    if (!i.ownerName.trim()) return { ok: false, error: "Enter your name." };
    if (!i.kitchenName.trim()) return { ok: false, error: "Enter the kitchen or business name." };
    const bad = validatePin(i.pin);
    if (bad) return { ok: false, error: bad };
    const { state: s0, ownerId } = ownKitchenState({ kitchenName: i.kitchenName, siteName: i.siteName, ownerName: i.ownerName });
    drafts.current = {}; flushDrafts();
    attach(s0);
    engineRef.current!.setPin(ownerId, ownerId, i.pin);
    setLoadError(null);
    startSession(ownerId);
    setScreen("home"); setNonce((n) => n + 1);
    return { ok: true };
  }, [attach, flushDrafts, startSession]);

  const eraseAll = useCallback(async () => {
    await writeChain.current;
    await storage.delete(STATE_FILE);
    await storage.delete(DRAFT_FILE);
    await keys.delete(KEY);
    engineRef.current = null;
    drafts.current = {};
    setState(null); setActorId(null); actorRef.current = null; setLocked(true);
    setScreen("home"); setNonce((n) => n + 1);
    setPrefill({});
    saveSettings({ ...DEFAULT_SETTINGS, textSize: settingsRef.current.textSize, theme: settingsRef.current.theme });
  }, [keys, saveSettings]);

  const run = useCallback(<T,>(fn: (e: Engine, actorId: string) => T): Run<T> => {
    try {
      if (!engineRef.current || !actorRef.current) return { ok: false, error: "Nobody is signed in.", code: "no_session" };
      lastTouch.current = Date.now();
      return { ok: true, value: fn(engineRef.current, actorRef.current) };
    } catch (err) {
      if (err instanceof DomainError) return { ok: false, error: err.message, code: err.code, detail: err.detail };
      return { ok: false, error: err instanceof Error ? err.message : "Something went wrong.", code: "error" };
    }
  }, []);

  const value: Ctx = {
    loaded, loadError, engine: engineRef.current, state, siteId, isDemo, actorId, actor, locked,
    lock: () => setLocked(true), signIn, needsPin, choosePin, stepUpRequired: !!state && !state.synthetic, confirmPin, touch,
    screen,
    go: (s, prm) => { subBack.current = null; param.current = prm ?? null; setToast(null); setScreen(s); setNonce((n) => n + 1); },
    takeParam: () => { const v = param.current; param.current = null; return v; },
    navNonce: nonce,
    registerBack: (fn) => { subBack.current = fn; },
    back: () => {
      if (subBack.current && subBack.current()) return true;
      if (screen !== "home") { subBack.current = null; setToast(null); setScreen("home"); setNonce((n) => n + 1); return true; }
      return false;
    },
    settings, setSettings, toast, say, dismissToast: () => setToast(null),
    startExample, createKitchen, eraseAll, prefill, setPrefill, run, keys,
    draft: (k) => drafts.current[`${actorRef.current ?? "-"}:${k}`] ?? "",
    setDraft: (k, v) => {
      const key = `${actorRef.current ?? "-"}:${k}`;
      if (v) drafts.current[key] = v; else delete drafts.current[key];
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(flushDrafts, 800);
      bump((n) => n + 1);
    },
    clearDrafts: (prefix) => {
      const p = `${actorRef.current ?? "-"}:${prefix}`;
      for (const k of Object.keys(drafts.current)) if (k.startsWith(p)) delete drafts.current[k];
      flushDrafts(); bump((n) => n + 1);
    }
  };
  void makePinRecord;
  return <C.Provider value={value}>{children}</C.Provider>;
}
