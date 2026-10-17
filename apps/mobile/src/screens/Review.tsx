import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  ALLERGENS, ALLERGEN_LABEL, HOLD_NOTICE, allUnknownContains, allUnknownPrecaution, canAct, isSpecComplete, kitchenControlLines,
  type Allergen, type ContainsMap, type DeclarationBrief, type Impact, type PrecautionMap, type ReviewCase
} from "@ingredientalert/core";
import { useStore } from "../store";
import { newRequestId, productName, staffName } from "../lib";
import { c, space } from "../theme";
import { AllergenGroups, Button, Callout, Card, Chip, Field, Screen, Section, Txt, useConfirm } from "../ui";
import { ErrorLine, SwitchHint } from "./shared";

const diffText = (b: DeclarationBrief | null, a: DeclarationBrief | null): string => {
  if (!a) return "";
  const add = a.contains.filter((x) => !(b?.contains ?? []).includes(x)).map((x) => `+${ALLERGEN_LABEL[x]}`);
  const rem = (b?.contains ?? []).filter((x) => !a.contains.includes(x)).map((x) => `-${ALLERGEN_LABEL[x]}`);
  const may = a.mayContain.filter((x) => !(b?.mayContain ?? []).includes(x)).map((x) => `+may contain ${ALLERGEN_LABEL[x]}`);
  const all = [...add, ...rem, ...may];
  return all.length ? `Changes: ${all.join(", ")}` : "No change to the allergen information.";
};

const CYCLE_C: Record<string, string> = { unknown: "declared", declared: "not_declared", not_declared: "unknown" };
const CYCLE_P: Record<string, string> = { unknown: "stated", stated: "not_stated", not_stated: "unknown" };
const WORD_C: Record<string, string> = { unknown: "UNKNOWN", declared: "Yes", not_declared: "No" };
const WORD_P: Record<string, string> = { unknown: "UNKNOWN", stated: "Yes", not_stated: "No" };

export function ReviewScreen() {
  const { state, site, personaId, go } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);
  const s = state!;
  const cases = s.cases.filter((x) => x.siteId === site);
  const open = cases.filter((x) => x.state !== "approved" && x.state !== "rejected");
  const done = cases.filter((x) => x.state === "approved" || x.state === "rejected");
  const current = cases.find((x) => x.id === openId);
  void personaId;
  if (current) return <CaseDetail id={current.id} back={() => setOpenId(null)} />;
  return (
    <Screen title="Check a change" onBack={() => go("home")}>
      {open.length === 0 ? (
        <Card><Chip kind="ok">Nothing waiting</Chip><Txt>No deliveries need checking.</Txt></Card>
      ) : open.map((x) => <CaseCard key={x.id} c={x} onOpen={() => setOpenId(x.id)} />)}
      {done.length > 0 && (
        <Section title={`Finished (${done.length})`}>
          {done.map((x) => <CaseCard key={x.id} c={x} onOpen={() => setOpenId(x.id)} />)}
        </Section>
      )}
    </Screen>
  );
}

function CaseCard({ c: cs, onOpen }: { c: ReviewCase; onOpen: () => void }) {
  const { state } = useStore();
  const s = state!;
  const d = s.deliveries.find((x) => x.id === cs.deliveryId)!;
  const st = cs.state === "approved" ? <Chip kind="ok">Approved</Chip> : cs.state === "rejected" ? <Chip kind="bad">Not approved</Chip> : <Chip kind="unk">Waiting for a check</Chip>;
  return (
    <Card>
      {st}
      <Txt v="h2">{productName(s, cs.orderedProductId)}</Txt>
      <Txt color={c.muted}>Arrived: {cs.observedProductId ? productName(s, cs.observedProductId) : "an unidentified product"} (batch {d.batchCode})</Txt>
      <Button label={`Open ${productName(s, cs.orderedProductId)} review`} kind="secondary" onPress={onOpen} />
    </Card>
  );
}

function CaseDetail({ id, back }: { id: string; back: () => void }) {
  const { go } = useStore();
  return (
    <Screen title="Check a change" onBack={() => go("home")}>
      <Button label="‹ All changes" kind="quiet" onPress={back} />
      <CaseBody id={id} />
    </Screen>
  );
}

function CaseBody({ id }: { id: string }) {
  const { state, site, personaId, run, prefill, setPrefill, go } = useStore();
  const s = state!;
  const cs = s.cases.find((x) => x.id === id)!;
  const delivery = s.deliveries.find((d) => d.id === cs.deliveryId)!;
  const spec = cs.specId ? s.specs.find((x) => x.id === cs.specId) ?? null : null;
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const confirm = useConfirm();
  const controls = kitchenControlLines(s.controls, site);

  const step = cs.state === "review_required" ? 1 : cs.state === "spec_attached" ? 2 : cs.state === "impact_reviewed" ? 3 : 4;
  const arrived = cs.observedProductId ? productName(s, cs.observedProductId) : "an unidentified product";

  const approve = () => {
    const impact = cs.impact!;
    const names = impact.items.map((i) => i.name).join(", ");
    confirm.ask({
      title: "Approve this change?",
      body: `Approve "${spec!.label}" of ${productName(s, spec!.productId)} to replace ${productName(s, cs.orderedProductId)} at ${s.sites.find((x) => x.id === site)!.name}? These recipes change: ${names}. This is recorded under your name.`,
      yes: "Yes, approve",
      onYes: () => {
        const r = run((e) => e.approveCase(personaId, cs.id, { expectedVersion: cs.version, specId: cs.specId!, impactDigest: impact.digest, requestId: newRequestId() }));
        setError(r.ok ? null : r.error);
      }
    });
  };
  const reject = () => {
    confirm.ask({
      title: "Do not approve this product?",
      body: `Record that ${arrived} is NOT approved to replace ${productName(s, cs.orderedProductId)}. Reason: ${reason.trim() || "(none written yet)"}`,
      yes: "Yes, not approved",
      onYes: () => {
        const r = run((e) => e.rejectCase(personaId, cs.id, cs.version, reason));
        setError(r.ok ? null : r.error);
      }
    });
  };

  return (
    <>
      <Card>
        {cs.state === "approved" ? <Chip kind="ok">Approved</Chip> : cs.state === "rejected" ? <Chip kind="bad">Not approved</Chip>
          : spec && !isSpecComplete(spec) ? <Chip kind="unk">Still unknown - cannot be used</Chip> : <Chip kind="unk">Waiting for a check</Chip>}
        <Txt v="h2">Ordered: {productName(s, cs.orderedProductId)}</Txt>
        <Txt v="h2">Arrived: {arrived}</Txt>
        {cs.state !== "approved" && cs.state !== "rejected" && <Callout kind="unk">{HOLD_NOTICE}</Callout>}
        <Section title="Details">
          {delivery.findings.map((f) => <Txt key={f.kind} color={c.muted}>• {f.message}</Txt>)}
          <Txt color={c.muted}>Batch {delivery.batchCode} · Pack {delivery.packSize} · Delivery note {delivery.deliveryNoteRef} · Recorded by {staffName(s, delivery.receivedBy)}</Txt>
          {spec && <Txt color={c.muted}>Specification {spec.label} (revision {spec.revision}) · Evidence: {spec.evidence.reference} · Checked by {staffName(s, spec.verifiedBy)}</Txt>}
          {cs.impact && <Txt color={c.muted}>Impact check {cs.impact.digest} by {staffName(s, cs.impact.computedBy)}</Txt>}
          <Txt color={c.muted}>Review number {cs.id}, version {cs.version}.</Txt>
          {cs.events.map((e, i) => <Txt key={i} v="small" color={c.muted}>{staffName(s, e.actorId)}: {e.action}</Txt>)}
        </Section>
      </Card>
      <ErrorLine msg={error} />

      {step === 1 && (canAct(s, personaId, "verify_spec", site)
        ? <SpecForm cs={cs} onDone={(msg) => setError(msg)} prefill={prefill} clearPrefill={() => setPrefill({})} />
        : <SwitchHint role="specification_reviewer" why="Step 1 of 3 is checking the supplier's paperwork for the product that arrived." />)}

      {step >= 2 && spec && (
        <Card>
          <Txt v="h2" role="header">Step 1 of 3: Paperwork</Txt>
          <Chip kind={isSpecComplete(spec) ? "ok" : "unk"}>{isSpecComplete(spec) ? `Checked by ${staffName(s, spec.verifiedBy)}` : "Incomplete - some answers UNKNOWN"}</Chip>
          <Txt color={c.muted}>Source: {spec.evidence.reference}</Txt>
          <Section title="Allergens">
            <AllergenGroups d={{ contains: ALLERGENS.filter((a) => spec.contains[a] === "declared"), mayContain: ALLERGENS.filter((a) => spec.precautionary[a] === "stated"), unresolved: ALLERGENS.filter((a) => spec.contains[a] === "unknown" || spec.precautionary[a] === "unknown"), resolved: isSpecComplete(spec) }} controls={controls} />
          </Section>
        </Card>
      )}

      {step === 2 && (canAct(s, personaId, "review_impact", site)
        ? (
          <Card>
            <Txt v="h2" role="header">Step 2 of 3: Which recipes change?</Txt>
            <Txt color={c.muted}>Looks through every recipe, including recipes inside recipes, at this kitchen.</Txt>
            <Button label="Show which recipes change" onPress={() => { const r = run((e) => e.reviewImpact(personaId, cs.id, cs.version)); setError(r.ok ? null : r.error); }} />
          </Card>
        )
        : <SwitchHint role="specification_reviewer" why="Step 2 of 3 is looking at which recipes are affected." />)}

      {step >= 3 && cs.impact && <ImpactList impact={cs.impact} controls={controls} />}

      {step === 3 && cs.impact && (canAct(s, personaId, "approve_case", site) ? (
        <Card>
          <Txt v="h2" role="header">Step 3 of 3: Approve</Txt>
          {spec && isSpecComplete(spec) ? (
            <>
              <Chip kind="ok">Ready to approve</Chip>
              <Txt>A different person from whoever booked the delivery in or checked the paperwork must approve a change like this.</Txt>
              <Button label="Approve this change" onPress={approve} />
            </>
          ) : (
            <>
              <Chip kind="unk">Still unknown - cannot be used</Chip>
              <Txt>Some answers are UNKNOWN. A product with unknown allergen answers cannot be approved. Get the missing information from the supplier.</Txt>
            </>
          )}
          <Field label="Reason, if you do not approve" value={reason} onChange={setReason} />
          <Button label="Do not approve this product" kind="secondary" onPress={reject} />
        </Card>
      ) : <SwitchHint role="publication_approver" why="Step 3 of 3 is approving the exact change you have just seen." />)}

      {step === 4 && (
        <Card>
          {cs.state === "approved" ? (
            <>
              <Chip kind="ok">Approved by {staffName(s, cs.decision!.by)}</Chip>
              <Txt>The new allergen information is not on any menu yet. Publish it next.</Txt>
              <Button label="Go to Publish menu updates" onPress={() => go("publish")} />
            </>
          ) : (
            <>
              <Chip kind="bad">Not approved</Chip>
              <Txt>Recorded: {cs.events[cs.events.length - 1]?.note}. Handle the physical stock using your kitchen's own procedure.</Txt>
            </>
          )}
        </Card>
      )}
    </>
  );
}

function ImpactList({ impact, controls }: { impact: Impact; controls: string[] }) {
  return (
    <View style={{ gap: space.s }}>
      <Txt v="h2" role="header">Recipes that change ({impact.items.length})</Txt>
      {impact.items.map((i) => (
        <Card key={i.recipeId}>
          <Txt bold>{i.name}{i.kind === "component" ? " (part of other recipes)" : ""}</Txt>
          <Txt color={c.muted}>{i.path.join(" › ")}</Txt>
          {i.after && !i.after.resolved ? <Chip kind="unk">Still unknown</Chip> : <Chip kind="wait">Will change</Chip>}
          <Txt>{diffText(i.before, i.after)}</Txt>
          {i.after && <Section title="Allergens after the change"><AllergenGroups d={i.after} controls={controls} /></Section>}
        </Card>
      ))}
    </View>
  );
}

function SpecForm({ cs, onDone, prefill, clearPrefill }: { cs: ReviewCase; onDone: (err: string | null) => void; prefill: ReturnType<typeof useStore>["prefill"]; clearPrefill: () => void }) {
  const { personaId, run } = useStore();
  const [name, setName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [label, setLabel] = useState("");
  const [pack, setPack] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [evidence, setEvidence] = useState("");
  const [note, setNote] = useState("");
  const [contains, setContains] = useState<ContainsMap>(allUnknownContains());
  const [prec, setPrec] = useState<PrecautionMap>(allUnknownPrecaution());
  const needsProduct = !cs.observedProductId;
  const unknownCount = ALLERGENS.filter((a) => contains[a] === "unknown" || prec[a] === "unknown").length;

  useEffect(() => {
    if (prefill.spec) {
      const p = prefill.spec;
      setLabel(p.label); setPack(p.packSize); setIngredients(p.ingredientsText); setEvidence(p.evidenceReference); setNote(p.evidenceNote);
      setContains(p.contains); setPrec(p.precautionary);
      if (prefill.specProduct) { setName(prefill.specProduct.name); setSupplier(prefill.specProduct.supplier); }
      clearPrefill();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <Txt v="h2" role="header">Step 1 of 3: Check the paperwork</Txt>
      <Txt color={c.muted}>Copy what the supplier's specification sheet says. Leave anything the sheet does not say as UNKNOWN. Never guess from the product name.</Txt>
      {needsProduct && <Field label="Product name" value={name} onChange={setName} />}
      {needsProduct && <Field label="Supplier" value={supplier} onChange={setSupplier} />}
      <Field label="Specification version (from the sheet)" value={label} onChange={setLabel} />
      <Field label="Pack size" value={pack} onChange={setPack} />
      <Field label="Ingredients, as written on the sheet" value={ingredients} onChange={setIngredients} multiline />
      <Field label="Where this came from" value={evidence} onChange={setEvidence} hint="For example: supplier specification sheet number and page" />
      <Field label="Note (optional)" value={note} onChange={setNote} />
      <Section title={`Allergens (${unknownCount === 0 ? "all answered" : `${unknownCount} still UNKNOWN`})`}>
        <Txt color={c.muted}>For each one: does the sheet say it is an ingredient (Contains), and does the supplier add a "may contain" warning? Tap to change.</Txt>
        {ALLERGENS.map((a: Allergen) => (
          <View key={a} style={{ gap: 6 }}>
            <Txt bold>{ALLERGEN_LABEL[a]}</Txt>
            <Button kind="secondary" label={`Contains: ${WORD_C[contains[a]]}`} hint={ALLERGEN_LABEL[a]} onPress={() => setContains({ ...contains, [a]: CYCLE_C[contains[a]] as ContainsMap[Allergen] })} />
            <Button kind="secondary" label={`May contain: ${WORD_P[prec[a]]}`} hint={ALLERGEN_LABEL[a]} onPress={() => setPrec({ ...prec, [a]: CYCLE_P[prec[a]] as PrecautionMap[Allergen] })} />
          </View>
        ))}
      </Section>
      {unknownCount > 0 && <Callout kind="unk">{unknownCount} answers are UNKNOWN - this can be saved, but it cannot be approved or used on a menu.</Callout>}
      <Button label="Save paperwork check" onPress={() => {
        const r = run((e) => e.verifySpecification(personaId, cs.id, cs.version, {
          newProduct: needsProduct ? { name, supplier } : undefined,
          spec: { label, packSize: pack, batchCodes: null, ingredientsText: ingredients, contains, precautionary: prec, evidenceReference: evidence, evidenceNote: note }
        }));
        onDone(r.ok ? null : r.error);
      }} />
    </Card>
  );
}
