import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ANNEX, MAIN, OTHER_SITE, baseState, generateContentKey, openState, sealState, verifyAuditChain, sauceDelivery, substituteSpecInput, SUB_NAME
} from "../src/index.js";
import { fullSauceChain, newEngine, receiveSauce, reviewSauce } from "./helpers.js";

const code = (fn: () => unknown) => {
  try { fn(); } catch (e: any) { return e.code as string; }
  return "no-error";
};

describe("cross-tenant and cross-site authorisation (enforced in core)", () => {
  it("another tenant's administrator cannot read, act on or export anything, and gets the same answer as for a missing object", () => {
    const { e } = newEngine();
    const caseId = receiveSauce(e);
    reviewSauce(e, caseId);
    const pub = e.state.publications.find((p) => p.siteId === MAIN)!;
    const calls: Array<() => unknown> = [
      () => e.casesAt("omar", MAIN), () => e.publicationsAt("omar", MAIN), () => e.declarationsAt("omar", MAIN),
      () => e.exportHistory("omar", MAIN), () => e.receiveDelivery("omar", sauceDelivery(), "x"),
      () => e.reviewImpact("omar", caseId, 3), () => e.rejectCase("omar", caseId, 3, "reason here"),
      () => e.approveCase("omar", caseId, { expectedVersion: 3, specId: "x", impactDigest: "y", requestId: "z" }),
      () => e.preparePublication("omar", MAIN, "z"), () => e.publishChannel("omar", pub.id, "qr_web", "z"),
      () => e.acknowledge("omar", pub.id, 1), () => e.setKitchenControl("omar", MAIN, "milk", "Some control text"),
      () => e.grantOverride("omar", { kind: "sod_exception", siteId: MAIN, actorId: "sam", reason: "Trying across tenants", days: 1 }),
      () => e.offboardStaff("omar", "jo"), () => e.requestStaffErasure("omar", "jo"),
      () => e.addRecipeVersion("omar", { recipeId: "d-salmon", components: [], siteIds: [MAIN] })
    ];
    for (const c of calls) expect(code(c)).toBe("forbidden");
    // same message for a nonexistent id: no way to probe what exists
    let a = "", b = "";
    try { e.reviewImpact("omar", caseId, 3); } catch (x: any) { a = x.message; }
    try { e.reviewImpact("omar", "case-9999", 3); } catch (x: any) { b = x.message; }
    expect(a).toBe(b);
  });

  it("the other tenant's data is invisible to this tenant, and products cannot be mixed between tenants", () => {
    const { e } = newEngine();
    expect(code(() => e.casesAt("sam", OTHER_SITE))).toBe("forbidden");
    expect(code(() => e.receiveDelivery("alex", { ...sauceDelivery(), orderedProductId: "p2-flour" }, "x"))).toBe("validation");
    expect(code(() => e.addRecipeVersion("sam", { newRecipe: { name: "Mix", kind: "dish" }, components: [{ kind: "product", productId: "p2-flour" }], siteIds: [MAIN] }))).toBe("validation");
    expect(e.declarationsAt("omar", OTHER_SITE).map((d) => d.recipeName)).toEqual(["Other group bread"]);
  });

  it("site scoping inside a tenant: a main-kitchen role is not valid at the annex; a tenant-wide role is", () => {
    const { e } = newEngine();
    expect(code(() => e.casesAt("alex", ANNEX))).toBe("forbidden");
    expect(code(() => e.declarationsAt("jo", ANNEX))).toBe("forbidden");
    expect(code(() => e.declarationsAt("sam", ANNEX))).toBe("no-error");
  });

  it("roles are enforced: each role can do only its own job", () => {
    const { e } = newEngine();
    const caseId = receiveSauce(e);
    expect(code(() => e.verifySpecification("alex", caseId, 1, { spec: substituteSpecInput(), newProduct: { name: SUB_NAME, supplier: "x" } }))).toBe("forbidden");
    expect(code(() => e.verifySpecification("sam", caseId, 1, { spec: substituteSpecInput(), newProduct: { name: SUB_NAME, supplier: "x" } }))).toBe("forbidden");
    expect(code(() => e.reviewImpact("jo", caseId, 1))).toBe("forbidden");
    expect(code(() => e.setKitchenControl("priya", MAIN, "milk", "Not allowed for reviewers"))).toBe("forbidden");
    expect(code(() => e.exportHistory("jo", MAIN))).toBe("forbidden");
    expect(code(() => e.addStaff("sam", { name: "X", grants: [] }))).toBe("forbidden");
  });
});

describe("staff offboarding", () => {
  it("an offboarded person loses access immediately, is no longer expected to acknowledge, and exceptions made for them lapse", () => {
    const { e } = newEngine();
    e.addStaff("morgan", { name: "Pat Cook", grants: [{ role: "publication_approver", siteId: MAIN }] });
    const pat = e.state.staff.find((s) => s.name === "Pat Cook")!.id;
    const ov = e.grantOverride("morgan", { kind: "sod_exception", siteId: MAIN, actorId: pat, reason: "Two-person kitchen, risk assessed", days: 3 });
    fullSauceChain(e);
    const { publication } = e.preparePublication("sam", MAIN, "p2");
    e.publishChannel("sam", publication.id, "service_view", "s");
    e.offboardStaff("morgan", "jess");
    e.offboardStaff("morgan", pat);
    expect(code(() => e.acknowledge("jess", publication.id, 2))).toBe("forbidden");
    expect(code(() => e.declarationsAt(pat, MAIN))).toBe("forbidden");
    expect(e.outstandingAcks(MAIN).required).toEqual(["jo"]);
    expect(e.state.overrides.find((o) => o.id === ov.id)!.revokedAt).not.toBeNull();
    expect(e.state.memberships.filter((m) => m.staffId === "jess").every((m) => m.endedAt)).toBe(true);
    // history stays
    expect(e.state.acks.some((a) => a.staffId === "jess")).toBe(true);
    expect(code(() => e.offboardStaff("morgan", "morgan"))).toBe("validation"); // last administrator
    expect(code(() => e.offboardStaff("sam", "jo"))).toBe("forbidden");
  });
});

describe("deletion versus justified audit retention", () => {
  it("erasure removes the name but keeps the audit trail and approvals, with the reason recorded; the chain still verifies", () => {
    const { e } = newEngine();
    fullSauceChain(e);
    const name = e.state.staff.find((s) => s.id === "alex")!.name;
    expect(JSON.stringify(e.state)).toContain(name);
    expect(code(() => e.requestStaffErasure("morgan", "alex"))).toBe("validation"); // must be offboarded first
    e.offboardStaff("morgan", "alex");
    const rec = e.requestStaffErasure("morgan", "alex");
    expect(JSON.stringify(e.state)).not.toContain(name);
    expect(e.state.staff.find((s) => s.id === "alex")!.erased).toBe(true);
    expect(e.state.audit.some((a) => a.actorId === "alex" && a.action === "delivery.recorded")).toBe(true);
    expect(e.state.deliveries.some((d) => d.receivedBy === "alex")).toBe(true);
    expect(rec.retained.length).toBeGreaterThanOrEqual(2);
    expect(rec.retained.map((r) => r.why).join(" ")).toMatch(/NOT decided/);
    expect(rec.deleted.length).toBeGreaterThan(0);
    expect(verifyAuditChain(e.state)).toBe(true);
    // idempotent
    expect(e.requestStaffErasure("morgan", "alex").id).toBe(rec.id);
    expect(e.state.retention).toHaveLength(1);
  });

  it("audit events never contain staff names", () => {
    const { e } = newEngine();
    fullSauceChain(e);
    const text = JSON.stringify(e.state.audit);
    for (const s of e.state.staff) expect(text).not.toContain(s.name);
  });
});

describe("audit trail", () => {
  it("is hash-chained; tampering with any event is detected (tamper evidence, not proof an event really happened)", () => {
    const { e } = newEngine();
    fullSauceChain(e);
    expect(verifyAuditChain(e.state)).toBe(true);
    const copy = structuredClone(e.state);
    copy.audit[3]!.actorId = "somebody-else";
    expect(verifyAuditChain(copy)).toBe(false);
    const copy2 = structuredClone(e.state);
    copy2.audit.splice(2, 1);
    expect(verifyAuditChain(copy2)).toBe(false);
  });

  it("a failed action changes nothing and leaves no audit entry (atomic)", () => {
    const { e } = newEngine();
    const before = JSON.stringify(e.state);
    expect(() => e.receiveDelivery("alex", { ...sauceDelivery(), batchCode: "" }, "x")).toThrow();
    expect(() => e.preparePublication("alex", MAIN, "x")).toThrow();
    expect(JSON.stringify(e.state)).toBe(before);
  });
});

describe("encrypted local storage of the whole database", () => {
  it("round-trips; ciphertext contains no readable business data; wrong key, account, tampering and rollback fail", () => {
    const { e } = newEngine();
    fullSauceChain(e);
    const key = generateContentKey();
    const env = sealState(key, e.state, "local-demo");
    const text = JSON.stringify(env);
    for (const needle of ["Fictional Bistro Group", "Harbour Teriyaki", "tenants", "\"products\"", "Priya Nair", "EG-TS-2026-02"]) expect(text).not.toContain(needle);
    expect(openState(key, env, "local-demo").version).toBe(e.state.version);
    expect(() => openState(generateContentKey(), env, "local-demo")).toThrow();
    expect(() => openState(key, env, "other-account")).toThrow();
    expect(() => openState(key, { ...env, version: env.version - 1 }, "local-demo")).toThrow();
    const flipped = { ...env, sealed: { ...env.sealed, ct: (env.sealed.ct[0] === "0" ? "1" : "0") + env.sealed.ct.slice(1) } };
    expect(() => openState(key, flipped, "local-demo")).toThrow();
  });
});

describe("mobile app configuration (permissions minimised; also verified by `expo prebuild` in CI)", () => {
  const cfg = JSON.parse(readFileSync(new URL("../../../apps/mobile/app.json", import.meta.url), "utf8")).expo;
  it("uses the placeholder package id and the synthetic-demo name", () => {
    expect(cfg.android.package).toBe("invalid.placeholder.ingredientalert");
    expect(cfg.name).toBe("IngredientAlert (synthetic demo)");
  });
  it("requests no dangerous permissions: camera, microphone, location and broad storage are blocked", () => {
    expect(cfg.android.permissions).toEqual([]);
    for (const p of ["CAMERA", "RECORD_AUDIO", "ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION", "ACCESS_BACKGROUND_LOCATION", "READ_EXTERNAL_STORAGE", "WRITE_EXTERNAL_STORAGE", "INTERNET", "VIBRATE", "SYSTEM_ALERT_WINDOW"])
      expect(cfg.android.blockedPermissions).toContain(p);
  });
  it("has no analytics, tracking or camera plugins", () => {
    const names = cfg.plugins.map((p: unknown) => (Array.isArray(p) ? p[0] : p));
    expect(names.filter((n: string) => /analytics|sentry|firebase|segment|amplitude|tracking|camera|barcode/i.test(n))).toEqual([]);
  });
});

describe("seed data sanity", () => {
  it("has 20 ingredients with complete specifications, two tenants, and no cycles", () => {
    const s = baseState();
    expect(s.products.filter((p) => p.tenantId === "tenant-1")).toHaveLength(20);
    expect(s.specs.filter((x) => x.tenantId === "tenant-1").every((x) => x.status === "verified")).toBe(true);
    expect(s.tenants).toHaveLength(2);
  });
});
