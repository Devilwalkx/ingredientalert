import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View, type TextStyle, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ALLERGEN_LABEL, type Allergen, type DeclarationBrief } from "@ingredientalert/core";
import { base, c, radius, shadow, space, useFont, useSize, type Variant } from "./theme";

/** Text that scales with the in-app text size (and the Android system font scale). Never truncates. */
export function Txt(p: { v?: Variant; bold?: boolean; color?: string; center?: boolean; children?: ReactNode; style?: TextStyle; role?: "header" | "alert"; selectable?: boolean; label?: string; level?: 1 | 2; hidden?: boolean }) {
  const v = p.v ?? "body";
  const size = useFont(v);
  const role = p.role === "header" ? "header" : p.role === "alert" ? "alert" : undefined;
  return (
    <Text
      selectable={p.selectable}
      {...(p.hidden ? ({ "aria-hidden": true, importantForAccessibility: "no-hide-descendants" } as object) : {})}
      accessibilityRole={role}
      accessibilityLabel={p.label}
      {...(role === "header" ? ({ "aria-level": p.level ?? (v === "h1" ? 1 : 2) } as object) : {})}
      style={[{ fontSize: size, lineHeight: Math.round(size * 1.4), color: p.color ?? c.text, fontWeight: p.bold || v === "h1" || v === "h2" ? "700" : "400", textAlign: p.center ? "center" : "left", flexShrink: 1 }, p.style]}
    >
      {p.children}
    </Text>
  );
}

export function Gap({ n = space.s }: { n?: number }) {
  return <View style={{ height: n }} />;
}

export function Card({ children, tone, style }: { children: ReactNode; tone?: "plain" | "accent"; style?: ViewStyle }) {
  return (
    <View style={[{ backgroundColor: tone === "accent" ? c.accentSoft : c.card, borderRadius: radius, padding: space.m, gap: space.s }, shadow, style]}>
      {children}
    </View>
  );
}

type ChipKind = "ok" | "wait" | "bad" | "unk";
const CHIP: Record<ChipKind, { bg: string; fg: string; sym: string }> = {
  ok: { bg: c.okBg, fg: c.okText, sym: "✔" },
  wait: { bg: c.waitBg, fg: c.waitText, sym: "⏳" },
  bad: { bg: c.badBg, fg: c.badText, sym: "✖" },
  unk: { bg: c.unkBg, fg: c.unkText, sym: "?" }
};
/** Status chip: always a symbol AND words. */
export function Chip({ kind, children }: { kind: ChipKind; children: ReactNode }) {
  const k = CHIP[kind];
  const size = useFont("chip");
  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: k.bg, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, maxWidth: "100%" }}>
      <Text style={{ fontSize: size, lineHeight: Math.round(size * 1.35), color: k.fg, fontWeight: "700" }}>{k.sym} {children}</Text>
    </View>
  );
}

export function Callout({ kind, children }: { kind: ChipKind; children: ReactNode }) {
  const k = CHIP[kind];
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: k.bg, borderRadius: 12, padding: space.s, flexDirection: "row", gap: 8 }}>
      <Txt color={k.fg} bold>{k.sym}</Txt>
      <View style={{ flex: 1, minWidth: 0 }}><Txt color={k.fg}>{children}</Txt></View>
    </View>
  );
}

export function Button(p: { label: string; onPress: () => void; kind?: "primary" | "secondary" | "quiet"; selected?: boolean; hint?: string; disabled?: boolean }) {
  const size = useFont("btn");
  const kind = p.kind ?? "primary";
  const selected = !!p.selected;
  const bg = kind === "primary" ? c.accent : selected ? c.accentSoft : kind === "secondary" ? c.card : "transparent";
  const fg = kind === "primary" ? c.onAccent : c.accent;
  const border = kind === "primary" ? c.accent : selected ? c.accent : kind === "secondary" ? c.accent : "transparent";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      accessibilityHint={p.hint}
      accessibilityState={{ selected, disabled: !!p.disabled }}
      disabled={p.disabled}
      onPress={p.onPress}
      style={({ pressed }) => ({
        minHeight: 54, paddingVertical: 12, paddingHorizontal: space.m, borderRadius: 14, backgroundColor: bg, borderWidth: kind === "quiet" ? 0 : 2, borderColor: border,
        alignItems: "center", justifyContent: "center", opacity: p.disabled ? 0.5 : pressed ? 0.85 : 1, alignSelf: "stretch"
      })}
    >
      <Text style={{ fontSize: size, lineHeight: Math.round(size * 1.3), color: fg, fontWeight: "700", textAlign: "center", flexShrink: 1, textDecorationLine: kind === "quiet" ? "underline" : "none" }}>
        {selected ? "✔ " : ""}{p.label}
      </Text>
    </Pressable>
  );
}

export function Field(p: { label: string; value: string; onChange: (v: string) => void; hint?: string; multiline?: boolean; keyboard?: "default" | "numeric" }) {
  const size = useFont("body");
  return (
    <View style={{ gap: 6 }}>
      <Txt v="label" bold>{p.label}</Txt>
      {p.hint ? <Txt v="small" color={c.muted}>{p.hint}</Txt> : null}
      <TextInput
        accessibilityLabel={p.label}
        value={p.value}
        onChangeText={p.onChange}
        multiline={p.multiline}
        keyboardType={p.keyboard === "numeric" ? "numeric" : "default"}
        autoCapitalize="none"
        autoCorrect={false}
        style={{ minHeight: p.multiline ? 96 : 54, borderWidth: 1.5, borderColor: "#8a93a8", borderRadius: 12, backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 10, fontSize: size, color: c.text, textAlignVertical: p.multiline ? "top" : "center" }}
      />
    </View>
  );
}

/** Collapsible block: detail on demand. */
export function Section({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const size = useFont("btn");
  return (
    <View style={{ gap: space.s }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
        style={{ minHeight: 52, paddingVertical: 10, paddingHorizontal: space.m, borderRadius: 14, backgroundColor: c.accentSoft, flexDirection: "row", alignItems: "center", gap: 8 }}
      >
        <Text style={{ fontSize: size, color: c.accent, fontWeight: "700" }}>{open ? "▾" : "▸"}</Text>
        <Text style={{ fontSize: size, lineHeight: Math.round(size * 1.3), color: c.accent, fontWeight: "700", flex: 1, flexShrink: 1 }}>{title}</Text>
      </Pressable>
      {open ? <View style={{ gap: space.s }}>{children}</View> : null}
    </View>
  );
}

const names = (xs: Allergen[]) => xs.map((a) => ALLERGEN_LABEL[a]).join(", ");

/** Contains / May contain / Kitchen controls as three short, clearly separated groups. */
export function AllergenGroups({ d, controls }: { d: DeclarationBrief; controls?: string[] }) {
  return (
    <View style={{ gap: space.s }}>
      {!d.resolved && (
        <View style={{ backgroundColor: c.unkBg, borderRadius: 12, padding: space.s, gap: 4 }}>
          <Txt v="h2" color={c.unkText}>? UNKNOWN - cannot be used on a menu</Txt>
          <Txt color={c.unkText}>Not established: {d.unresolved.length ? names(d.unresolved) : "see reasons"}.</Txt>
        </View>
      )}
      <View style={{ gap: 2 }}>
        <Txt bold>Contains</Txt>
        <Txt>{d.contains.length ? names(d.contains) : "None declared in the reviewed specifications"}</Txt>
        <Txt v="small" color={c.muted}>From ingredient declarations.</Txt>
      </View>
      <View style={{ gap: 2 }}>
        <Txt bold>May contain</Txt>
        <Txt>{d.mayContain.filter((a) => !d.contains.includes(a)).length ? names(d.mayContain.filter((a) => !d.contains.includes(a))) : "No supplier statements recorded"}</Txt>
        <Txt v="small" color={c.muted}>From the supplier's "may contain" statements.</Txt>
      </View>
      {controls ? (
        <View style={{ gap: 2 }}>
          <Txt bold>Kitchen controls</Txt>
          {controls.map((l) => <Txt key={l}>{l}</Txt>)}
          <Txt v="small" color={c.muted}>Set by people in the kitchen. Never worked out from ingredients.</Txt>
        </View>
      ) : null}
    </View>
  );
}

export function SyntheticNotice() {
  return (
    <View style={{ backgroundColor: c.waitBg, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 10 }}>
      <Text style={{ fontSize: base.small, lineHeight: 19, color: c.waitText, fontWeight: "600" }}>Synthetic demo data. Not for real food-safety decisions.</Text>
    </View>
  );
}

// ------------------------------------------------------------------- screen frame + confirmation
interface Confirm { title: string; body: string; yes: string; no?: string; onYes: () => void }
const ConfirmCtx = createContext<{ ask: (c: Confirm) => void }>({ ask: () => {} });
export const useConfirm = () => useContext(ConfirmCtx);

export function Screen(p: { title?: string; onBack?: () => void; children: ReactNode; notice?: boolean }) {
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const ref = useRef<any>(null);
  useEffect(() => {
    if (confirm) ref.current?.scrollTo({ y: 0, animated: false });
  }, [confirm]);
  return (
    <ConfirmCtx.Provider value={{ ask: setConfirm }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={["top", "bottom", "left", "right"]}>
        <ScrollView ref={ref} style={{ flex: 1 }} contentContainerStyle={{ padding: space.m, gap: space.m, paddingBottom: space.l * 2 }} keyboardShouldPersistTaps="handled">
          {confirm ? (
            <Card tone="accent">
              <Txt v="h2" role="header">{confirm.title}</Txt>
              <Txt>{confirm.body}</Txt>
              <Button label={confirm.yes} onPress={() => { const f = confirm.onYes; setConfirm(null); f(); }} />
              <Button label={confirm.no ?? "No, go back"} kind="secondary" onPress={() => setConfirm(null)} />
            </Card>
          ) : (
            <>
              {p.onBack ? <Button label="‹ Back to home" kind="secondary" onPress={p.onBack} /> : null}
              {p.title ? <Txt v="h1" role="header" level={1}>{p.title}</Txt> : null}
              {p.notice !== false ? <SyntheticNotice /> : null}
              {p.children}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ConfirmCtx.Provider>
  );
}

export function useId(): () => string {
  return () => {
    const a = new Uint8Array(8);
    globalThis.crypto.getRandomValues(a);
    return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
  };
}

export { useSize, Platform };
