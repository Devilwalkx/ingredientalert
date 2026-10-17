import React, { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { HOLD_NOTICE, canAct, searchProducts, type Delivery, type ReceivingInput } from "@ingredientalert/core";
import { useStore } from "../store";
import { useDraft, useView } from "../nav";
import { newRequestId, plural } from "../lib";
import { interpretBarcode } from "../scanFlow";
import { Scanner } from "../Scanner";
import { ComparisonTable } from "../components";
import { useTheme } from "../design/theme";
import { space } from "../design/tokens";
import { Btn, Card, Chip, EmptyState, Field, Notice, StatusChip, Txt } from "../ui";
import { ErrorLine, NeedsRole } from "./shared";

type V = { k: "order" } | { k: "arrived" } | { k: "scan" } | { k: "check" } | { k: "result" };

export function DeliverScreen() {
  const app = useStore();
  const c = useTheme();
  const s = app.state!;
  const site = app.siteId;
  const tenant = s.sites.find((x) => x.id === site)!.tenantId;
  const [view, setView] = useView<V>({ k: "order" });
  const [productId, setProductId] = useDraft("recv-product");
  const [query, setQuery] = useState("");
  const [barcode, setBarcode] = useDraft("recv-barcode");
  const [pack, setPack] = useDraft("recv-pack");
  const [batch, setBatch] = useDraft("recv-batch");
  const [label, setLabel] = useDraft("recv-label");
  const [note, setNote] = useDraft("recv-note");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ delivery: Delivery; duplicate: boolean } | null>(null);
  const [queuedNow, setQueuedNow] = useState(false);
  const [scanned, setScanned] = useState(false);
  const req = useRef(newRequestId());
  const allowed = canAct(s, app.actorId!, "receive", site);
  const ordered = s.products.find((p) => p.id === productId);
  const queued = s.outbox.filter((q) => q.siteId === site && q.status === "queued");
  const catalogue = s.products.filter((p) => p.tenantId === tenant && p.status === "approved");

  // demo helper: "Fill in the replacement-sauce delivery" (Settings > Demonstration tools)
  useEffect(() => {
    const r = app.prefill.receive;
    if (r) {
      setProductId(r.orderedProductId); setBarcode(r.barcode); setPack(r.packSize); setBatch(r.batchCode); setLabel(r.labelSpecRef); setNote(r.deliveryNoteRef);
      setView({ k: "arrived" });
      app.setPrefill({ ...app.prefill, receive: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { app.scrollTop(); /* eslint-disable-next-line */ }, [view.k]);
  useEffect(() => { if (view.k === "order") { setResult(null); setQueuedNow(false); req.current = newRequestId(); } }, [view.k]);

  const form: ReceivingInput = { siteId: site, orderedProductId: productId, barcode, packSize: pack, batchCode: batch, labelSpecRef: label, deliveryNoteRef: note };
  const again = () => { app.clearDrafts("recv-"); setResult(null); setQueuedNow(false); setError(null); setScanned(false); setQuery(""); req.current = newRequestId(); setView({ k: "order" }); };
  const lookup = barcode.trim() ? interpretBarcode(s, tenant, barcode) : null;

  if (!allowed) return <NeedsRole role="receiving_operator" why="Booking a delivery in is done by the receiving operator, so the record shows who looked at the pack." />;

  // ---------------------------------------------------------------- result
  if (view.k === "result" && (result || queuedNow)) {
    const d = result?.delivery;
    const cs = d?.caseId ? s.cases.find((x) => x.id === d.caseId) : undefined;
    return (
      <>
        <Txt v="heading" header>{queuedNow ? "Written down" : "Delivery checked"}</Txt>
        {queuedNow ? (
          <Card tone="wait">
            <Chip tone="wait" text="Written down, not checked yet" />
            <Txt>Saved on this device. It has NOT been compared with the approved product. Menus that use it show UNKNOWN until you check it.</Txt>
          </Card>
        ) : d ? (
          <>
            <Card tone={d.outcome === "review_required" ? "unk" : "ok"}>
              {result!.duplicate ? <Chip tone="wait" text="Already recorded: duplicate ignored" />
                : d.outcome === "review_required" ? <StatusChip id="awaiting_specification" />
                : <Chip tone="ok" text={d.outcome === "matched_approved_substitute" ? "Matches an approved substitute" : "Barcode matches the ordered product"} />}
              {d.outcome === "review_required" ? (
                <>
                  <Txt v="heading" header>What arrived does not match what was ordered</Txt>
                  {d.findings.map((f) => <Txt key={f.kind}>• {f.message}</Txt>)}
                  <Notice tone="unk" text={HOLD_NOTICE} />
                </>
              ) : (
                <Txt>A barcode only helps find the product. It does not prove what is inside the pack. Check the label as you normally would.</Txt>
              )}
            </Card>
            {cs ? <Card><Txt v="heading" header>Ordered and arrived, side by side</Txt><ComparisonTable s={s} cs={cs} /></Card> : null}
          </>
        ) : null}
        {d?.outcome === "review_required" && d.caseId ? <Btn label="Review this substitution" icon="change" onPress={() => app.go("review", d.caseId!)} /> : null}
        <Btn label="Check another delivery" kind="secondary" onPress={again} />
      </>
    );
  }

  // ---------------------------------------------------------------- scan
  if (view.k === "scan") {
    return (
      <>
        <Txt v="heading" header>Scan the barcode</Txt>
        <Txt color={c.textMuted}>Ordered: {ordered?.name}. Scan the barcode on the pack that actually arrived.</Txt>
        <Scanner
          validate={(code) => { const o = interpretBarcode(s, tenant, code); return o.kind === "invalid" ? o.reason : null; }}
          onCode={(code) => { setBarcode(code); setScanned(true); setView({ k: "arrived" }); }}
          onManual={() => { setScanned(false); setView({ k: "arrived" }); }}
        />
      </>
    );
  }

  // ---------------------------------------------------------------- step 1: what did you order
  if (view.k === "order") {
    const found = query.trim() ? searchProducts(s, tenant, query) : catalogue.slice(0, 8);
    return (
      <>
        <Txt color={c.textMuted}>Step 1 of 3: what did you order?</Txt>
        <ErrorLine msg={error} />
        {catalogue.length === 0 ? (
          <EmptyState icon="delivery" title="No products yet" body="Add the products you receive, with their supplier specifications, in kitchen setup. Then deliveries can be compared with them." action={<Btn label="Open kitchen setup" onPress={() => app.go("settings", "setup")} />} />
        ) : (
          <>
            <Field label="Search by name, supplier or barcode number" value={query} onChange={setQuery} />
            {found.length === 0 ? <Notice tone="wait" text="No product matches. Check the spelling, or try part of the barcode number." /> : null}
            {found.map((p) => <Btn key={p.id} label={p.name} hint={p.supplier} kind="secondary" role="radio" selected={productId === p.id} onPress={() => setProductId(p.id)} />)}
            {!query.trim() && catalogue.length > 8 ? <Txt v="small" color={c.textMuted}>Showing 8 of {catalogue.length}. Type to search the rest.</Txt> : null}
            <Btn label="Next: what is on the pack?" disabled={!productId} onPress={() => setView({ k: "arrived" })} />
          </>
        )}
        {queued.length > 0 ? (
          <Card tone="wait">
            <Chip tone="wait" text={`${plural(queued.length, "delivery", "deliveries")} written down, not checked`} />
            <Txt>These were saved without being compared with the approved product.</Txt>
            <Btn label="Check them now" kind="secondary" onPress={() => { const r = app.run((e, a) => e.reconcileOutbox(a, site)); if (!r.ok) setError(r.error); else { setError(null); app.say(`${plural(r.value.reconciled, "delivery", "deliveries")} checked; ${r.value.casesOpened} need review.`, "ok"); } }} />
          </Card>
        ) : null}
      </>
    );
  }

  // ---------------------------------------------------------------- step 2: what is on the pack
  if (view.k === "arrived") {
    const spec = ordered ? s.specs.find((x) => x.id === ordered.approvedSpecId) : undefined;
    return (
      <>
        <Txt v="heading" header>What is on the pack?</Txt>
        <Txt color={c.textMuted}>Step 2 of 3. Ordered: {ordered?.name ?? "(nothing chosen)"}. Read the pack that actually arrived.</Txt>
        <Btn label="Scan the barcode" icon="scan" onPress={() => setView({ k: "scan" })} />
        <Field label="Barcode number" value={barcode} onChange={(v) => { setBarcode(v); setScanned(false); }} keyboard="numeric" help="Scanned or typed. It only helps find the product: it does not prove what is inside." />
        {lookup ? (
          lookup.kind === "product" ? <Notice tone={lookup.productId === productId ? "ok" : "wait"} text={`${scanned ? "Scanned. " : ""}This number belongs to: ${lookup.productName}${lookup.productId === productId ? " (the product you ordered)" : " (NOT the product you ordered)"}.`} />
          : lookup.kind === "unknown" ? <Notice tone="wait" text={`${scanned ? "Scanned. " : ""}This number is not in your product list. The delivery will need a review.`} />
          : <Notice tone="bad" text={lookup.reason} />
        ) : null}
        <Field label="Pack size" value={pack} onChange={setPack} help={spec ? `The specification on file says ${spec.packSize}.` : "For example 1L or 5kg."} />
        <Field label="Batch or best-before code" value={batch} onChange={setBatch} />
        <Field label="Specification version on the pack (if shown)" value={label} onChange={setLabel} help={spec ? `On file: ${spec.label}.` : undefined} />
        <Field label="Delivery note number" value={note} onChange={setNote} />
        <Btn label="Next: check and save" disabled={!barcode || !pack || !batch} onPress={() => setView({ k: "check" })} />
        <Btn label="Previous step" kind="quiet" onPress={() => setView({ k: "order" })} />
      </>
    );
  }

  // ---------------------------------------------------------------- step 3: check and save
  return (
    <>
      <Txt v="heading" header>Check and save</Txt>
      <Txt color={c.textMuted}>Step 3 of 3.</Txt>
      <ErrorLine msg={error} />
      <Card>
        <Txt>Ordered: {ordered?.name}</Txt>
        <Txt>Barcode: {barcode}</Txt>
        <Txt>Pack: {pack} · Batch: {batch}</Txt>
        {label ? <Txt>Specification on pack: {label}</Txt> : null}
        {note ? <Txt>Delivery note: {note}</Txt> : null}
      </Card>
      <Btn label="Save and check this delivery" onPress={() => {
        const r = app.run((e, a) => e.receiveDelivery(a, form, req.current));
        if (r.ok) { setResult({ delivery: r.value.delivery, duplicate: r.value.duplicate }); app.clearDrafts("recv-"); setView({ k: "result" }); } else setError(r.error);
      }} />
      <Txt v="small" color={c.textMuted}>No time to check now? Write it down. Until it is checked, menus that use this product show UNKNOWN.</Txt>
      <Btn label="Write down now, check later" kind="secondary" onPress={() => {
        const r = app.run((e, a) => e.queueReceiving(a, form, req.current));
        if (r.ok) { setQueuedNow(true); app.clearDrafts("recv-"); setView({ k: "result" }); } else setError(r.error);
      }} />
      <Btn label="Previous step" kind="quiet" onPress={() => setView({ k: "arrived" })} />
      <View style={{ height: space.xs }} />
      <Btn label="Cancel and clear what I typed" kind="quiet" onPress={again} />
    </>
  );
}
