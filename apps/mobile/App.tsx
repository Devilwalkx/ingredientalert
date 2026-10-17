import React, { useState } from "react";
import { View } from "react-native";
import { SafeAreaInsetsContext, SafeAreaProvider, initialWindowMetrics, type EdgeInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { installSecureRandom } from "./src/secureRandom";
import { platformBlocker } from "./src/platformCheck";
import { StoreProvider, useStore, type Settings } from "./src/store";
import { SizeContext, c, useSizeValue, type TextSize } from "./src/theme";
import { Screen, Txt } from "./src/ui";
import { HomeScreen } from "./src/screens/Home";
import { ReceiveScreen } from "./src/screens/Receive";
import { ReviewScreen } from "./src/screens/Review";
import { PublishScreen } from "./src/screens/Publish";
import { ServiceScreen } from "./src/screens/Service";
import { AboutScreen, DemoScreen, SettingsScreen } from "./src/screens/Settings";

let randomError: string | null = platformBlocker();
if (!randomError) {
  try {
    installSecureRandom();
  } catch (e) {
    randomError = e instanceof Error ? e.message : "Secure random unavailable";
  }
}

/**
 * Android draws edge-to-edge, so the status bar and the navigation bar overlap the app unless we pad by
 * the real system insets. React Native's own SafeAreaView does nothing on Android; react-native-safe-area-context does.
 * On web, `?insets=<top>,<bottom>` simulates insets for automated tests.
 */
function testInsets(): EdgeInsets | undefined {
  if (typeof window === "undefined" || !window.location?.search) return undefined;
  const m = /[?&]insets=(\d{1,3}),(\d{1,3})/.exec(window.location.search);
  return m ? { top: Number(m[1]), bottom: Number(m[2]), left: 0, right: 0 } : undefined;
}

export default function App() {
  const simulated = testInsets();
  if (simulated) {
    return (
      <SafeAreaInsetsContext.Provider value={simulated}>
        <Shell />
      </SafeAreaInsetsContext.Provider>
    );
  }
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Shell />
    </SafeAreaProvider>
  );
}

function Shell() {
  const [size, setSize] = useState<TextSize>("normal");
  const value = useSizeValue(size, setSize);
  if (randomError) {
    return (
      <SizeContext.Provider value={value}>
        <Screen title="Cannot start safely" notice={false}>
          <Txt>Private storage is disabled on this device: {randomError}</Txt>
        </Screen>
      </SizeContext.Provider>
    );
  }
  return (
    <SizeContext.Provider value={value}>
      <StoreProvider onSettings={(s: Settings) => setSize(s.textSize)}>
        <StatusBar style="dark" />
        <Router />
      </StoreProvider>
    </SizeContext.Provider>
  );
}

function Router() {
  const { ready, screen, state } = useStore();
  if (!ready) return <View style={{ flex: 1, backgroundColor: c.bg }} />;
  if (!state && screen !== "about") return <HomeScreen />;
  switch (screen) {
    case "receive": return <ReceiveScreen />;
    case "review": return <ReviewScreen />;
    case "publish": return <PublishScreen />;
    case "service": return <ServiceScreen />;
    case "settings": return <SettingsScreen />;
    case "about": return <AboutScreen />;
    case "demo": return <DemoScreen />;
    default: return <HomeScreen />;
  }
}
