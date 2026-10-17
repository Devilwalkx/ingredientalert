import React, { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, BackHandler, Keyboard, Platform, Pressable, ScrollView, Text, View, findNodeHandle } from "react-native";
import { SafeAreaInsetsContext, SafeAreaProvider, SafeAreaView, initialWindowMetrics, useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { statusItems } from "@ingredientalert/core";
import { installSecureRandom } from "./src/secureRandom";
import { platformBlocker } from "./src/platformCheck";
import { StoreProvider, useApp, type Screen } from "./src/store";
import { ConfirmHost } from "./src/confirm";
import { DemoStrip, FocusScrollContext, IconBtn, Loading, Notice, Transition, Txt, TextScaleContext, factorFor, Gap } from "./src/ui";
import { Icon, type IconName } from "./src/design/Icon";
import { ThemeProvider, useTheme, useThemeMode } from "./src/design/theme";
import { TOUCH, space } from "./src/design/tokens";
import { HomeScreen } from "./src/screens/Home";
import { LockScreen, SetupScreen, WelcomeScreen } from "./src/screens/Entry";
import { DeliverScreen } from "./src/screens/Deliver";
import { ReviewScreen } from "./src/screens/Review";
import { PublishScreen } from "./src/screens/Publish";
import { ServiceScreen } from "./src/screens/Service";
import { SettingsScreen } from "./src/screens/Settings";

let randomError: string | null = platformBlocker();
if (!randomError) {
  try {
    installSecureRandom();
  } catch (e) {
    randomError = e instanceof Error ? e.message : "Secure random unavailable";
  }
}

/** Android draws edge-to-edge. On web, `?insets=<top>,<bottom>` simulates system bars for automated tests. */
function testInsets(): EdgeInsets | undefined {
  if (typeof window === "undefined" || !window.location?.search) return undefined;
  const m = /[?&]insets=(\d{1,3}),(\d{1,3})/.exec(window.location.search);
  return m ? { top: Number(m[1]), bottom: Number(m[2]), left: 0, right: 0 } : undefined;
}
/** `?fontscale=2` multiplies all app text (tests the large-text layout on web). */
function queryFontScale(): number {
  if (typeof window === "undefined" || !window.location?.search) return 1;
  const m = /[?&]fontscale=([0-9.]{1,4})/.exec(window.location.search);
  const v = m ? Number(m[1]) : 1;
  return v >= 0.5 && v <= 3 ? v : 1;
}

export default function App() {
  const simulated = testInsets();
  const inner = <StoreProvider><Themed /></StoreProvider>;
  if (simulated) return <SafeAreaInsetsContext.Provider value={simulated}>{inner}</SafeAreaInsetsContext.Provider>;
  return <SafeAreaProvider initialMetrics={initialWindowMetrics}>{inner}</SafeAreaProvider>;
}

function Themed() {
  const app = useApp();
  return <ThemeProvider pref={app.settings.theme} setPref={(t) => app.setSettings({ theme: t })}><Root /></ThemeProvider>;
}

const TITLES: Record<Screen, string> = { home: "IngredientAlert", receive: "Check a delivery", review: "Review substitutions", publish: "Decisions and updates", service: "Menu for service", settings: "Settings", setup: "Set up my kitchen" };
const NAV: Array<{ id: Screen; label: string; icon: IconName }> = [
  { id: "home", label: "Home", icon: "home" },
  { id: "receive", label: "Delivery", icon: "delivery" },
  { id: "review", label: "Review", icon: "change" },
  { id: "publish", label: "Updates", icon: "progress" }
];

function Root() {
  const app = useApp();
  const c = useTheme();
  const { mode } = useThemeMode();
  const insets = useSafeAreaInsets();
  const q = useMemo(queryFontScale, []);
  const factor = factorFor(app.settings.textSize, q);
  const scroller = useRef<any>(null);
  const titleRef = useRef<any>(null);
  const [kb, setKb] = useState(0);
  const rootH = useRef(0);
  const scrollY = useRef(0);
  const scrollTop = useRef(0);
  const navRef = useRef(0);
  navRef.current = app.navNonce;
  const bringIntoView = (node: unknown) => {
    if (Platform.OS === "web") return;
    const at = navRef.current;
    setTimeout(() => {
      if (navRef.current !== at) return; // the screen changed meanwhile: do not scroll the new one
      (node as { measureInWindow?: (cb: (x: number, y: number) => void) => void } | null)?.measureInWindow?.((_x, y) => {
        scroller.current?.scrollTo({ y: Math.max(0, scrollY.current + (y - scrollTop.current) - 12), animated: true });
      });
    }, 350);
  };
  const beforeKb = useRef(0);

  useEffect(() => { SystemUI.setBackgroundColorAsync(c.bg).catch(() => undefined); }, [c.bg]);

  // System Back / predictive back gesture: unwind a sub-screen, then go home, then let the system leave the app.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => app.back());
    return () => sub.remove();
  });

  // Keyboard: if the window did not already shrink for the keyboard (edge-to-edge), pad the bottom so the focused field and its action stay visible.
  useEffect(() => {
    if (Platform.OS === "web") return;
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      beforeKb.current = rootH.current;
      setTimeout(() => { if (rootH.current >= beforeKb.current - 4) setKb(Math.max(0, e.endCoordinates.height - insets.bottom)); }, 120);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => setKb(0));
    return () => { show.remove(); hide.remove(); };
  }, [insets.bottom]);

  // After navigating, scroll to the top and move screen-reader focus to the screen title.
  const locked = !!app.state && app.locked;
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
    const t = setTimeout(() => {
      if (Platform.OS === "web") return;
      const h = findNodeHandle(titleRef.current);
      if (h) AccessibilityInfo.setAccessibilityFocus(h);
    }, 150);
    return () => clearTimeout(t);
  }, [app.screen, app.navNonce, locked]);
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
    const t = setTimeout(() => scroller.current?.scrollTo({ y: 0, animated: false }), 150);
    return () => clearTimeout(t);
  }, [app.scrollNonce]);

  if (randomError) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: space.m }} edges={["top", "bottom", "left", "right"]}>
        <TextScaleContext.Provider value={factor}>
          <Txt v="title" header>Cannot start safely</Txt>
          <Txt>Private storage is switched off on this device: {randomError}</Txt>
        </TextScaleContext.Provider>
      </SafeAreaView>
    );
  }

  const S = app.screen;
  const has = !!app.state;
  const inApp = has && !app.locked && !!app.actorId;
  const showNav = inApp && S !== "setup" && kb === 0;
  const e = app.engine;
  const items = has && e ? statusItems(e, app.siteId) : [];
  const reviewBadge = items.filter((i) => i.id === "awaiting_specification" || i.id === "awaiting_review").reduce((n, i) => n + i.count, 0);
  const pubBadge = items.filter((i) => i.id === "publication_incomplete" || i.id === "ack_outstanding").reduce((n, i) => n + i.count, 0);
  const title = !has ? (S === "setup" ? TITLES.setup : "IngredientAlert") : app.locked || !app.actorId ? "Sign in" : TITLES[S];
  const atRoot = !has ? S !== "setup" : (app.locked || S === "home");
  const body = !app.loaded ? <Loading text="Opening your kitchen…" />
    : !has ? (S === "setup" ? <SetupScreen /> : <WelcomeScreen />)
    : null;
  const screen = S === "home" ? <HomeScreen /> : S === "receive" ? <DeliverScreen /> : S === "review" ? <ReviewScreen /> : S === "publish" ? <PublishScreen /> : S === "service" ? <ServiceScreen /> : S === "settings" ? <SettingsScreen /> : <HomeScreen />;
  return (
    <TextScaleContext.Provider value={factor}>
      <FocusScrollContext.Provider value={bringIntoView}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingBottom: kb }} onLayout={(ev) => { rootH.current = ev.nativeEvent.layout.height; }} onTouchStart={app.touch}>
        <StatusBar style={mode === "dark" ? "light" : "dark"} />
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          <ConfirmHost>
            {/* App bar */}
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: space.xs, minHeight: 56, borderBottomWidth: 1, borderBottomColor: c.line, backgroundColor: c.bg }}>
              {!atRoot ? <IconBtn icon="back" label="Back" onPress={() => app.back()} /> : <View style={{ width: TOUCH, height: TOUCH, alignItems: "center", justifyContent: "center" }}><Icon name={inApp ? "home" : "lock"} size={24} color={c.primary} /></View>}
              <Text ref={titleRef} accessibilityRole="header" numberOfLines={2} style={{ flex: 1, minWidth: 0, color: c.text, fontSize: 20 * Math.min(factor, 1.15), lineHeight: 26 * Math.min(factor, 1.15), fontWeight: "700", paddingHorizontal: 4, ...(Platform.OS === "web" ? ({ overflowWrap: "anywhere" } as object) : {}) }}>{title}</Text>
              {inApp ? <IconBtn icon="lock" label="Lock and switch person" onPress={app.lock} /> : null}
              {inApp && S !== "settings" ? <IconBtn icon="settings" label="Settings" onPress={() => app.go("settings")} /> : null}
            </View>
            <ScrollView key={`nav-${app.navNonce}`} ref={scroller} style={{ flex: 1 }} onScroll={(ev) => { scrollY.current = ev.nativeEvent.contentOffset.y; }} scrollEventThrottle={50} onLayout={() => { setTimeout(() => (scroller.current as { measureInWindow?: (cb: (x: number, y: number) => void) => void } | null)?.measureInWindow?.((_x, y) => { scrollTop.current = y; }), 50); }} contentContainerStyle={{ padding: space.m, paddingBottom: space.xl }} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}>
              {inApp && app.isDemo ? <DemoStrip text="Example kitchen: made-up products, recipes and people. Not for real food-safety decisions." /> : null}
              {app.loadError && !has ? <Notice tone="bad" text={app.loadError} /> : null}
              {app.toast && inApp ? <Notice tone={app.toast.tone === "ok" ? "ok" : app.toast.tone === "bad" ? "bad" : "info"} text={app.toast.text} /> : null}
              {body ?? (
                <>
                  {/* the screen stays mounted (hidden) while locked, so a half-finished form is not lost; it is not readable or reachable */}
                  <View style={{ display: inApp ? "flex" : "none" }} importantForAccessibility={inApp ? "auto" : "no-hide-descendants"} accessibilityElementsHidden={!inApp}>
                    {inApp ? <Transition key={`${S}-${app.navNonce}`} id={`${S}-${app.navNonce}`}>{screen}</Transition> : null}
                  </View>
                  {!inApp ? <LockScreen /> : null}
                </>
              )}
              <Gap />
            </ScrollView>
          </ConfirmHost>
        </SafeAreaView>
        {showNav ? (
          <View accessibilityRole="tablist" style={{ flexDirection: "row", backgroundColor: c.surface, borderTopWidth: 1, borderTopColor: c.line, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}>
            {NAV.map((n) => {
              const active = S === n.id || (n.id === "publish" && S === "service");
              const badge = n.id === "review" ? reviewBadge : n.id === "publish" ? pubBadge : 0;
              return (
                <Pressable key={n.id} accessibilityRole="tab" accessibilityState={{ selected: active }} aria-selected={active}
                  accessibilityLabel={badge ? undefined : n.label} accessibilityHint={badge ? `${badge} outstanding` : undefined}
                  onPress={() => app.go(n.id)} android_ripple={{ color: c.line }}
                  style={{ flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", paddingVertical: 6 }}>
                  <View style={{ minWidth: 56, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: active ? c.primaryContainer : "transparent" }}>
                    <Icon name={n.icon} size={24} color={active ? c.onPrimaryContainer : c.textMuted} />
                  </View>
                  <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={{ color: active ? c.text : c.textMuted, fontSize: 14, fontWeight: active ? "700" : "500", marginTop: 2 }}>{n.label}</Text>
                  {badge ? <View style={{ position: "absolute", top: 4, left: "50%", marginLeft: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.dangerSolid, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}><Text allowFontScaling={false} style={{ color: c.onDangerSolid, fontSize: 11, fontWeight: "700" }}>{badge}</Text></View> : null}
                </Pressable>
              );
            })}
          </View>
        ) : <View style={{ height: kb === 0 ? insets.bottom : 0 }} />}
      </View>
      </FocusScrollContext.Provider>
    </TextScaleContext.Provider>
  );
}
