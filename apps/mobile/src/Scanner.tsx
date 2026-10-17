import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "./design/theme";
import { radius, space } from "./design/tokens";
import { SCAN_TIMEOUT_MS, SCAN_TYPES } from "./scanFlow";
import { Btn, Card, Loading, Notice, Txt } from "./ui";

export interface ScannerProps {
  /** Returns a plain-words problem if the read is not usable (the camera then keeps looking), or null to accept it. */
  validate(code: string): string | null;
  onCode(code: string): void;
  /** Leave the camera and type the number or search by name instead. */
  onManual(): void;
}

/**
 * Camera barcode reader. The camera permission is requested only here, after a plain-words reason, when the person
 * taps "Scan the barcode". Pictures are never stored or sent: frames are decoded in memory by the camera module.
 * Camera preview is not announced to screen readers; every control is a labelled button and typing is always available.
 */
export function Scanner(p: ScannerProps) {
  const c = useTheme();
  const [perm, request, refresh] = useCameraPermissions();
  const [denied, setDenied] = useState(false);
  const [torch, setTorch] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const done = useRef(false);

  // coming back from the system settings page: look at the permission again
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") refresh().catch(() => undefined); });
    return () => sub.remove();
  }, [refresh]);

  const granted = !!perm?.granted;
  useEffect(() => {
    if (!granted) return;
    done.current = false;
    setTimedOut(false);
    const t = setTimeout(() => setTimedOut(true), SCAN_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [granted, attempt]);

  const onRead = useCallback((r: { data: string }) => {
    if (done.current) return;
    const bad = p.validate(r.data);
    if (bad) { done.current = true; setProblem(`${bad} (read: ${r.data.slice(0, 20)})`); return; }
    done.current = true;
    setTorch(false);
    p.onCode(r.data);
  }, [p]);

  if (!perm) return <Loading text="Checking camera permission…" />;

  if (!granted) {
    const blocked = !perm.canAskAgain && perm.status === "denied";
    return (
      <Card>
        <Txt v="heading" header>{blocked ? "The camera is switched off for this app" : "Use the camera to read the barcode?"}</Txt>
        {blocked ? (
          <>
            <Txt>Android will not ask again. To scan, open the app's settings, choose Permissions, then Camera, and allow it. Or carry on without the camera.</Txt>
            <Btn label="Open Android settings" icon="settings" onPress={() => { Linking.openSettings().catch(() => undefined); }} />
          </>
        ) : (
          <>
            <Txt>The camera is used only to read the number on the barcode of the pack in front of you. The app does not take, keep or send pictures. If you say no, you can type the number or search by name instead.</Txt>
            {denied ? <Notice tone="wait" text="Camera not allowed. You can try again, or type the number instead." /> : null}
            <Btn label={denied ? "Ask for camera access again" : "Allow camera"} icon="scan" onPress={async () => { const r = await request(); if (!r.granted) setDenied(true); }} />
          </>
        )}
        <Btn label="Type the number or search instead" kind="secondary" icon="search" onPress={p.onManual} />
      </Card>
    );
  }

  return (
    <View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 260, borderRadius: radius.l, overflow: "hidden", backgroundColor: "#000", marginBottom: space.s }}>
        <CameraView
          key={attempt}
          style={{ flex: 1 }}
          facing="back"
          enableTorch={torch}
          barcodeScannerSettings={{ barcodeTypes: [...SCAN_TYPES] }}
          onBarcodeScanned={timedOut || problem ? undefined : onRead}
        />
        <View pointerEvents="none" style={{ position: "absolute", left: "10%", right: "10%", top: "30%", bottom: "30%", borderWidth: 3, borderColor: "#fff", borderRadius: radius.m }} />
      </View>
      <Txt color={c.textMuted}>Hold the barcode inside the frame. Good light helps; use the torch if it is dark.</Txt>
      {problem ? <Notice tone="bad" text={problem} /> : null}
      {timedOut ? <Notice tone="wait" text="No barcode was read in 20 seconds. Try again, or type the number printed under the barcode." /> : null}
      <Btn label={torch ? "Torch is on: switch off" : "Switch the torch on"} role="checkbox" selected={torch} icon="flash" kind="secondary" onPress={() => setTorch(!torch)} />
      {(timedOut || problem) ? <Btn label="Try scanning again" icon="scan" onPress={() => { setProblem(null); setTimedOut(false); setAttempt((a) => a + 1); }} /> : null}
      <Btn label="Type the number or search instead" kind={timedOut || problem ? "primary" : "secondary"} icon="search" onPress={p.onManual} />
    </View>
  );
}
