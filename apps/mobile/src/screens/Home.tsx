import React from "react";
import { Pressable, View } from "react-native";
import { STATUS_MEANING, statusItems, type StatusId } from "@ingredientalert/core";
import { useStore } from "../store";
import { plural, roleLine } from "../lib";
import { useTheme } from "../design/theme";
import { radius, space } from "../design/tokens";
import { Icon, type IconName } from "../design/Icon";
import { Btn, Card, StatusChip, Txt } from "../ui";

function Task({ icon, title, detail, onPress, primary, id }: { icon: IconName; title: string; detail: string; onPress: () => void; primary?: boolean; id: string }) {
  const c = useTheme();
  return (
    <Pressable testID={id} accessibilityRole="button" onPress={onPress} android_ripple={{ color: c.line }}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: space.s, minHeight: 72, padding: space.m, borderRadius: radius.l, marginBottom: space.s, backgroundColor: primary ? c.primary : c.surface, borderWidth: primary ? 0 : 1, borderColor: c.line, opacity: pressed ? 0.88 : 1 })}>
      <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: primary ? c.onPrimary : c.primaryContainer }}>
        <Icon name={icon} size={24} color={primary ? c.primary : c.onPrimaryContainer} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Txt v="heading" color={primary ? c.onPrimary : c.text}>{title}</Txt>
        <Txt v="small" color={primary ? c.onPrimary : c.textMuted}>{detail}</Txt>
      </View>
      <Icon name="chevron" size={24} color={primary ? c.onPrimary : c.textMuted} />
    </Pressable>
  );
}

export function HomeScreen() {
  const app = useStore();
  const c = useTheme();
  const s = app.state!;
  const e = app.engine!;
  const site = app.siteId;
  const siteName = s.sites.find((x) => x.id === site)!.name;
  const items = statusItems(e, site);
  const queued = s.outbox.filter((q) => q.siteId === site && q.status === "queued").length;
  const open = s.cases.filter((x) => x.siteId === site && x.state !== "approved" && x.state !== "rejected").length;
  const pubItems = items.filter((i) => i.id === "publication_incomplete" || i.id === "ack_outstanding");
  const pubCount = pubItems.reduce((n, i) => n + i.count, 0);
  const noProducts = s.products.filter((p) => p.tenantId === s.sites.find((x) => x.id === site)!.tenantId).length === 0;
  const noRecipes = s.recipes.length === 0;
  const myRoles = roleLine(s, app.actorId!, site);

  return (
    <>
      <Txt color={c.textMuted}>{siteName} · {app.actor?.name} · {myRoles}</Txt>

      {!app.isDemo && (noProducts || noRecipes || s.staff.length < 2) ? (
        <Card tone="info">
          <Txt v="heading" header>Finish setting up</Txt>
          <Txt>{noProducts ? "Add the products you receive, with their supplier specifications. " : ""}{noRecipes ? "Add your dishes and recipes so the app can see what a change affects. " : ""}{s.staff.length < 2 ? "Add the people who receive, check and serve." : ""}</Txt>
          <Btn label="Open kitchen setup" icon="settings" kind="secondary" onPress={() => app.go("settings", "setup")} />
        </Card>
      ) : null}

      <Task id="task-delivery" primary icon="delivery" title="Check a delivery" detail={queued > 0 ? `${plural(queued, "delivery", "deliveries")} written down, not checked yet` : "Scan or type what arrived and compare it with what you ordered"} onPress={() => app.go("receive")} />
      <Task id="task-review" icon="change" title="Review substitutions" detail={open > 0 ? `${open} waiting for a specification or a decision` : "Nothing waiting for review"} onPress={() => app.go("review")} />
      <Task id="task-updates" icon="progress" title="Outstanding decisions and publication updates" detail={pubCount > 0 ? `${pubCount} outstanding: menu places not up to date or people who have not confirmed` : "Nothing outstanding to publish or confirm"} onPress={() => app.go("publish")} />

      <Txt v="heading" header>Status now</Txt>
      {items.length === 0 ? (
        <Card><Txt>Nothing outstanding at {siteName} in this app's record. This is a record check, not a safety guarantee: it cannot see stock, cooking or what was said to a guest.</Txt></Card>
      ) : items.map((i) => (
        <Pressable key={i.id} accessibilityRole="button" onPress={() => app.go(i.to)}>
          <Card>
            <StatusChip id={i.id as StatusId} />
            <Txt v="label">{plural(i.count, i.id === "ack_outstanding" ? "person" : i.id === "publication_incomplete" ? "place or change" : "delivery", i.id === "ack_outstanding" ? "people" : i.id === "publication_incomplete" ? "places or changes" : "deliveries")}</Txt>
            <Txt color={c.textMuted}>{i.detail}</Txt>
            <Txt v="small" color={c.textMuted}>{STATUS_MEANING[i.id]}</Txt>
          </Card>
        </Pressable>
      ))}

      <Btn label="Menu for service and acknowledgement" kind="secondary" icon="menu" onPress={() => app.go("service")} />
    </>
  );
}
