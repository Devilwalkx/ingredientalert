import React from "react";
import { Pressable, View } from "react-native";
import { checkCopy, siteStatus, outstandingAcks, ROLE_LABEL, type Engine } from "@ingredientalert/core";
import { useStore, type Screen as ScreenId } from "../store";
import { personaLine, staffName } from "../lib";
import { TEXT_SIZES, c, radius, shadow, space, useSize } from "../theme";
import { Button, Card, Chip, Screen, Txt } from "../ui";

function HomeButton({ icon, title, sub, onPress }: { icon: string; title: string; sub: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [{ minHeight: 72, backgroundColor: c.card, borderRadius: radius, padding: space.m, flexDirection: "row", alignItems: "center", gap: space.s, opacity: pressed ? 0.85 : 1 }, shadow]}
    >
      <Txt v="h1" hidden style={{ width: 40, textAlign: "center", flexShrink: 0 }}>{icon}</Txt>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Txt v="h2" color={c.accent}>{title}</Txt>
        <Txt v="small" color={c.muted}>{sub}</Txt>
      </View>
      <Txt v="h2" hidden color={c.accent} style={{ flexShrink: 0 }}>›</Txt>
    </Pressable>
  );
}

function TodoCard({ kind, title, detail, go }: { kind: "wait" | "bad" | "unk"; title: string; detail: string; go: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={go} style={[{ backgroundColor: c.card, borderRadius: radius, padding: space.m, gap: 8 }, shadow]}>
      <Chip kind={kind}>{kind === "bad" ? "Needs action" : kind === "unk" ? "Waiting for a check" : "Waiting"}</Chip>
      <Txt v="h2">{title}</Txt>
      <Txt color={c.muted}>{detail}</Txt>
    </Pressable>
  );
}

export function todoItems(e: Engine, site: string) {
  const s = e.state;
  const st = siteStatus(e, site);
  const items: Array<{ kind: "wait" | "bad" | "unk"; title: string; detail: string; to: ScreenId }> = [];
  if (st.openCases > 0) items.push({ kind: "unk", title: `${st.openCases} ${st.openCases === 1 ? "delivery needs" : "deliveries need"} checking`, detail: "Menus that use it show UNKNOWN until it is checked and approved.", to: "review" });
  if (st.queued > 0) items.push({ kind: "wait", title: `${st.queued} ${st.queued === 1 ? "delivery was" : "deliveries were"} written down but not checked`, detail: "Check them now to see if anything is different.", to: "receive" });
  if (st.pendingChange && st.openCases === 0 && st.queued === 0) items.push({ kind: "wait", title: "Menu changes are waiting to be published", detail: "An approved change is not on the menus yet.", to: "publish" });
  const old = st.channels.filter((ch) => ch.status !== "current" && ch.latestRevision !== null);
  if (old.length > 0) {
    const failed = old.some((ch) => ch.status === "failed");
    items.push({ kind: failed ? "bad" : "wait", title: `${old.length} ${old.length === 1 ? "place still shows" : "places still show"} an old menu`, detail: `${old.map((ch) => (ch.channel === "printed_menu" ? "Printed menu" : ch.channel === "qr_web" ? "QR / web menu" : "Service view")).join(", ")}${failed ? " - an update failed" : ""}.`, to: "publish" });
  }
  const acks = outstandingAcks(s, site);
  if (acks.revision && acks.outstanding.length > 0 && st.channels.find((ch) => ch.channel === "service_view")?.status === "current")
    items.push({ kind: "wait", title: `${acks.outstanding.length} ${acks.outstanding.length === 1 ? "person has" : "people have"} not acknowledged revision ${acks.revision}`, detail: acks.outstanding.map((id) => staffName(s, id)).join(", ") + ".", to: "service" });
  return items;
}

export function HomeScreen() {
  const { state, engine, personaId, site, go, settings, setSettings, startExample, loadError, setPrefill } = useStore();
  const { setSize } = useSize();
  void setSize; void checkCopy; void ROLE_LABEL; void setPrefill;
  if (!state || !engine) {
    return (
      <Screen>
        <Txt v="h1" role="header" level={1}>IngredientAlert</Txt>
        <Card>
          <Txt v="h2" role="header">Welcome</Txt>
          <Txt>This app helps a kitchen notice when a delivery is not what was ordered, check it, and make sure the right people see the new allergen information.</Txt>
          <Txt color={c.muted}>It uses made-up example data only. Everything stays on this phone.</Txt>
          {loadError ? <Txt color={c.badText} bold role="alert">{loadError}</Txt> : null}
          <Button label="Start with the example kitchen" onPress={() => { startExample(); }} />
        </Card>
        <Button label="About this app" kind="quiet" onPress={() => go("about")} />
      </Screen>
    );
  }
  const items = todoItems(engine, site);
  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <View style={{ backgroundColor: c.accent, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 }}><Txt v="small" bold color="#fff">IA</Txt></View>
        <Txt v="h1" role="header" level={1}>IngredientAlert</Txt>
      </View>
      <Card>
        <Txt color={c.muted}>You are using the app as</Txt>
        <Txt bold>{personaLine(state, personaId, site)}</Txt>
        <Button label="Demo options" kind="quiet" hint="Switch who you are, and demo helpers" onPress={() => go("demo")} />
      </Card>
      <View style={{ gap: space.s }}>
        <Txt v="h2" role="header">To do</Txt>
        {items.length === 0 ? (
          <Card><Chip kind="ok">Nothing waiting</Chip><Txt>All menus are up to date and everyone has acknowledged the latest one. This is a record check, not a safety guarantee.</Txt></Card>
        ) : items.map((i) => <TodoCard key={i.title} kind={i.kind} title={i.title} detail={i.detail} go={() => go(i.to)} />)}
      </View>
      <View style={{ gap: space.s }}>
        <Txt v="h2" role="header">What do you want to do?</Txt>
        <HomeButton icon="📦" title="A delivery has arrived" sub="Write it down and check it" onPress={() => go("receive")} />
        <HomeButton icon="🔍" title="Check a change" sub="Look at the paperwork, then approve" onPress={() => go("review")} />
        <HomeButton icon="📤" title="Publish menu updates" sub="Send approved changes to every menu" onPress={() => go("publish")} />
        <HomeButton icon="🍽" title="Menu for service" sub="See the current menu and confirm you saw it" onPress={() => go("service")} />
        <HomeButton icon="⚙" title="Settings and privacy" sub="Manager tools, privacy, your data" onPress={() => go("settings")} />
      </View>
      <Card>
        <Txt bold>Text size</Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
          {TEXT_SIZES.map((t) => (
            <View key={t.id} style={{ flexGrow: 1, flexBasis: 120, minWidth: 0 }}>
              <Button label={t.label} kind="secondary" selected={settings.textSize === t.id} onPress={() => setSettings({ textSize: t.id })} />
            </View>
          ))}
        </View>
      </Card>
      <Button label="About this app" kind="quiet" onPress={() => go("about")} />
    </Screen>
  );
}
