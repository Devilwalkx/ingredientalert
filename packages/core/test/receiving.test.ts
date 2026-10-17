import { describe, expect, it } from "vitest";
import { ANNEX, MAIN, SUB_BARCODE, barcodeOf, gtinWithCheck, isValidGtin, sauceDelivery, siteStatus, type ReceivingInput } from "../src/index.js";
import { newEngine, receiveSauce, reviewSauce, approveSauce, dish } from "./helpers.js";

const ok = (over: Partial<ReceivingInput> = {}): ReceivingInput => ({
  siteId: MAIN, orderedProductId: "p-teriyaki", barcode: barcodeOf("p-teriyaki"), packSize: "1L", batchCode: "HB0001", labelSpecRef: "TERIYAKI-SPEC-1", deliveryNoteRef: "DN-1", ...over
});

describe("receiving: mismatch against the approved item", () => {
  it("the right product, pack, batch and label gives an identifier match only (no case, no 'verified' claim)", () => {
    const { e } = newEngine();
    const r = e.receiveDelivery("alex", ok(), "r1");
    expect(r.delivery.outcome).toBe("identifier_match");
    expect(r.caseId).toBeNull();
    expect(e.state.cases).toHaveLength(0);
  });

  it("same-looking wrong product: another known product's barcode is caught even though the user picked the ordered one", () => {
    const { e } = newEngine();
    const r = e.receiveDelivery("alex", ok({ barcode: barcodeOf("p-dijon") }), "r1");
    expect(r.delivery.outcome).toBe("review_required");
    expect(r.delivery.findings.map((f) => f.kind)).toContain("barcode_other_product");
    expect(r.delivery.observedProductId).toBe("p-dijon");
    expect(e.state.cases[0]!.state).toBe("review_required");
  });

  it("unknown barcode, mistyped barcode (bad check digit) and unsupported formats all need review", () => {
    const { e } = newEngine();
    expect(e.receiveDelivery("alex", ok({ barcode: SUB_BARCODE, batchCode: "B1" }), "a").delivery.findings[0]!.kind).toBe("unknown_barcode");
    expect(e.receiveDelivery("alex", ok({ barcode: "5010000100151", batchCode: "B2" }), "b").delivery.findings.map((f) => f.kind)).toContain("barcode_invalid");
    expect(e.receiveDelivery("alex", ok({ barcode: "ABC-123", batchCode: "B3" }), "c").delivery.findings.map((f) => f.kind)).toContain("barcode_invalid");
    expect(isValidGtin(barcodeOf("p-teriyaki"))).toBe(true);
    expect(isValidGtin(gtinWithCheck("501000000001"))).toBe(true);
  });

  it("changed pack variant, changed specification label and uncovered batch each open a review", () => {
    const { e } = newEngine();
    expect(e.receiveDelivery("alex", ok({ packSize: "5L", batchCode: "P1" }), "a").delivery.findings.map((f) => f.kind)).toContain("pack_variant_differs");
    expect(e.receiveDelivery("alex", ok({ labelSpecRef: "TERIYAKI-SPEC-2", batchCode: "P2" }), "b").delivery.findings.map((f) => f.kind)).toContain("spec_label_differs");
    const s = structuredClone(e.state);
    s.specs.find((x) => x.id === "spec-p-teriyaki")!.batchCodes = ["ONLY-THIS"];
    const e2 = new (e.constructor as any)(s);
    expect(e2.receiveDelivery("alex", ok({ batchCode: "OTHER" }), "c").delivery.findings.map((f: any) => f.kind)).toContain("batch_not_covered");
  });

  it("an incomplete approved specification is flagged at receiving", () => {
    const { e } = newEngine();
    const s = structuredClone(e.state);
    s.specs.find((x) => x.id === "spec-p-teriyaki")!.contains.lupin = "unknown";
    const e2 = new (e.constructor as any)(s);
    expect(e2.receiveDelivery("alex", ok(), "c").delivery.findings.map((f: any) => f.kind)).toContain("spec_incomplete");
  });

  it("duplicate scan or entry of the same delivery line creates no second record or review", () => {
    const { e } = newEngine();
    const a = e.receiveDelivery("alex", ok({ barcode: SUB_BARCODE }), "r1");
    const b = e.receiveDelivery("alex", ok({ barcode: SUB_BARCODE }), "r2");
    const c = e.receiveDelivery("alex", ok({ barcode: ` ${SUB_BARCODE.slice(0, 5)}-${SUB_BARCODE.slice(5)} ` }), "r3");
    expect(a.duplicate).toBe(false);
    expect(b.duplicate).toBe(true);
    expect(c.duplicate).toBe(true);
    expect(e.state.deliveries).toHaveLength(1);
    expect(e.state.cases).toHaveLength(1);
    // same request id replayed
    expect(e.receiveDelivery("alex", ok({ barcode: SUB_BARCODE }), "r1").delivery.id).toBe(a.delivery.id);
  });

  it("an approved substitute arriving again (same product and covered batch) does not reopen a review, but a different batch-limited one does", () => {
    const { e } = newEngine();
    const caseId = receiveSauce(e);
    reviewSauce(e, caseId);
    approveSauce(e, caseId);
    const again = e.receiveDelivery("alex", sauceDelivery(MAIN), "again");
    expect(again.duplicate).toBe(true); // same delivery line
    const next = e.receiveDelivery("alex", { ...sauceDelivery(MAIN), batchCode: "EG240999", deliveryNoteRef: "DN-6000" }, "next");
    expect(next.delivery.outcome).toBe("matched_approved_substitute");
    expect(next.caseId).toBeNull();
    const changedPack = e.receiveDelivery("alex", { ...sauceDelivery(MAIN), batchCode: "EG1", deliveryNoteRef: "DN-6001", packSize: "5L" }, "pk");
    expect(changedPack.delivery.outcome).toBe("review_required");
  });

  it("requires typed entries and a role", () => {
    const { e } = newEngine();
    expect(() => e.receiveDelivery("alex", ok({ barcode: "" }), "x")).toThrow(/barcode/);
    expect(() => e.receiveDelivery("alex", ok({ batchCode: " " }), "x")).toThrow(/batch/);
    expect(() => e.receiveDelivery("jo", ok(), "x")).toThrow(/permitted/);
    expect(() => e.receiveDelivery("alex", ok({ siteId: ANNEX }), "x")).toThrow(/permitted/);
  });
});

describe("offline receiving (local-only app: write down now, check later)", () => {
  it("queued records are unchecked and keep the affected dishes UNRESOLVED; reconcile opens reviews, once", () => {
    const { e } = newEngine();
    const q = e.queueReceiving("alex", ok({ barcode: SUB_BARCODE }), "off-1");
    expect(e.queueReceiving("alex", ok({ barcode: SUB_BARCODE }), "off-1").id).toBe(q.id);
    expect(e.state.outbox).toHaveLength(1);
    expect(e.state.cases).toHaveLength(0);
    expect(dish(e, "d-salmon").resolved).toBe(false);
    expect(dish(e, "d-salmon").reasons.join(" ")).toMatch(/queued/);
    expect(() => e.preparePublication("sam", MAIN, "p")).toThrow(/blocked/);
    expect(siteStatus(e, MAIN).queued).toBe(1);

    const r = e.reconcileOutbox("alex", MAIN);
    expect(r).toEqual({ reconciled: 1, casesOpened: 1, duplicates: 0 });
    expect(e.state.deliveries[0]!.source).toBe("queued");
    expect(e.state.deliveries[0]!.receivedBy).toBe("alex");
    expect(e.reconcileOutbox("alex", MAIN).reconciled).toBe(0);
    expect(e.state.cases).toHaveLength(1);
    expect(dish(e, "d-salmon").reasons.join(" ")).toMatch(/awaiting review/);
  });

  it("if the approved specification changed after capture, reconcile flags it", () => {
    const { e } = newEngine();
    e.queueReceiving("alex", ok(), "off-2");
    const s = structuredClone(e.state);
    s.products.find((p) => p.id === "p-teriyaki")!.approvedSpecId = "spec-p-flour";
    const e2 = new (e.constructor as any)(s);
    e2.reconcileOutbox("alex", MAIN);
    expect(e2.state.deliveries[0].findings.map((f: any) => f.kind)).toContain("spec_changed_since_capture");
    expect(e2.state.cases).toHaveLength(1);
  });
});
