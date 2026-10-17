import React, { useEffect, useState } from "react";
import { View } from "react-native";
import {
  ALLERGENS, ALLERGEN_LABEL, HOLD_NOTICE, affectedScope, canAct, caseStatus, isSpecComplete, kitchenControlLines,
  type Allergen, type ContainsMap, type DeclarationBrief, type Impact, type PrecautionMap, type ReviewCase
} from "@ingredientalert/core";
import { useStore } from "../store";
import { useDraft, useView } from "../nav";
import { useConfirm } from "../confirm";
import { newRequestId, productName, staffName } from "../lib";
import { AllergenEditor, AllergenGroups, ComparisonTable, ScopeBlock, unknownCountOf, unknownMaps, type Maps } from "../components";
import { useTheme } from "../design/theme";
import { Btn, Card, Chip, Collapsible, EmptyState, Field, Notice, StatusChip, Txt } from "../ui";
import { ErrorLine, NeedsRole } from "./shared";

const diffText = (b: DeclarationBrief | null, a: DeclarationBrief | null): string => {
  if (!a) return "";
  const add = a.contains.filter((x) => !(b?.contains ?? []).includes(x)).map((x) => `now contains ${ALLERGEN_LABEL[x]}`);
  const rem = (b?.contains ?? []).filter((x) => !a.contains.includes(x)).map((x) => `no longer contains ${ALLERGEN_LABEL[x]}`);
  const may = a.mayContain.filter((x) => !(b?.mayContain ?? []).includes(x)).map((x) => `new supplier warning: may contain ${ALLERGEN_LABEL[x]}`);
  const all = [...add, ...rem, ...may];
  return all.length ? `Changes: ${all.join("; ")}.` : "No change to the allergen information.";
};

type V = { k: "list" } | { k: "case"; id: string };

export function ReviewScreen() {
  const app = useStore();
  const s = app.state!;
  const [view, setView] = useView<V>({ k: "list" });
  useEffect(() => { const p = app.takeParam(); if (p && s.cases.some((x) => x.id === p)) setView({ k: "case", id: p }); /* eslint-disable-next-line */ }, []);
  useEffect(() => { app.scrollTop(); /* eslint-disable-next-line */ }, [view.k]);
  const cases = s.cases.filter((x) => x.siteId === app.siteId);
  const open = cases.filter((x) => x.state !== "approved" && x.state !== "rejected");
  const done = cases.filter((x) => x.state === "approved" || x.state === "rejected");
  if (view.k === "case" && cases.some((x) => x.id === view.id)) return <CaseBody id={view.id} />;
  return (
    <>
      {open.length === 0 ? (
        <EmptyState icon="ok" title="Nothing waiting for review" body="When a delivery does not match what was ordered, it appears here until a specification is entered, the affected recipes are checked and a named approver decides." />
      ) : open.map((x) => <CaseCard key={x.id} cs={x} onOpen={() => setView({ k: "case", id: x.id })} />)}
      {done.length > 0 ? <Collapsible title={`Finished (${done.length})`}>{done.map((x) => <CaseCard key={x.id} cs={x} onOpen={() => setView({ k: "case", id: x.id })} />)}</Collapsible> : null}
    </>
  );
}

function StatusFor({ cs, incomplete }: { cs: ReviewCase; incomplete?: boolean }) {
  const st = caseStatus(cs);
  if (st === "not_approved") return <Chip tone="bad" text="Not approved" />;
  if (st === "approved_revision") return <StatusChip id="approved_revision" />;
  return <StatusChip id={st} extra={incomplete ? "some answers UNKNOWN" : undefined} />;
}

function CaseCard({ cs, onOpen }: { cs: ReviewCase; onOpen: () => void }) {
  const s = useStore().state!;
  const d = s.deliveries.find((x) => x.id === cs.deliveryId)!;
  const spec = cs.specId ? s.specs.find((x) => x.id === cs.specId) : undefined;
  return (
    <Card>
      <StatusFor cs={cs} incomplete={!!spec && !isSpecComplete(spec)} />
      <Txt v="heading">{productName(s, cs.orderedProductId)}</Txt>
      <Txt>Arrived: {cs.observedProductId ? productName(s, cs.observedProductId) : "an unidentified product"} (batch {d.batchCode})</Txt>
      <Btn label={`Open review: ${productName(s, cs.orderedProductId)}`} kind="secondary" onPress={onOpen} />
    </Card>
  );
}

function CaseBody({ id }: { id: string }) {
  const app = useStore();
  const c = useTheme();
  const s = app.state!;
  const site = app.siteId;
  const actor = app.actorId!;
  const cs = s.cases.find((x) => x.id === id)!;
  const delivery = s.deliveries.find((d) => d.id === cs.deliveryId)!;
  const spec = cs.specId ? s.specs.find((x) => x.id === cs.specId) ?? null : null;
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useDraft(`reject-${id}`);
  const confirm = useConfirm();
  const controls = kitchenControlLines(s.controls, site);
  const step = cs.state === "review_required" ? 1 : cs.state === "spec_attached" ? 2 : cs.state === "impact_reviewed" ? 3 : 4;
  const arrived = cs.observedProductId ? productName(s, cs.observedProductId) : "an unidentified product";
  const ordered = productName(s, cs.orderedProductId);
  const open = cs.state !== "approved" && cs.state !== "rejected";
  const scope = affectedScope(s, cs);
  useEffect(() => { app.scrollTop(); /* eslint-disable-next-line */ }, [cs.version]);

  const approve = () => {
    const impact = cs.impact!;
    confirm.ask({
      title: "Approve this change?",
      body: `Approve "${spec!.label}" of ${productName(s, spec!.productId)} to replace ${ordered} at ${scope.siteName}. These recipes are affected: ${impact.items.map((i) => i.name).join(", ")}. It is recorded under your name, ${staffName(s, actor)}, and it is not on any menu until it is published.`,
      yes: "Yes, approve", pin: true,
      onYes: () => {
        const r = app.run((e, a) => e.approveCase(a, cs.id, { expectedVersion: cs.version, specId: cs.specId!, impactDigest: impact.digest, requestId: newRequestId() }));
        setError(r.ok ? null : r.error);
        if (r.ok) app.say("Approved. Not on any menu yet: publish it next.", "ok");
      }
    });
  };
  const reject = () => confirm.ask({
    title: "Do not approve this product?",
    body: `Record that ${arrived} is NOT approved to replace ${ordered}. Reason: ${reason.trim() || "(none written yet)"}`,
    yes: "Yes, not approved", danger: true, pin: true,
    onYes: () => { const r = app.run((e, a) => e.rejectCase(a, cs.id, cs.version, reason)); setError(r.ok ? null : r.error); if (r.ok) app.clearDrafts(`reject-${id}`); }
  });

  return (
    <>
      <Card>
        <StatusFor cs={cs} incomplete={!!spec && !isSpecComplete(spec)} />
        <Txt v="heading">Ordered: {ordered}</Txt>
        <Txt v="heading">Arrived: {arrived}</Txt>
        {open ? <Notice tone="unk" text={HOLD_NOTICE} /> : null}
      </Card>
      <ErrorLine msg={error} />

      {/* NEXT STEP: the action for whoever is signed in comes before the evidence */}
      {step === 1 && (canAct(s, actor, "verify_spec", site)
        ? <SpecForm cs={cs} onError={setError} />
        : <NeedsRole role="specification_reviewer" why="Step 1 of 3 is entering the supplier's specification for the product that arrived." />)}

      {step === 2 && (canAct(s, actor, "review_impact", site)
        ? (
          <Card>
            <Txt v="heading" header>Step 2 of 3: which recipes change?</Txt>
            <Txt color={c.textMuted}>Looks through every recipe, including recipes inside recipes, at this kitchen.</Txt>
            <Btn label="Show which recipes change" onPress={() => { const r = app.run((e, a) => e.reviewImpact(a, cs.id, cs.version)); setError(r.ok ? null : r.error); }} />
          </Card>
        ) : <NeedsRole role="specification_reviewer" why="Step 2 of 3 is looking at which recipes are affected." />)}

      {step === 3 && cs.impact && (canAct(s, actor, "approve_case", site) ? (
        <Card>
          <Txt v="heading" header>Step 3 of 3: decide</Txt>
          {spec && isSpecComplete(spec) ? (
            <>
              <Chip tone="ok" text="Specification complete: ready for a decision" />
              <Txt>A different person from whoever booked the delivery in or entered the specification must approve a change like this. The app checks this when you confirm.</Txt>
              <Btn label="Approve this change" onPress={approve} />
            </>
          ) : (
            <>
              <Chip tone="unk" text="Still unknown: cannot be approved" />
              <Txt>Some answers are UNKNOWN. A product with unknown allergen answers cannot be approved. Get the missing information from the supplier.</Txt>
            </>
          )}
          <Field label="Reason, if you do not approve" value={reason} onChange={setReason} />
          <Btn label="Do not approve this product" kind="secondary" onPress={reject} />
        </Card>
      ) : <NeedsRole role="publication_approver" why="Step 3 of 3 is approving the exact change you have just seen." />)}

      {step === 4 && (
        <Card tone={cs.state === "approved" ? "ok" : "bad"}>
          {cs.state === "approved" ? (
            <>
              <StatusChip id="approved_revision" extra={`by ${staffName(s, cs.decision!.by)}`} />
              <Txt>The new allergen information is not on any menu yet. It becomes "Publication incomplete" until every place is updated.</Txt>
              <Btn label="Go to publication updates" icon="progress" onPress={() => app.go("publish")} />
            </>
          ) : (
            <>
              <Chip tone="bad" text="Not approved" />
              <Txt>Recorded: {cs.events[cs.events.length - 1]?.note}. Handle the physical stock using your kitchen's own procedure.</Txt>
            </>
          )}
        </Card>
      )}

      {cs.impact ? <ImpactList impact={cs.impact} controls={controls} /> : null}

      <Collapsible defaultOpen title="Ordered and arrived, side by side"><ComparisonTable s={s} cs={cs} /></Collapsible>

      <Collapsible defaultOpen title="What this change touches"><ScopeBlock a={scope} /></Collapsible>

      {spec ? (
        <Collapsible defaultOpen title="Allergen information on the new specification">
          <Chip tone={isSpecComplete(spec) ? "ok" : "unk"} text={isSpecComplete(spec) ? `Entered by ${staffName(s, spec.verifiedBy)}` : "Incomplete: some answers UNKNOWN"} />
          <Txt color={c.textMuted}>Source: {spec.evidence.reference}</Txt>
          <AllergenGroups d={{ contains: ALLERGENS.filter((a) => spec.contains[a] === "declared"), mayContain: ALLERGENS.filter((a) => spec.precautionary[a] === "stated"), unresolved: ALLERGENS.filter((a) => spec.contains[a] === "unknown" || spec.precautionary[a] === "unknown"), resolved: isSpecComplete(spec) }} controls={controls} />
        </Collapsible>
      ) : null}

      <Collapsible title="Approval trail">
        {delivery.findings.map((f) => <Txt key={f.kind} color={c.textMuted}>• {f.message}</Txt>)}
        <Txt color={c.textMuted}>Batch {delivery.batchCode} · Pack {delivery.packSize} · Delivery note {delivery.deliveryNoteRef || "none"} · Recorded by {staffName(s, delivery.receivedBy)}</Txt>
        {spec ? <Txt color={c.textMuted}>Specification {spec.label} (revision {spec.revision}) · Evidence: {spec.evidence.reference} · Entered by {staffName(s, spec.verifiedBy)}</Txt> : null}
        {cs.impact ? <Txt color={c.textMuted}>Impact check {cs.impact.digest} by {staffName(s, cs.impact.computedBy)}</Txt> : null}
        <Txt color={c.textMuted}>Review {cs.id}, version {cs.version}.</Txt>
        {cs.events.map((e, i) => <Txt key={i} v="small" color={c.textMuted}>{staffName(s, e.actorId)}: {e.action}</Txt>)}
      </Collapsible>
    </>
  );
}

function ImpactList({ impact, controls }: { impact: Impact; controls: string[] }) {
  const c = useTheme();
  return (
    <View>
      <Txt v="heading" header>Recipes that change ({impact.items.length})</Txt>
      {impact.items.map((i) => (
        <Card key={i.recipeId}>
          <Txt v="label">{i.name}{i.kind === "component" ? " (used inside other recipes)" : ""}</Txt>
          <Txt v="small" color={c.textMuted}>{i.path.join(" › ")}</Txt>
          {i.after && !i.after.resolved ? <Chip tone="unk" text="Still unknown" /> : <Chip tone="wait" text="Will change" />}
          <Txt>{diffText(i.before, i.after)}</Txt>
          {i.after ? <Collapsible title={`Allergens after the change: ${i.name}`}><AllergenGroups d={i.after} controls={controls} /></Collapsible> : null}
        </Card>
      ))}
    </View>
  );
}

function SpecForm({ cs, onError }: { cs: ReviewCase; onError: (err: string | null) => void }) {
  const app = useStore();
  const c = useTheme();
  const k = (n: string) => `spec-${cs.id}-${n}`;
  const [name, setName] = useDraft(k("name"));
  const [supplier, setSupplier] = useDraft(k("supplier"));
  const [label, setLabel] = useDraft(k("label"));
  const [pack, setPack] = useDraft(k("pack"));
  const [ingredients, setIngredients] = useDraft(k("ingredients"));
  const [evidence, setEvidence] = useDraft(k("evidence"));
  const [note, setNote] = useDraft(k("note"));
  const [mapsRaw, setMapsRaw] = useDraft(k("maps"));
  const maps: Maps = mapsRaw ? (JSON.parse(mapsRaw) as Maps) : unknownMaps();
  const setMaps = (m: Maps) => setMapsRaw(JSON.stringify(m));
  const needsProduct = !cs.observedProductId;
  const unknownCount = unknownCountOf(maps);

  useEffect(() => {
    const p = app.prefill.spec;
    if (p) {
      setLabel(p.label); setPack(p.packSize); setIngredients(p.ingredientsText); setEvidence(p.evidenceReference); setNote(p.evidenceNote);
      setMaps({ c: p.contains, p: p.precautionary });
      if (app.prefill.specProduct) { setName(app.prefill.specProduct.name); setSupplier(app.prefill.specProduct.supplier); }
      app.setPrefill({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card>
      <Txt v="heading" header>Step 1 of 3: enter the supplier's specification</Txt>
      <Txt color={c.textMuted}>Copy what the specification sheet says. Leave anything the sheet does not say as UNKNOWN. Never guess from the product name.</Txt>
      {needsProduct ? <Field label="Product name" value={name} onChange={setName} /> : null}
      {needsProduct ? <Field label="Supplier" value={supplier} onChange={setSupplier} /> : null}
      <Field label="Specification version (from the sheet)" value={label} onChange={setLabel} />
      <Field label="Pack size" value={pack} onChange={setPack} />
      <Field label="Ingredients, as written on the sheet" value={ingredients} onChange={setIngredients} multiline />
      <Field label="Where this came from" value={evidence} onChange={setEvidence} help="For example: supplier specification sheet number and page" />
      <Field label="Note (optional)" value={note} onChange={setNote} />
      <Collapsible title={`Allergens (${unknownCount === 0 ? "all answered" : `${unknownCount} still UNKNOWN`})`}>
        <AllergenEditor maps={maps} setMaps={setMaps} />
      </Collapsible>
      {unknownCount > 0 ? <Notice tone="unk" text={`${unknownCount} answers are UNKNOWN. This can be saved, but it cannot be approved or used on a menu.`} /> : null}
      <Btn label="Save specification" onPress={() => {
        const r = app.run((e, a) => e.verifySpecification(a, cs.id, cs.version, {
          newProduct: needsProduct ? { name, supplier } : undefined,
          spec: { label, packSize: pack, batchCodes: null, ingredientsText: ingredients, contains: maps.c, precautionary: maps.p, evidenceReference: evidence, evidenceNote: note }
        }));
        onError(r.ok ? null : r.error);
        if (r.ok) app.clearDrafts(`spec-${cs.id}`);
      }} />
    </Card>
  );
}
