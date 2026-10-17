import React, { useState } from "react";
import { View } from "react-native";
import { ROLE_LABEL, rolesAt, validatePin } from "@ingredientalert/core";
import { buildInfo } from "../buildInfo";
import { useStore } from "../store";
import { useDraft } from "../nav";
import { useTheme } from "../design/theme";
import { space } from "../design/tokens";
import { Btn, Card, Collapsible, DemoStrip, Field, Notice, Txt, Row } from "../ui";
import { Icon } from "../design/Icon";

export function WelcomeScreen() {
  const app = useStore();
  const c = useTheme();
  const b = buildInfo();
  return (
    <>
      <View style={{ alignItems: "center", paddingVertical: space.m }}>
        <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" }}><Icon name="warn" size={40} color={c.onPrimary} /></View>
      </View>
      <Txt v="display" align="center">IngredientAlert</Txt>
      <Txt align="center" color={c.textMuted}>Catch a substituted delivery at the door, get it checked by a second person, and keep the menu's allergen information in step.</Txt>
      <View style={{ height: space.m }} />
      {app.loadError ? <Notice tone="bad" text={app.loadError} /> : null}
      <Btn label="Set up my kitchen" icon="add" onPress={() => app.go("setup")} />
      <Btn label="Try the example kitchen" kind="secondary" onPress={() => { void app.startExample(); }} />
      <Txt v="small" color={c.textMuted}>The example uses made-up products, recipes and people, clearly marked. Your own kitchen starts empty and never mixes with it. Everything stays on this device: no account, no server.</Txt>
      <View style={{ height: space.s }} />
      <Collapsible title="About this build">
        <Row left="App ID" right={b.appId} />
        <Row left="Version" right={`${b.version} (${b.versionCode})`} />
        <Row left="Commit" right={b.commit} />
        <Row left="Built" right={b.builtAt} />
      </Collapsible>
    </>
  );
}

export function SetupScreen() {
  const app = useStore();
  const c = useTheme();
  const [kitchen, setKitchen] = useDraft("setup-kitchen");
  const [site, setSite] = useDraft("setup-site");
  const [name, setName] = useDraft("setup-name");
  const [step, setStep] = useState<1 | 2>(1);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (busy) return;
    if (pin !== pin2) { setErr("The two PINs are not the same."); return; }
    setBusy(true);
    const r = await app.createKitchen({ kitchenName: kitchen, siteName: site || "Main kitchen", ownerName: name, pin });
    setBusy(false);
    if (!r.ok) setErr(r.error); else app.clearDrafts("setup");
  };
  return (
    <>
      {step === 1 ? (
        <>
          <Txt color={c.textMuted}>Step 1 of 2. Two names. You can change nothing here later except by erasing, so use the real ones.</Txt>
          <Field label="Business or kitchen group name" value={kitchen} onChange={setKitchen} />
          <Field label="This kitchen's name" value={site} onChange={setSite} placeholder="Main kitchen" />
          <Btn label="Next" disabled={!kitchen.trim()} onPress={() => setStep(2)} />
        </>
      ) : (
        <>
          <Txt color={c.textMuted}>Step 2 of 2. You will be the first person: administrator and approver. You add the rest of the team afterwards, and each person chooses their own PIN the first time they sign in.</Txt>
          <Field label="Your name" value={name} onChange={setName} />
          <Field label="Choose a PIN" value={pin} onChange={(v) => { setPin(v.replace(/\D/g, "")); setErr(null); }} keyboard="numeric" secure maxLength={6} help="4 to 6 digits. It tells the app who is using the shared device. It is not a password for your data." />
          <Field label="Type the PIN again" value={pin2} onChange={(v) => { setPin2(v.replace(/\D/g, "")); setErr(null); }} keyboard="numeric" secure maxLength={6} error={err} />
          <Btn label="Start my kitchen" disabled={!name.trim() || !!validatePin(pin) || busy} onPress={submit} />
          <Btn label="Back" kind="quiet" onPress={() => setStep(1)} />
        </>
      )}
    </>
  );
}

/** Shown whenever nobody is signed in: first launch after install, after idle, after leaving the app, or when switching person. */
export function LockScreen() {
  const app = useStore();
  const c = useTheme();
  const s = app.state!;
  const people = s.staff.filter((x) => x.status === "active" && x.tenantId === s.sites[0]!.tenantId);
  const [who, setWho] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const chosen = people.find((p) => p.id === who);
  const first = chosen ? app.needsPin(chosen.id) : false;
  const reset = () => { setWho(null); setPin(""); setPin2(""); setErr(null); };
  const go = async () => {
    if (!chosen) return;
    if (first) {
      if (pin !== pin2) { setErr("The two PINs are not the same."); return; }
      const r = await app.choosePin(chosen.id, pin);
      if (!r.ok) setErr(r.error);
    } else {
      const r = await app.signIn(chosen.id, pin);
      if (!r.ok) { setErr(r.error); setPin(""); }
    }
  };
  return (
    <>
      <View style={{ alignItems: "center", paddingVertical: space.s }}><Icon name="lock" size={40} color={c.primary} /></View>
      <Txt v="heading" header align="center">{chosen ? (first ? `Choose a PIN, ${chosen.name.split(" ")[0]}` : `Hello, ${chosen.name.split(" ")[0]}`) : "Who is using the device?"}</Txt>
      {app.isDemo ? <DemoStrip text="Example kitchen: the people are made up and have no PINs. In a real kitchen each person signs in with their own PIN." /> : null}
      {!chosen ? (
        <>
          <Txt color={c.textMuted} align="center">Tap your name. Everything you do next is recorded under it.</Txt>
          <View style={{ height: space.s }} />
          {people.map((p) => (
            <Btn key={p.id} label={p.name} hint={rolesAt(s, p.id, app.siteId).map((r) => ROLE_LABEL[r]).join(", ") || "no role here"} kind="secondary" icon="person"
              onPress={async () => { setErr(null); if (app.isDemo && !s.pins?.[p.id]) await app.signIn(p.id, ""); else setWho(p.id); }} />
          ))}
          <Txt v="small" color={c.textMuted}>The app locks itself after {app.settings.autoLockMin} {app.settings.autoLockMin === 1 ? "minute" : "minutes"} without a tap, and when you leave it for more than 30 seconds.</Txt>
        </>
      ) : (
        <>
          <Txt color={c.textMuted}>{rolesAt(s, chosen.id, app.siteId).map((r) => ROLE_LABEL[r]).join(", ") || "No role at this kitchen"}</Txt>
          {first ? (
            <>
              <Txt>This is your first time. Choose a PIN of 4 to 6 digits. Nobody else, including the administrator, will be able to read it.</Txt>
              <Field label="Choose a PIN" value={pin} onChange={(v) => { setPin(v.replace(/\D/g, "")); setErr(null); }} keyboard="numeric" secure maxLength={6} autoFocus />
              <Field label="Type the PIN again" value={pin2} onChange={(v) => { setPin2(v.replace(/\D/g, "")); setErr(null); }} keyboard="numeric" secure maxLength={6} error={err} onSubmit={go} />
              <Btn label="Save PIN and sign in" disabled={!!validatePin(pin)} onPress={go} />
            </>
          ) : (
            <>
              <Field label="Your PIN" value={pin} onChange={(v) => { setPin(v.replace(/\D/g, "")); setErr(null); }} keyboard="numeric" secure maxLength={6} error={err} autoFocus onSubmit={go} />
              <Btn label="Unlock" disabled={pin.length < 4} onPress={go} />
            </>
          )}
          <Btn label="Not you? Choose another person" kind="quiet" onPress={reset} />
        </>
      )}
    </>
  );
}
