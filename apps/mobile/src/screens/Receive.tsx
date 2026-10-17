import React, { useEffect, useRef, useState } from "react";
import { HOLD_NOTICE, canAct, type Delivery, type ReceivingInput } from "@ingredientalert/core";
import { useStore } from "../store";
import { newRequestId } from "../lib";
import { c } from "../theme";
import { Button, Callout, Card, Chip, Field, Screen, Txt } from "../ui";
import { ErrorLine, SwitchHint } from "./shared";

const EMPTY: ReceivingInput = { siteId: "", orderedProductId: "", barcode: "", packSize: "", batchCode: "", labelSpecRef: "", deliveryNoteRef: "" };

export function ReceiveScreen() {
  const { state, site, personaId, go, run, prefill, setPrefill } = useStore();
  const s = state!;
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<ReceivingInput>({ ...EMPTY, siteId: site });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ delivery: Delivery; duplicate: boolean } | null>(null);
  const [queuedNow, setQueuedNow] = useState(false);
  const req = useRef(newRequestId());
  const allowed = canAct(s, personaId, "receive", site);

  useEffect(() => {
    if (prefill.receive) {
      setForm(prefill.receive);
      setStep(2);
      setPrefill({ ...prefill, receive: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = (k: keyof ReceivingInput) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const ordered = s.products.find((p) => p.id === form.orderedProductId);
  const queued = s.outbox.filter((q) => q.siteId === site && q.status === "queued");

  const reset = () => { setForm({ ...EMPTY, siteId: site }); setStep(1); setResult(null); setQueuedNow(false); setError(null); req.current = newRequestId(); };

  if (result || queuedNow) {
    const d = result?.delivery;
    return (
      <Screen title="Delivery recorded" onBack={() => go("home")}>
        {queuedNow ? (
          <Card>
            <Chip kind="wait">Written down, not checked yet</Chip>
            <Txt>Saved on this phone. It has NOT been checked against the approved product, so menus that use it show UNKNOWN until you check it.</Txt>
          </Card>
        ) : d ? (
          <Card>
            {result!.duplicate ? <Chip kind="wait">Already recorded - duplicate ignored</Chip>
              : d.outcome === "review_required" ? <Chip kind="unk">Needs checking</Chip>
              : <Chip kind="ok">{d.outcome === "matched_approved_substitute" ? "Matches an approved substitute" : "Barcode matches the ordered product"}</Chip>}
            {d.outcome === "review_required" ? (
              <>
                <Txt>What arrived does not match what was ordered, or could not be identified:</Txt>
                {d.findings.map((f) => <Txt key={f.kind} color={c.muted}>• {f.message}</Txt>)}
                <Callout kind="unk">{HOLD_NOTICE}</Callout>
              </>
            ) : (
              <Txt color={c.muted}>A barcode only helps find the product. It does not prove what is inside the pack. Check the label as you normally would.</Txt>
            )}
          </Card>
        ) : null}
        {d?.outcome === "review_required" ? <Button label="Go to Check a change" onPress={() => go("review")} /> : null}
        <Button label="Record another delivery" kind="secondary" onPress={reset} />
      </Screen>
    );
  }

  return (
    <Screen title="A delivery has arrived" onBack={() => go("home")}>
      {!allowed && <SwitchHint role="receiving_operator" why="Booking deliveries in is done by the receiving operator." />}
      <ErrorLine msg={error} />
      {step === 1 && (
        <>
          <Txt v="h2" role="header">Step 1 of 3: What did you order?</Txt>
          <Txt color={c.muted}>Pick the product on the order.</Txt>
          {s.products.filter((p) => p.tenantId === state!.sites.find((x) => x.id === site)!.tenantId && p.status === "approved").map((p) => (
            <Button key={p.id} label={p.name} kind="secondary" selected={form.orderedProductId === p.id} onPress={() => setForm({ ...form, orderedProductId: p.id, packSize: form.packSize })} />
          ))}
          <Button label="Next: what is on the pack?" disabled={!form.orderedProductId} onPress={() => setStep(2)} />
        </>
      )}
      {step === 2 && (
        <>
          <Txt v="h2" role="header">Step 2 of 3: What is on the pack?</Txt>
          <Txt color={c.muted}>Ordered: {ordered?.name}. Type what you can read on the pack that actually arrived.</Txt>
          <Field label="Barcode number" value={form.barcode} onChange={set("barcode")} keyboard="numeric" hint="Only helps find the product. It does not prove what is inside." />
          <Field label="Pack size" value={form.packSize} onChange={set("packSize")} hint="For example 1L or 5kg" />
          <Field label="Batch or best-before code" value={form.batchCode} onChange={set("batchCode")} />
          <Field label="Specification version on the pack (if shown)" value={form.labelSpecRef} onChange={set("labelSpecRef")} />
          <Field label="Delivery note number" value={form.deliveryNoteRef} onChange={set("deliveryNoteRef")} />
          <Button label="Next: check and save" onPress={() => setStep(3)} disabled={!form.barcode || !form.packSize || !form.batchCode} />
          <Button label="‹ Previous step" kind="quiet" onPress={() => setStep(1)} />
        </>
      )}
      {step === 3 && (
        <>
          <Txt v="h2" role="header">Step 3 of 3: Check and save</Txt>
          <Card>
            <Txt>Ordered: {ordered?.name}</Txt>
            <Txt>Barcode: {form.barcode}</Txt>
            <Txt>Pack: {form.packSize} · Batch: {form.batchCode}</Txt>
          </Card>
          <Button label="Save and check this delivery" onPress={() => {
            const r = run((e) => e.receiveDelivery(personaId, form, req.current));
            if (r.ok) setResult({ delivery: r.value.delivery, duplicate: r.value.duplicate }); else setError(r.error);
          }} />
          <Txt v="small" color={c.muted}>No signal or no time? Write it down now and check it later. Until it is checked, menus that use this product show UNKNOWN.</Txt>
          <Button label="Write down now, check later" kind="secondary" onPress={() => {
            const r = run((e) => e.queueReceiving(personaId, form, req.current));
            if (r.ok) setQueuedNow(true); else setError(r.error);
          }} />
          <Button label="‹ Previous step" kind="quiet" onPress={() => setStep(2)} />
        </>
      )}
      {queued.length > 0 && step === 1 && (
        <Card>
          <Chip kind="wait">{queued.length} written down, not checked</Chip>
          <Txt>These were saved without being checked.</Txt>
          <Button label="Check them now" kind="secondary" onPress={() => {
            const r = run((e) => e.reconcileOutbox(personaId, site));
            if (!r.ok) setError(r.error); else { setError(null); }
          }} />
        </Card>
      )}
    </Screen>
  );
}
