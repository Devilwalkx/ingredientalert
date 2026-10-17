import React, { useState } from "react";
import { View } from "react-native";
import {
  ALLERGENS, ALLERGEN_LABEL, MAX_OVERRIDE_DAYS, NOT_A_GUARANTEE, PERSONAS, ROLE_LABEL, ROLE_SWITCH_NOTICE, SYNTHETIC_NOTICE,
  canAct, generateRecoverySecret, rolesAt, sauceDelivery, substituteSpecInput, SUB_NAME, wrapKeyForRecovery, type Allergen
} from "@ingredientalert/core";
import { useStore } from "../store";
import { personaLine, staffName } from "../lib";
import { c, space } from "../theme";
import { Button, Callout, Card, Chip, Field, Screen, Section, Txt, useConfirm } from "../ui";
import { ErrorLine, SwitchHint } from "./shared";

export function SettingsScreen() {
  const { go } = useStore();
  return (
    <Screen title="Settings and privacy" onBack={() => go("home")}>
      <SettingsBody />
    </Screen>
  );
}

function SettingsBody() {
  const { state, site, personaId, eraseAll, keys } = useStore();
  const s = state!;
  const confirm = useConfirm();
  const [secret, setSecret] = useState<string | null>(null);
  const isAdmin = canAct(s, personaId, "manage_staff", site);
  void isAdmin;
  return (
    <>
      <Section title="Privacy and your data">
        <Card>
          <Txt>All kitchen data is stored only on this phone, encrypted. There is no server and nothing is sent anywhere. The app asks for no camera, location, microphone or storage permission.</Txt>
          <Txt color={c.muted}>Staff names and actions are personal data. The example uses made-up people. No guest health details are stored.</Txt>
          <Txt color={c.muted}>If you lose the phone or the key, the data cannot be recovered. This build has no backup copy anywhere.</Txt>
          <Button label="Show a sample recovery secret" kind="secondary" onPress={async () => {
            const { secret: raw, display } = generateRecoverySecret();
            const k = await keys.get("content");
            if (k) wrapKeyForRecovery(k, raw, "local-demo-account");
            setSecret(display);
          }} />
          {secret && <Txt selectable label="Recovery secret, shown once">{secret}</Txt>}
          {secret && <Txt v="small" color={c.muted}>Design preview only: with no backup copy in this build, this secret cannot restore anything yet. It is not saved.</Txt>}
          <Button label="Erase everything on this phone" kind="secondary" onPress={() =>
            confirm.ask({ title: "Erase everything?", body: "This deletes the kitchen data and the key from this phone. It cannot be undone and there is no backup.", yes: "Yes, erase everything", onYes: () => { void eraseAll(); } })} />
        </Card>
      </Section>
      <Section title="Who can do what">
        <Card>
          {Object.entries(ROLE_LABEL).map(([r, l]) => <Txt key={r}><Txt bold>{l}:</Txt> {ROLE_TEXT[r]}</Txt>)}
          <Txt color={c.muted}>You, now: {personaLine(s, personaId, site)}</Txt>
        </Card>
      </Section>
      <Section title="Manager tools">
        {canAct(s, personaId, "grant_override", site) ? <ManagerTools /> : <SwitchHint role="administrator" why="Kitchen controls, exceptions, staff changes and the history export are manager tools." />}
      </Section>
    </>
  );
}

const ROLE_TEXT: Record<string, string> = {
  receiving_operator: "writes deliveries in.",
  specification_reviewer: "checks supplier paperwork and which recipes change.",
  publication_approver: "approves changes and publishes menus.",
  service_staff: "sees the menu and confirms they have seen it.",
  administrator: "manages people, exceptions and exports."
};

function ManagerTools() {
  const { state, site, personaId, run } = useStore();
  const s = state!;
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [ctlAllergen, setCtlAllergen] = useState<Allergen | null>(null);
  const [ctlNote, setCtlNote] = useState("");
  const [exc, setExc] = useState<{ who: string; reason: string; days: number }>({ who: "", reason: "", days: 3 });
  const [exported, setExported] = useState<string | null>(null);
  const approvers = s.staff.filter((x) => x.status === "active" && rolesAt(s, x.id, site).includes("publication_approver"));
  const now = Date.now() + s.clockOffsetMs;
  const active = s.overrides.filter((o) => o.siteId === site && !o.revokedAt && Date.parse(o.expiresAt) > now);
  const siteName = s.sites.find((x) => x.id === site)!.name;
  return (
    <>
      <ErrorLine msg={error} />
      <Section title="Kitchen controls">
        <Txt color={c.muted}>Written by people. These are never worked out from ingredients.</Txt>
        {s.controls.filter((x) => x.siteId === site).map((x) => <Txt key={x.id}>• {ALLERGEN_LABEL[x.allergen]}: {x.note}</Txt>)}
        <Txt bold>Pick the allergen</Txt>
        {ALLERGENS.map((a) => <Button key={a} label={ALLERGEN_LABEL[a]} kind="secondary" selected={ctlAllergen === a} onPress={() => setCtlAllergen(a)} />)}
        <Field label="What the kitchen does" value={ctlNote} onChange={setCtlNote} />
        <Button label="Save kitchen control" disabled={!ctlAllergen} onPress={() => {
          const r = run((e) => e.setKitchenControl(personaId, site, ctlAllergen!, ctlNote));
          setError(r.ok ? null : r.error);
          if (r.ok) setCtlNote("");
        }} />
      </Section>
      <Section title="Small-team exception">
        <Txt color={c.muted}>Lets one named approver approve a change they helped with. It needs a written reason, covers one person at {siteName}, and ends by itself (at most {MAX_OVERRIDE_DAYS} days). It can never make an unknown allergen count as absent.</Txt>
        <Txt bold>Who is it for?</Txt>
        {approvers.map((p) => <Button key={p.id} label={p.name} kind="secondary" selected={exc.who === p.id} onPress={() => setExc({ ...exc, who: p.id })} />)}
        <Field label="Reason (a full sentence)" value={exc.reason} onChange={(v) => setExc({ ...exc, reason: v })} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.s }}>
          {[1, 3, 7].map((d) => <View key={d} style={{ flexGrow: 1, flexBasis: 90, minWidth: 0 }}><Button label={`${d} ${d === 1 ? "day" : "days"}`} kind="secondary" selected={exc.days === d} onPress={() => setExc({ ...exc, days: d })} /></View>)}
        </View>
        <Button label="Grant exception" disabled={!exc.who} onPress={() =>
          confirm.ask({
            title: "Grant this exception?",
            body: `Allow ${staffName(s, exc.who)} to approve a change they recorded or checked at ${siteName} for ${exc.days} ${exc.days === 1 ? "day" : "days"}. Reason: ${exc.reason}`,
            yes: "Yes, grant it",
            onYes: () => { const r = run((e) => e.grantOverride(personaId, { kind: "sod_exception", siteId: site, actorId: exc.who, reason: exc.reason, days: exc.days })); setError(r.ok ? null : r.error); }
          })} />
        {active.map((o) => (
          <Card key={o.id}>
            <Chip kind="wait">Active until {o.expiresAt.slice(0, 10)}</Chip>
            <Txt>{o.kind === "sod_exception" ? `Exception for ${staffName(s, o.actorId!)}` : "Publish with warning"}: {o.reason}</Txt>
            <Button label="End it now" kind="secondary" onPress={() => run((e) => e.revokeOverride(personaId, o.id))} />
          </Card>
        ))}
      </Section>
      <Section title="People">
        {s.staff.filter((x) => x.tenantId === s.sites.find((y) => y.id === site)!.tenantId).map((p) => (
          <Card key={p.id}>
            <Txt bold>{p.name}</Txt>
            <Chip kind={p.status === "active" ? "ok" : "wait"}>{p.status === "active" ? "Active" : p.erased ? "Left - personal details removed" : "Left"}</Chip>
            {p.status === "active" && <Button label={`${p.name} has left`} kind="secondary" onPress={() =>
              confirm.ask({ title: `Remove ${p.name}'s access?`, body: "Their access stops straight away and they are no longer expected to acknowledge menus. Their past actions stay in the record.", yes: "Yes, remove access", onYes: () => { const r = run((e) => e.offboardStaff(personaId, p.id)); setError(r.ok ? null : r.error); } })} />}
            {p.status === "offboarded" && !p.erased && <Button label={`Remove ${p.name}'s personal details`} kind="secondary" onPress={() =>
              confirm.ask({ title: "Remove personal details?", body: "The name is replaced. The audit record of what they approved is kept, because it shows who approved allergen changes. The retention period is not decided yet (open item).", yes: "Yes, remove details", onYes: () => { const r = run((e) => e.requestStaffErasure(personaId, p.id)); setError(r.ok ? null : r.error); } })} />}
          </Card>
        ))}
      </Section>
      <Section title="History for review">
        <Txt color={c.muted}>Every published revision, who approved it, the evidence behind it, and which places are out of date.</Txt>
        <Button label="Show history" kind="secondary" onPress={() => {
          const r = run((e) => e.exportHistory(personaId, site));
          if (r.ok) setExported(JSON.stringify(r.value, null, 1)); else setError(r.error);
        }} />
        {exported && <Txt v="small" selectable label="History export">{exported}</Txt>}
      </Section>
    </>
  );
}

export function AboutScreen() {
  const { go } = useStore();
  return (
    <Screen title="About this app" onBack={() => go("home")} notice={false}>
      <Callout kind="wait">{SYNTHETIC_NOTICE}</Callout>
      <Card>
        <Txt>{NOT_A_GUARANTEE}</Txt>
        <Txt>Use it beside your existing kitchen procedures, not instead of them. It is a draft built for review. It has not had food-safety, privacy or security review, and it has not been tested on a real kitchen.</Txt>
        <Txt>Existing allergen systems may already do much of this. This app exists to test one gap: spotting a substituted delivery at the door, getting it checked by a second person, and making sure every menu and every team member is on the same revision.</Txt>
      </Card>
      <Section title="What is real and what is pretend">
        <Card>
          <Txt>Real: the checking rules, the approval steps, the "unknown stays unknown" rule, the history, and encrypted storage on this phone.</Txt>
          <Txt>Pretend: all kitchen data; one phone playing every staff role (real staff logins need a server, not built); the printer and the QR/web menu (they are simulated).</Txt>
          <Txt>Not built: a server, shared accounts, supplier feeds, barcode camera scanning, AI reading of specification sheets (a possible later option that would need its own reviewed design), diner allergy profiles.</Txt>
        </Card>
      </Section>
    </Screen>
  );
}

export function DemoScreen() {
  const { go } = useStore();
  return (
    <Screen title="Demo options" onBack={() => go("home")}>
      <DemoBody />
    </Screen>
  );
}

function DemoBody() {
  const { state, site, personaId, setPersona, setPrefill, go, settings, setSettings, run, startExample } = useStore();
  const s = state!;
  const confirm = useConfirm();
  return (
    <>
      <Callout kind="wait">{ROLE_SWITCH_NOTICE}</Callout>
      <Txt v="h2" role="header">Who are you?</Txt>
      {PERSONAS.map((p) => (
        <Button key={p.id} label={`${p.name} - ${ROLE_LABEL[p.role]}`} kind="secondary" selected={personaId === p.id} onPress={() => setPersona(p.id)} />
      ))}
      <Txt v="h2" role="header">Demo helpers</Txt>
      <Button label="Fill in the replacement-sauce delivery" kind="secondary" hint="Opens the delivery form with the example filled in" onPress={() => { setPrefill({ receive: sauceDelivery(site) }); setPersona("alex"); go("receive"); }} />
      <Button label="Fill in the supplier sheet for the new sauce" kind="secondary" hint="Used in the paperwork step of a review" onPress={() => { setPrefill({ spec: substituteSpecInput(), specProduct: { name: SUB_NAME, supplier: "Fictional Foods Ltd" } }); setPersona("priya"); go("review"); }} />
      <Button label={settings.printerFails ? "Printed-menu update fails: ON" : "Printed-menu update fails: OFF"} kind="secondary" selected={settings.printerFails} onPress={() => setSettings({ printerFails: !settings.printerFails })} />
      <Button label="Move the clock forward 1 day" kind="secondary" onPress={() => run((e) => e.advanceClock(86_400_000))} />
      <Txt v="small" color={c.muted}>The clock only affects when exceptions expire. It is now {new Date(Date.now() + s.clockOffsetMs).toISOString().slice(0, 16).replace("T", " ")}.</Txt>
      <Button label="Reset to the example kitchen" kind="secondary" onPress={() => confirm.ask({ title: "Reset the example?", body: "This replaces everything with the starting example data.", yes: "Yes, reset", onYes: () => { void startExample(); setPersona("alex"); } })} />
    </>
  );
}
