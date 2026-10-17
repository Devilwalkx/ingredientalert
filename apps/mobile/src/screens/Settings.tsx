import React, { useState } from "react";
import { View } from "react-native";
import {
  ALLERGENS, ALLERGEN_LABEL, MAX_OVERRIDE_DAYS, NOT_A_GUARANTEE, NOTIFICATION_NOTICE, PUBLICATION_NOTICE, ROLES, ROLE_LABEL, SUB_NAME, canAct, generateRecoverySecret,
  demoPublishSauceRevision, encryptionSelfCheck, rolesAt, sauceDelivery, substituteSpecInput, wrapKeyForRecovery, type Allergen, type Role
} from "@ingredientalert/core";
import { useStore } from "../store";
import { useDraft } from "../nav";
import { useConfirm } from "../confirm";
import { buildInfo } from "../buildInfo";
import { staffName } from "../lib";
import { AllergenEditor, unknownCountOf, unknownMaps, type Maps } from "../components";
import { useTheme } from "../design/theme";
import { space } from "../design/tokens";
import { Btn, Card, Chip, Collapsible, DemoStrip, Field, Notice, Row, Txt } from "../ui";
import { ErrorLine } from "./shared";

export function SettingsScreen() {
  const app = useStore();
  const c = useTheme();
  const s = app.state!;
  const site = app.siteId;
  const me = app.actorId!;
  const confirm = useConfirm();
  const b = buildInfo();
  const [secret, setSecret] = useState<string | null>(null);
  const [setupOpen] = useState(() => app.takeParam() === "setup");
  const [check, setCheck] = useState<Awaited<ReturnType<typeof encryptionSelfCheck>> | "running" | null>(null);
  const canSetup = canAct(s, me, "manage_catalogue", site) || canAct(s, me, "manage_staff", site) || canAct(s, me, "approve_recipe", site);
  return (
    <>
      <Collapsible title="Display" defaultOpen>
        <Txt v="label">Colours</Txt>
        {(["system", "light", "dark"] as const).map((t) => <Btn key={t} label={t === "system" ? "Follow the device" : t === "light" ? "Light" : "Dark"} role="radio" selected={app.settings.theme === t} kind="secondary" onPress={() => app.setSettings({ theme: t })} />)}
        <Txt v="label">Text size (on top of the Android text size setting)</Txt>
        {([["normal", "Normal"], ["large", "Large"], ["xlarge", "Extra large"]] as const).map(([id, l]) => <Btn key={id} label={l} role="radio" selected={app.settings.textSize === id} kind="secondary" onPress={() => app.setSettings({ textSize: id })} />)}
      </Collapsible>

      <Collapsible title="Shared device: lock and sign-in">
        <Txt>Each person signs in with their own PIN. Everything done after that is recorded under their name. The app locks itself after a period without a tap and when it is left for more than 30 seconds.</Txt>
        <Txt v="label">Lock after</Txt>
        {[1, 2, 5, 10].map((m) => <Btn key={m} label={`${m} ${m === 1 ? "minute" : "minutes"}`} role="radio" selected={app.settings.autoLockMin === m} kind="secondary" onPress={() => app.setSettings({ autoLockMin: m })} />)}
        <Btn label="Lock now and switch person" icon="lock" onPress={app.lock} />
        <Txt v="small" color={c.textMuted}>A PIN says who is holding the device. It does not encrypt the data and 4 to 6 digits can be guessed by someone who can copy the device's storage. See docs/SHARED_DEVICE_SESSIONS.md.</Txt>
      </Collapsible>

      {canSetup ? (
        <Collapsible title="Kitchen setup: people, products, recipes" defaultOpen={setupOpen}>
          <KitchenSetup />
        </Collapsible>
      ) : null}
      {canAct(s, me, "grant_override", site) ? <Collapsible title="Manager tools"><ManagerTools /></Collapsible> : null}

      <Collapsible title="Privacy and your data">
        <Txt>All kitchen data is stored only on this device, encrypted with XChaCha20-Poly1305 under a key kept in Android's protected storage. There is no server and nothing is sent anywhere: the app has no internet permission. {NOTIFICATION_NOTICE}</Txt>
        <Txt>The camera is used only to read barcodes. Camera images are not stored or sent. It has no location, microphone, contacts or storage permission.</Txt>
        <Txt color={c.textMuted}>Staff names and actions are personal data. No guest health details are stored. {PUBLICATION_NOTICE}</Txt>
        <Txt color={c.textMuted}>If you lose the device or its key, the data cannot be recovered. This build has no backup copy anywhere, and uninstalling the app deletes the data.</Txt>
        <Btn label="Show a sample recovery secret" kind="secondary" onPress={async () => {
          const { secret: raw, display } = generateRecoverySecret();
          const k = await app.keys.get("content");
          if (k) wrapKeyForRecovery(k, raw, "local-demo-account");
          setSecret(display);
        }} />
        {secret ? <Txt selectable label="Recovery secret, shown once">{secret}</Txt> : null}
        {secret ? <Txt v="small" color={c.textMuted}>Design preview only: with no backup copy in this build, this secret cannot restore anything yet. It is not saved.</Txt> : null}
        <Btn label="Erase everything on this device" kind="danger" onPress={() => confirm.ask({ title: "Erase everything?", body: "This deletes the kitchen data, unsent drafts and the key from this device. It cannot be undone and there is no backup.", yes: "Yes, erase everything", danger: true, pin: true, onYes: () => { void app.eraseAll(); } })} />
      </Collapsible>

      <Collapsible title="About this build">
        <Row left="App ID" right={b.appId} />
        <Row left="Version" right={`${b.version} (build ${b.versionCode})`} />
        <Txt>{`Commit ${b.commit} - built ${b.builtAt}`}</Txt>
        <Row left="Channel" right={b.channel} />
        <Txt>{NOT_A_GUARANTEE}</Txt>
        <Txt color={c.textMuted}>{b.channel === "release" ? "Release build, signed with the owner's private key. " : "Test build, signed with the public Android debug key (test signing only). "}It has had no food-safety, privacy, security or accessibility review, has never been used in a real kitchen, and has not been run on a physical phone by its builders.</Txt>
        <Btn label="Check encryption on this phone" kind="secondary" onPress={async () => { setCheck("running"); setCheck(await encryptionSelfCheck(app.keys)); }} />
        {check === "running" ? <Notice tone="wait" text="Checking..." /> : check ? (
          <Card accessibilityLabel="Encryption check result">
            <Txt v="heading" header>{check.ok ? "Encryption check: passed" : "Encryption check: FAILED"}</Txt>
            {check.steps.map((st) => <Txt key={st.label}>{`${st.ok ? "Passed" : "Failed"}: ${st.label}`}</Txt>)}
            <Txt v="small" color={c.textMuted}>This runs the app's real encryption and the phone's real key storage on made-up text. It shows none of your data and does not prove the encryption is unbreakable. Details: docs/ENCRYPTION_ACCOUNT.md.</Txt>
          </Card>
        ) : null}
        <Txt color={c.textMuted}>Real: the checking rules, approval steps, the "unknown stays unknown" rule, the history, camera barcode reading (not tested on a real phone), PIN sign-in and encrypted storage on this device. Simulated: the QR / web menu and the printer. Not built: a server, shared accounts, notifications, supplier feeds, AI reading of specification sheets.</Txt>
      </Collapsible>

      {app.isDemo ? <Collapsible title="Demonstration tools (example kitchen only)"><DemoTools /></Collapsible> : null}
    </>
  );
}

function KitchenSetup() {
  return (
    <>
      <PeopleTools />
      <ProductTools />
      <RecipeTools />
    </>
  );
}

function PeopleTools() {
  const app = useStore();
  const c = useTheme();
  const s = app.state!;
  const site = app.siteId;
  const me = app.actorId!;
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useDraft("people-name");
  const [roles, setRoles] = useState<Role[]>([]);
  const admin = canAct(s, me, "manage_staff", site);
  const tenant = s.sites.find((x) => x.id === site)!.tenantId;
  return (
    <Card>
      <Txt v="heading" header>People</Txt>
      <ErrorLine msg={error} />
      {s.staff.filter((x) => x.tenantId === tenant).map((p) => (
        <View key={p.id} style={{ marginBottom: space.s }}>
          <Txt v="label">{p.name}</Txt>
          <Txt v="small" color={c.textMuted}>{rolesAt(s, p.id, site).map((r) => ROLE_LABEL[r]).join(", ") || "no role"}{p.status === "active" ? (s.synthetic ? "" : s.pins?.[p.id] ? " · PIN set" : " · has not chosen a PIN yet") : p.erased ? " · left, personal details removed" : " · left"}</Txt>
          {admin && p.status === "active" && p.id !== me && !s.synthetic && s.pins?.[p.id] ? (
            <Btn label={`Reset ${p.name}'s PIN`} kind="secondary" onPress={() => confirm.ask({ title: "Reset this PIN?", body: `${p.name} will choose a new PIN the next time they sign in. You will not see it.`, yes: "Yes, reset", pin: true, onYes: () => { const r = app.run((e, a) => e.resetPin(a, p.id)); setError(r.ok ? null : r.error); } })} />
          ) : null}
          {admin && p.status === "active" && p.id !== me ? (
            <Btn label={`${p.name} has left`} kind="secondary" onPress={() => confirm.ask({ title: `Remove ${p.name}'s access?`, body: "Their access stops straight away and they are no longer expected to confirm menus. Their past actions stay in the record.", yes: "Yes, remove access", danger: true, pin: true, onYes: () => { const r = app.run((e, a) => e.offboardStaff(a, p.id)); setError(r.ok ? null : r.error); } })} />
          ) : null}
          {admin && p.status === "offboarded" && !p.erased ? (
            <Btn label={`Remove ${p.name}'s personal details`} kind="secondary" onPress={() => confirm.ask({ title: "Remove personal details?", body: "The name is replaced. The record of what they approved is kept, because it shows who approved allergen changes. The retention period is not decided yet.", yes: "Yes, remove details", danger: true, pin: true, onYes: () => { const r = app.run((e, a) => e.requestStaffErasure(a, p.id)); setError(r.ok ? null : r.error); } })} />
          ) : null}
        </View>
      ))}
      {admin && !s.synthetic ? (
        <>
          <Txt v="heading">Add a person</Txt>
          <Field label="Name" value={name} onChange={setName} />
          <Txt v="label">What they do (one or more)</Txt>
          {ROLES.map((r) => <Btn key={r} label={ROLE_LABEL[r]} role="checkbox" selected={roles.includes(r)} kind="secondary" onPress={() => setRoles(roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r])} />)}
          <Txt v="small" color={c.textMuted}>Receiving, checking and approving by the same person is blocked unless a named exception is granted. They choose their own PIN when they first sign in.</Txt>
          <Btn label="Add this person" disabled={!name.trim() || roles.length === 0} onPress={() => {
            const r = app.run((e, a) => e.addStaff(a, { name, grants: roles.map((role) => ({ role, siteId: role === "administrator" || role === "publication_approver" ? "*" : site })) }));
            if (r.ok) { setError(null); app.clearDrafts("people-"); setRoles([]); app.say(`${name.trim()} added. They choose a PIN at first sign-in.`, "ok"); } else setError(r.error);
          }} />
        </>
      ) : null}
    </Card>
  );
}

function ProductTools() {
  const app = useStore();
  const c = useTheme();
  const s = app.state!;
  const site = app.siteId;
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useDraft("prod-name");
  const [supplier, setSupplier] = useDraft("prod-supplier");
  const [barcode, setBarcode] = useDraft("prod-barcode");
  const [pack, setPack] = useDraft("prod-pack");
  const [label, setLabel] = useDraft("prod-label");
  const [ingredients, setIngredients] = useDraft("prod-ingredients");
  const [evidence, setEvidence] = useDraft("prod-evidence");
  const [mapsRaw, setMapsRaw] = useDraft("prod-maps");
  const maps: Maps = mapsRaw ? (JSON.parse(mapsRaw) as Maps) : unknownMaps();
  const allowed = canAct(s, app.actorId!, "manage_catalogue", site);
  if (!allowed) return null;
  const tenant = s.sites.find((x) => x.id === site)!.tenantId;
  const mine = s.products.filter((p) => p.tenantId === tenant);
  return (
    <Card>
      <Txt v="heading" header>Products ({mine.length})</Txt>
      {mine.slice(-6).map((p) => <Txt key={p.id} color={c.textMuted}>• {p.name}</Txt>)}
      {s.synthetic ? <Notice tone="info" text="You are in the example kitchen. Adding products here changes the example only." /> : null}
      <ErrorLine msg={error} />
      <Txt v="label">Add a product you receive</Txt>
      <Field label="Product name" value={name} onChange={setName} />
      <Field label="Supplier" value={supplier} onChange={setSupplier} />
      <Field label="Barcode number (optional)" value={barcode} onChange={setBarcode} keyboard="numeric" help="Only helps find the product at the door." />
      <Field label="Pack size" value={pack} onChange={setPack} />
      <Field label="Specification version" value={label} onChange={setLabel} help="The supplier's version label on the sheet." />
      <Field label="Ingredients, as written on the sheet" value={ingredients} onChange={setIngredients} multiline />
      <Field label="Where the allergen information came from" value={evidence} onChange={setEvidence} help="For example: supplier sheet number and page." />
      <Collapsible title={`Allergens (${unknownCountOf(maps) === 0 ? "all answered" : `${unknownCountOf(maps)} still UNKNOWN`})`}>
        <AllergenEditor maps={maps} setMaps={(m) => setMapsRaw(JSON.stringify(m))} />
      </Collapsible>
      {unknownCountOf(maps) > 0 ? <Notice tone="unk" text="Unknown answers are saved as UNKNOWN. Dishes using this product cannot be put on a menu until they are answered." /> : null}
      <Btn label="Add this product" onPress={() => {
        const r = app.run((e, a) => e.addProduct(a, { siteId: site, name, supplier, barcode, spec: { label, packSize: pack, batchCodes: null, ingredientsText: ingredients, contains: maps.c, precautionary: maps.p, evidenceReference: evidence, evidenceNote: "" } }));
        if (r.ok) { setError(null); app.clearDrafts("prod-"); app.say("Product added.", "ok"); } else setError(r.error);
      }} />
    </Card>
  );
}

function RecipeTools() {
  const app = useStore();
  const c = useTheme();
  const s = app.state!;
  const site = app.siteId;
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useDraft("rec-name");
  const [kind, setKind] = useState<"dish" | "component">("dish");
  const [parts, setParts] = useState<string[]>([]);
  const allowed = canAct(s, app.actorId!, "approve_recipe", site);
  const tenant = s.sites.find((x) => x.id === site)!.tenantId;
  const products = s.products.filter((p) => p.tenantId === tenant);
  const recipes = s.recipes.filter((r) => r.tenantId === tenant);
  const toggle = (id: string) => setParts(parts.includes(id) ? parts.filter((x) => x !== id) : [...parts, id]);
  return (
    <Card>
      <Txt v="heading" header>Dishes and recipes ({recipes.length})</Txt>
      {recipes.slice(-6).map((r) => <Txt key={r.id} color={c.textMuted}>• {r.name}{r.kind === "component" ? " (used inside other recipes)" : ""}</Txt>)}
      {!allowed ? <Txt color={c.textMuted}>Adding a recipe is done by the publication approver.</Txt> : (
        <>
          <ErrorLine msg={error} />
          <Txt v="label">Add a recipe</Txt>
          <Field label="Recipe name" value={name} onChange={setName} />
          <Btn label="A dish on the menu" role="radio" selected={kind === "dish"} kind="secondary" onPress={() => setKind("dish")} />
          <Btn label="A recipe used inside other recipes" role="radio" selected={kind === "component"} kind="secondary" onPress={() => setKind("component")} />
          <Txt v="label">What goes in it</Txt>
          {products.length === 0 && recipes.length === 0 ? <Txt color={c.textMuted}>Add products first.</Txt> : null}
          {products.map((p) => <Btn key={p.id} label={p.name} role="checkbox" selected={parts.includes(`p:${p.id}`)} kind="secondary" onPress={() => toggle(`p:${p.id}`)} />)}
          {recipes.filter((r) => r.kind === "component").map((r) => <Btn key={r.id} label={`${r.name} (recipe)`} role="checkbox" selected={parts.includes(`r:${r.id}`)} kind="secondary" onPress={() => toggle(`r:${r.id}`)} />)}
          <Btn label="Add this recipe" disabled={!name.trim() || parts.length === 0} onPress={() => {
            const r = app.run((e, a) => e.addRecipeVersion(a, { newRecipe: { name, kind }, siteIds: [site], components: parts.map((x) => (x.startsWith("p:") ? { kind: "product" as const, productId: x.slice(2) } : { kind: "recipe" as const, recipeId: x.slice(2) })) }));
            if (r.ok) { setError(null); app.clearDrafts("rec-"); setParts([]); app.say("Recipe added. It appears on a menu after the next publication.", "ok"); } else setError(r.error);
          }} />
        </>
      )}
    </Card>
  );
}

function ManagerTools() {
  const app = useStore();
  const c = useTheme();
  const s = app.state!;
  const site = app.siteId;
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [ctlAllergen, setCtlAllergen] = useState<Allergen | null>(null);
  const [ctlNote, setCtlNote] = useDraft("ctl-note");
  const [exc, setExc] = useState<{ who: string; days: number }>({ who: "", days: 3 });
  const [excReason, setExcReason] = useDraft("exc-reason");
  const [exported, setExported] = useState<string | null>(null);
  const approvers = s.staff.filter((x) => x.status === "active" && rolesAt(s, x.id, site).includes("publication_approver"));
  const now = Date.now() + s.clockOffsetMs;
  const active = s.overrides.filter((o) => o.siteId === site && !o.revokedAt && Date.parse(o.expiresAt) > now);
  const siteName = s.sites.find((x) => x.id === site)!.name;
  const canControls = canAct(s, app.actorId!, "set_controls", site);
  return (
    <>
      <ErrorLine msg={error} />
      {canControls ? (
        <Card>
          <Txt v="heading" header>Kitchen cross-contact procedures</Txt>
          <Txt color={c.textMuted}>Written by people. These are never worked out from ingredients, and they are shown apart from "contains" and the supplier's warnings.</Txt>
          {s.controls.filter((x) => x.siteId === site).map((x) => <Txt key={x.id}>• {ALLERGEN_LABEL[x.allergen]}: {x.note}</Txt>)}
          <Txt v="label">Pick the allergen</Txt>
          {ALLERGENS.map((a) => <Btn key={a} label={ALLERGEN_LABEL[a]} role="radio" kind="secondary" selected={ctlAllergen === a} onPress={() => setCtlAllergen(a)} />)}
          <Field label="What the kitchen does" value={ctlNote} onChange={setCtlNote} />
          <Btn label="Save kitchen procedure" disabled={!ctlAllergen} onPress={() => {
            const r = app.run((e, a) => e.setKitchenControl(a, site, ctlAllergen!, ctlNote));
            setError(r.ok ? null : r.error);
            if (r.ok) app.clearDrafts("ctl-");
          }} />
        </Card>
      ) : null}
      <Card>
        <Txt v="heading" header>Small-team exception</Txt>
        <Txt color={c.textMuted}>Lets one named approver approve a change they helped with. It needs a written reason, covers one person at {siteName}, and ends by itself (at most {MAX_OVERRIDE_DAYS} days). It can never make an unknown allergen count as absent.</Txt>
        <Txt v="label">Who is it for?</Txt>
        {approvers.map((p) => <Btn key={p.id} label={p.name} role="radio" kind="secondary" selected={exc.who === p.id} onPress={() => setExc({ ...exc, who: p.id })} />)}
        <Field label="Reason (a full sentence)" value={excReason} onChange={setExcReason} />
        {[1, 3, 7].map((d) => <Btn key={d} label={`${d} ${d === 1 ? "day" : "days"}`} role="radio" kind="secondary" selected={exc.days === d} onPress={() => setExc({ ...exc, days: d })} />)}
        <Btn label="Grant exception" disabled={!exc.who} onPress={() => confirm.ask({
          title: "Grant this exception?", pin: true,
          body: `Allow ${staffName(s, exc.who)} to approve a change they recorded or checked at ${siteName} for ${exc.days} ${exc.days === 1 ? "day" : "days"}. Reason: ${excReason}`,
          yes: "Yes, grant it",
          onYes: () => { const r = app.run((e, a) => e.grantOverride(a, { kind: "sod_exception", siteId: site, actorId: exc.who, reason: excReason, days: exc.days })); setError(r.ok ? null : r.error); if (r.ok) app.clearDrafts("exc-"); }
        })} />
        {active.map((o) => (
          <View key={o.id}>
            <Chip tone="wait" text={`Active until ${o.expiresAt.slice(0, 10)}`} />
            <Txt>Exception for {staffName(s, o.actorId!)}: {o.reason}</Txt>
            <Btn label="End it now" kind="secondary" onPress={() => app.run((e, a) => e.revokeOverride(a, o.id))} />
          </View>
        ))}
      </Card>
      <Card>
        <Txt v="heading" header>History for review</Txt>
        <Txt color={c.textMuted}>Every published revision, who approved it, the evidence behind it, and which places are out of date.</Txt>
        <Btn label="Show history" kind="secondary" onPress={() => {
          const r = app.run((e, a) => e.exportHistory(a, site));
          if (r.ok) setExported(JSON.stringify(r.value, null, 1)); else setError(r.error);
        }} />
        {exported ? <Txt v="small" selectable label="History export">{exported}</Txt> : null}
      </Card>
    </>
  );
}

function DemoTools() {
  const app = useStore();
  const s = app.state!;
  const confirm = useConfirm();
  const site = app.siteId;
  return (
    <>
      <DemoStrip text="Demonstration only. These shortcuts fill in the example and are not part of ordinary use. They would not exist in a real kitchen." />
      <Btn label="Fill in the replacement-sauce delivery" kind="secondary" hint="Opens the delivery form with the example filled in" onPress={() => { app.setPrefill({ receive: sauceDelivery(site) }); app.go("receive"); }} />
      <Btn label="Fill in the supplier sheet for the new sauce" kind="secondary" hint="Used in the specification step of a review" onPress={() => { app.setPrefill({ spec: substituteSpecInput(), specProduct: { name: SUB_NAME, supplier: "Fictional Foods Ltd" } }); app.go("review"); }} />
      <Btn label="Jump to: revision 2 published, nobody has acknowledged yet" kind="secondary" hint="Runs the sauce story through the real rules as Alex, Priya and Sam" onPress={() => { const r = app.run((en) => demoPublishSauceRevision(en)); if (r.ok) app.say("Revision 2 is published. Nobody has acknowledged it yet.", "ok"); else app.say(r.error, "bad"); }} />
      <Btn label={app.settings.printerFails ? "Simulated printer failure: ON" : "Simulated printer failure: OFF"} role="checkbox" selected={app.settings.printerFails} kind="secondary" onPress={() => app.setSettings({ printerFails: !app.settings.printerFails })} />
      <Btn label="Move the clock forward 1 day" kind="secondary" onPress={() => app.run((e) => e.advanceClock(86_400_000))} />
      <Txt v="small">The clock only affects when exceptions expire. It is now {new Date(Date.now() + s.clockOffsetMs).toISOString().slice(0, 16).replace("T", " ")}.</Txt>
      <Btn label="Reset to the example kitchen" kind="secondary" onPress={() => confirm.ask({ title: "Reset the example?", body: "This replaces everything in the example with the starting data.", yes: "Yes, reset", onYes: () => { void app.startExample(); } })} />
    </>
  );
}
