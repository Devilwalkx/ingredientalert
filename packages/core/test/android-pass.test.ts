import { describe, expect, it } from "vitest";
import {
  Engine, MAIN, STATUS_LABEL, affectedScope, allUnknownContains, allUnknownPrecaution, caseStatus, checkPin, deliveryComparison, gtinWithCheck,
  lockoutMs, makePinRecord, ownKitchenState, searchProducts, specMaps, statusItems, validatePin, verifyAuditChain, barcodeOf, sauceDelivery, canAct
} from "../src/index.js";
import { approveSauce, newEngine, receiveSauce, reviewSauce, caseVersion } from "./helpers.js";

describe("PIN for a shared device", () => {
  it("accepts a good PIN and rejects a wrong one; the record never contains the PIN", () => {
    const rec = makePinRecord("481516");
    expect(checkPin(rec, "481516")).toBe(true);
    expect(checkPin(rec, "481517")).toBe(false);
    expect(checkPin(rec, "")).toBe(false);
    expect(JSON.stringify(rec)).not.toContain("481516");
  });
  it("hashing cost on this machine is reported (a JavaScript runtime on a real tablet will differ and is NOT measured)", () => {
    const t0 = performance.now();
    const rec = makePinRecord("481516");
    const make = performance.now() - t0;
    const t1 = performance.now();
    checkPin(rec, "481516");
    const check = performance.now() - t1;
    console.log(`PIN scrypt N=4096: make ${make.toFixed(0)} ms, check ${check.toFixed(0)} ms`);
    expect(make).toBeLessThan(3000);
  });
  it("two records for the same PIN differ (random salt)", () => {
    expect(makePinRecord("481516").hash).not.toBe(makePinRecord("481516").hash);
  });
  it("rejects weak or malformed PINs", () => {
    for (const bad of ["123", "1234567", "abcd", "0000", "1111", "1234", "4321", "123456", "12 34", ""]) expect(validatePin(bad), bad).not.toBeNull();
    for (const ok of ["4815", "2580", "908172"]) expect(validatePin(ok), ok).toBeNull();
    expect(() => makePinRecord("1234")).toThrow();
  });
  it("throttles guessing: none for the first two failures, then growing waits", () => {
    expect([0, 1, 2].map(lockoutMs)).toEqual([0, 0, 0]);
    expect(lockoutMs(3)).toBeGreaterThan(0);
    expect(lockoutMs(6)).toBeGreaterThan(lockoutMs(3));
    expect(lockoutMs(9)).toBeGreaterThan(lockoutMs(6));
  });
  it("the PIN verifier is stored in sealed state with an audit event that does not contain the PIN", () => {
    const { e } = newEngine();
    e.setPin("alex", "alex", "481516");
    expect(Object.keys(e.state.pins!)).toEqual(["alex"]);
    expect(JSON.stringify(e.state)).not.toContain("481516");
    expect(e.state.audit.at(-1)!.action).toBe("pin.set");
    expect(verifyAuditChain(e.state)).toBe(true);
  });
  it("only the person themselves or an administrator can set a PIN; others cannot", () => {
    const { e } = newEngine();
    expect(() => e.setPin("alex", "sam", "481516")).toThrow();
    expect(() => e.setPin("morgan", "sam", "481516")).not.toThrow();
    expect(() => e.setPin("omar", "alex", "481516")).toThrow(); // other tenant
  });
});

describe("status vocabulary", () => {
  it("has the five exact words", () => {
    expect(Object.values(STATUS_LABEL)).toEqual(["Awaiting specification", "Awaiting review", "Approved revision", "Publication incomplete", "Staff acknowledgement outstanding"]);
  });
  it("walks Awaiting specification -> Awaiting review -> Approved revision -> Publication incomplete -> Staff acknowledgement outstanding, with real counts only", () => {
    const { e } = newEngine();
    expect(statusItems(e, MAIN)).toEqual([]);
    const id = receiveSauce(e);
    expect(caseStatus(e.state.cases[0]!)).toBe("awaiting_specification");
    expect(statusItems(e, MAIN).map((x) => [x.id, x.count])).toEqual([["awaiting_specification", 1]]);
    reviewSauce(e, id);
    expect(caseStatus(e.state.cases[0]!)).toBe("awaiting_review");
    expect(statusItems(e, MAIN).map((x) => x.id)).toEqual(["awaiting_review"]);
    approveSauce(e, id);
    expect(caseStatus(e.state.cases[0]!)).toBe("approved_revision");
    expect(statusItems(e, MAIN).map((x) => x.id)).toEqual(["publication_incomplete"]);
    const { publication } = e.preparePublication("sam", MAIN, "p1");
    expect(statusItems(e, MAIN).map((x) => x.id)).toEqual(["publication_incomplete"]);
    e.publishChannel("sam", publication.id, "qr_web", "c1");
    e.publishChannel("sam", publication.id, "printed_menu", "c2");
    expect(statusItems(e, MAIN).map((x) => x.id)).toEqual(["publication_incomplete"]);
    e.publishChannel("sam", publication.id, "service_view", "c3");
    expect(statusItems(e, MAIN).map((x) => [x.id, x.count])).toEqual([["ack_outstanding", 2]]);
    e.acknowledge("jo", publication.id, 2);
    expect(statusItems(e, MAIN).map((x) => [x.id, x.count])).toEqual([["ack_outstanding", 1]]);
    e.acknowledge("jess", publication.id, 2);
    expect(statusItems(e, MAIN)).toEqual([]);
  });
  it("a rejected case is never called approved", () => {
    const { e } = newEngine();
    const id = receiveSauce(e);
    e.rejectCase("priya", id, caseVersion(e, id), "Not the right product");
    expect(caseStatus(e.state.cases[0]!)).toBe("not_approved");
  });
  it("a notification is not an acknowledgement: nothing in the engine records an acknowledgement except the person acting", () => {
    const { e } = newEngine();
    const id = receiveSauce(e); reviewSauce(e, id); approveSauce(e, id);
    const { publication } = e.preparePublication("sam", MAIN, "p1");
    for (const ch of ["qr_web", "service_view", "printed_menu"] as const) e.publishChannel("sam", publication.id, ch, `c-${ch}`);
    expect(() => e.acknowledge("sam", publication.id, 2)).toThrow(); // approver cannot acknowledge for staff
    expect(e.state.acks.filter((a) => a.revision === 2)).toHaveLength(0);
  });
});

describe("delivery comparison and affected scope", () => {
  it("shows expected and delivered side by side and flags the differences in text terms", () => {
    const { e } = newEngine();
    const id = receiveSauce(e);
    const c = e.state.cases[0]!;
    const before = deliveryComparison(e.state, c);
    const byField = (n: string) => before.rows.find((r) => r.field === n)!;
    expect(byField("Product").differs).toBe(true);
    expect(byField("Product").delivered).toBe("Not identified");
    expect(byField("Pack size").differs).toBe(false);
    expect(byField("Specification version").differs).toBe(true);
    expect(before.allergenRows!.deliveredContains).toMatch(/Not known/);
    reviewSauce(e, id);
    const after = deliveryComparison(e.state, e.state.cases[0]!);
    expect(after.rows.find((r) => r.field === "Product")!.delivered).toMatch(/Eastern Glaze/);
    expect(after.allergenRows!.deliveredContains).toContain("Sesame");
    expect(after.allergenRows!.expectedContains).not.toContain("Sesame");
    expect(after.allergenRows!.deliveredMay).toContain("Peanuts");
    // contains and may-contain are different fields
    expect(after.allergenRows!.deliveredContains).not.toContain("Peanuts");
  });
  it("names the affected recipes, the site, other sites that are NOT changed, and all three channels", () => {
    const { e } = newEngine();
    const id = receiveSauce(e); reviewSauce(e, id);
    const a = affectedScope(e.state, e.state.cases[0]!);
    expect(a.recipes.map((r) => r.name).sort()).toEqual(["Glazed chicken rice", "Glazed salmon bowl", "House glaze"]);
    expect(a.siteName).toBe("Main kitchen");
    expect(a.otherSites).toEqual(["Annex kitchen"]);
    expect(a.channels.map((c) => c.channel)).toEqual(["qr_web", "service_view", "printed_menu"]);
  });
});

describe("manual product search (scan fallback)", () => {
  it("finds by name, supplier, partial barcode, and never across kitchens", () => {
    const { e } = newEngine();
    const s = e.state;
    expect(searchProducts(s, "tenant-1", "teriyaki").map((p) => p.id)).toContain("p-teriyaki");
    expect(searchProducts(s, "tenant-1", "harbour sauce").map((p) => p.id)).toEqual(["p-teriyaki"]);
    expect(searchProducts(s, "tenant-1", barcodeOf("p-flour"))[0]!.id).toBe("p-flour");
    expect(searchProducts(s, "tenant-1", barcodeOf("p-flour").slice(0, 10)).length).toBeGreaterThan(0);
    expect(searchProducts(s, "tenant-1", "other group")).toEqual([]);
    expect(searchProducts(s, "tenant-1", "")).toEqual([]);
    expect(searchProducts(s, "tenant-1", "zzzz")).toEqual([]);
  });
});

describe("own kitchen: set up, add people and a product, receive a delivery", () => {
  it("works end to end without any example data, and roles stay separate", () => {
    const { state, ownerId, siteId } = ownKitchenState({ kitchenName: "Test Cafe", siteName: "Cafe", ownerName: "Pat" });
    const e = new Engine(state);
    expect(state.synthetic).toBeUndefined();
    expect(verifyAuditChain(e.state)).toBe(true);
    const rid = e.addStaff(ownerId, { name: "Robin", grants: [{ role: "specification_reviewer", siteId }, { role: "receiving_operator", siteId }] });
    expect(canAct(e.state, rid, "manage_catalogue", siteId)).toBe(true);
    expect(canAct(e.state, rid, "approve_case", siteId)).toBe(false);
    const m = specMaps(["milk"], ["tree_nuts"]);
    const bc = gtinWithCheck("501234567890");
    const { productId } = e.addProduct(rid, { siteId, name: "Oat drink 1L", supplier: "Test Supplier", barcode: bc, spec: { label: "OD-1", packSize: "1L", batchCodes: null, ingredientsText: "Oats, water", contains: m.contains, precautionary: m.precautionary, evidenceReference: "Sheet OD-1 p2", evidenceNote: "" } });
    expect(() => e.addProduct(rid, { siteId, name: "Dup", supplier: "", barcode: bc, spec: { label: "x", packSize: "1L", batchCodes: null, ingredientsText: "", contains: m.contains, precautionary: m.precautionary, evidenceReference: "Sheet", evidenceNote: "" } })).toThrow(/already belongs/);
    expect(() => e.addProduct(rid, { siteId, name: "Bad", supplier: "", barcode: "123", spec: { label: "x", packSize: "1L", batchCodes: null, ingredientsText: "", contains: m.contains, precautionary: m.precautionary, evidenceReference: "Sheet", evidenceNote: "" } })).toThrow(/not valid/);
    expect(() => e.addProduct(ownerId, { siteId, name: "NoEvidence", supplier: "", barcode: "", spec: { label: "x", packSize: "1L", batchCodes: null, ingredientsText: "", contains: m.contains, precautionary: m.precautionary, evidenceReference: "", evidenceNote: "" } })).toThrow(/where/);
    const r = e.receiveDelivery(rid, { siteId, orderedProductId: productId, barcode: bc, packSize: "1L", batchCode: "B1", labelSpecRef: "OD-1", deliveryNoteRef: "N1" }, "r1");
    expect(r.delivery.outcome).toBe("identifier_match");
    const r2 = e.receiveDelivery(rid, { siteId, orderedProductId: productId, barcode: bc, packSize: "500ml", batchCode: "B2", labelSpecRef: "OD-2", deliveryNoteRef: "N2" }, "r2");
    expect(r2.delivery.outcome).toBe("review_required");
    expect(r2.delivery.findings.map((f) => f.kind)).toEqual(expect.arrayContaining(["pack_variant_differs", "spec_label_differs"]));
    expect(verifyAuditChain(e.state)).toBe(true);
  });
  it("a person with only the service role cannot add products or people", () => {
    const { e } = newEngine();
    const m = specMaps([]);
    expect(() => e.addProduct("jo", { siteId: MAIN, name: "X", supplier: "", barcode: "", spec: { label: "x", packSize: "1", batchCodes: null, ingredientsText: "", contains: m.contains, precautionary: m.precautionary, evidenceReference: "Sheet", evidenceNote: "" } })).toThrow();
    expect(() => e.addStaff("jo", { name: "Mallory", grants: [{ role: "administrator", siteId: "*" }] })).toThrow();
    void allUnknownContains; void allUnknownPrecaution; void sauceDelivery;
  });
});

describe("PIN reset", () => {
  it("an administrator can clear a PIN but cannot learn or set the new one; nobody else can; not for yourself", () => {
    const { e } = newEngine();
    e.setPin("jo", "jo", "481516");
    expect(() => e.resetPin("alex", "jo")).toThrow();
    expect(() => e.resetPin("morgan", "morgan")).toThrow();
    e.resetPin("morgan", "jo");
    expect(e.state.pins?.jo).toBeUndefined();
    expect(e.state.audit.at(-1)!.action).toBe("pin.reset");
  });
});
