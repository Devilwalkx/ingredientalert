import { describe, expect, it } from "vitest";
import { ALLERGENS, MAIN, ANNEX, SUB_NAME, allUnknownContains, allUnknownPrecaution, sauceDelivery, substituteSpecInput, isSpecComplete } from "../src/index.js";
import { approveSauce, caseVersion, dish, fullSauceChain, newEngine, receiveSauce, reviewSauce } from "./helpers.js";

const code = (fn: () => unknown) => {
  try { fn(); } catch (e: any) { return e.code as string; }
  return "no-error";
};

describe("review workflow", () => {
  it("walks received -> spec attached -> impact reviewed -> approved with actor and evidence preserved", () => {
    const { e } = newEngine();
    const caseId = receiveSauce(e);
    expect(e.state.cases[0]!.state).toBe("review_required");
    const { spec, impact } = reviewSauce(e, caseId);
    expect(spec.evidence.reference).toMatch(/EG-TS-2026-02/);
    expect(spec.verifiedBy).toBe("priya");
    expect(impact.items.map((i) => i.name)).toEqual(expect.arrayContaining(["House glaze", "Glazed salmon bowl", "Glazed chicken rice"]));
    expect(impact.items.every((i) => !i.name.includes("omelette"))).toBe(true);
    const { substitution } = approveSauce(e, caseId);
    expect(substitution.approvedBy).toBe("sam");
    expect(e.state.cases[0]!.decision?.impactDigest).toBe(impact.digest);
    expect(e.state.products.find((p) => p.name === SUB_NAME)!.status).toBe("approved");
  });

  it("dishes are on information hold while the review is open and nothing says 'safe'", () => {
    const { e } = newEngine();
    receiveSauce(e);
    const d = dish(e, "d-salmon");
    expect(d.resolved).toBe(false);
    expect(d.lines.join(" ")).toMatch(/UNRESOLVED/);
    expect(JSON.stringify(e.state)).not.toMatch(/allergen-free|safe to serve|free from/i);
  });

  it("simultaneous reviewers: the second submission is refused with a version conflict and changes nothing", () => {
    const { e } = newEngine();
    e.addStaff("morgan", { name: "Pria Two", grants: [{ role: "specification_reviewer", siteId: MAIN }] });
    const second = e.state.staff.find((s) => s.name === "Pria Two")!.id;
    const caseId = receiveSauce(e);
    const v = caseVersion(e, caseId);
    e.verifySpecification("priya", caseId, v, { newProduct: { name: SUB_NAME, supplier: "x" }, spec: substituteSpecInput() });
    const before = JSON.stringify(e.state.cases[0]);
    expect(code(() => e.verifySpecification(second, caseId, v, { newProduct: { name: "Other", supplier: "x" }, spec: substituteSpecInput() }))).toBe("version_conflict");
    expect(JSON.stringify(e.state.cases[0])).toBe(before);
    expect(code(() => e.reviewImpact(second, caseId, v))).toBe("version_conflict");
    expect(code(() => e.rejectCase("sam", caseId, v, "not wanted"))).toBe("version_conflict");
  });

  it("approval replay: same request is idempotent; a second approval or a stale view is refused", () => {
    const { e } = newEngine();
    const caseId = receiveSauce(e);
    reviewSauce(e, caseId);
    const c = e.state.cases[0]!;
    const req = { expectedVersion: c.version, specId: c.specId!, impactDigest: c.impact!.digest, requestId: "same" };
    const first = e.approveCase("sam", caseId, req);
    const replay = e.approveCase("sam", caseId, req);
    expect(replay.replayed).toBe(true);
    expect(replay.substitution.id).toBe(first.substitution.id);
    expect(e.state.substitutions).toHaveLength(1);
    expect(e.state.audit.filter((a) => a.action === "case.approved")).toHaveLength(1);
    expect(code(() => e.approveCase("sam", caseId, { ...req, requestId: "other" }))).toBe("version_conflict");
  });

  it("an approval is bound to the exact specification revision and impact it was shown", () => {
    const { e } = newEngine();
    const caseId = receiveSauce(e);
    reviewSauce(e, caseId);
    const c = e.state.cases[0]!;
    expect(code(() => e.approveCase("sam", caseId, { expectedVersion: c.version, specId: "spec-p-flour", impactDigest: c.impact!.digest, requestId: "w1" }))).toBe("wrong_revision");
    expect(code(() => e.approveCase("sam", caseId, { expectedVersion: c.version, specId: c.specId!, impactDigest: "0".repeat(24), requestId: "w2" }))).toBe("stale_basis");
    // a recipe changes after the impact was reviewed
    e.addRecipeVersion("sam", { newRecipe: { name: "New sauce dish", kind: "dish" }, components: [{ kind: "recipe", recipeId: "rc-glaze" }], siteIds: [MAIN] });
    expect(code(() => e.approveCase("sam", caseId, { expectedVersion: c.version, specId: c.specId!, impactDigest: c.impact!.digest, requestId: "w3" }))).toBe("stale_basis");
    expect(e.state.substitutions).toHaveLength(0);
  });

  it("incomplete specification: can be recorded but cannot be approved; dishes stay UNRESOLVED", () => {
    const { e } = newEngine();
    const caseId = receiveSauce(e);
    const si = substituteSpecInput();
    si.contains = { ...si.contains, lupin: "unknown", molluscs: "unknown" };
    const spec = e.verifySpecification("priya", caseId, 1, { newProduct: { name: SUB_NAME, supplier: "x" }, spec: si });
    expect(isSpecComplete(spec)).toBe(false);
    const impact = e.reviewImpact("priya", caseId, 2);
    const salmon = impact.items.find((i) => i.name === "Glazed salmon bowl")!;
    expect(salmon.after!.resolved).toBe(false);
    expect(salmon.after!.unresolved).toEqual(expect.arrayContaining(["lupin", "molluscs"]));
    expect(code(() => e.approveCase("sam", caseId, { expectedVersion: 3, specId: spec.id, impactDigest: impact.digest, requestId: "a" }))).toBe("validation");
    expect(e.state.substitutions).toHaveLength(0);
    // an empty / unknown-everything specification is also refused, and evidence is mandatory
    const e2 = newEngine().e;
    const c2 = receiveSauce(e2);
    const blank = { ...substituteSpecInput(), contains: allUnknownContains(), precautionary: allUnknownPrecaution() };
    const sp2 = e2.verifySpecification("priya", c2, 1, { newProduct: { name: "N", supplier: "x" }, spec: blank });
    const imp2 = e2.reviewImpact("priya", c2, 2);
    expect(dishUnresolved(imp2)).toBe(true);
    expect(code(() => e2.approveCase("sam", c2, { expectedVersion: 3, specId: sp2.id, impactDigest: imp2.digest, requestId: "a" }))).toBe("validation");
    const c3 = receiveSauce(newEngine().e);
    expect(() => newEngine().e.verifySpecification("priya", "nope", 1, { spec: substituteSpecInput() })).toThrow();
    expect(c3).toBeTruthy();
    const e4 = newEngine().e;
    const c4 = receiveSauce(e4);
    expect(() => e4.verifySpecification("priya", c4, 1, { newProduct: { name: "N", supplier: "x" }, spec: { ...substituteSpecInput(), evidenceReference: "" } })).toThrow(/where this information came from/);
  });

  it("rejection leaves recipes on their original approved products and records why", () => {
    const { e } = newEngine();
    const caseId = receiveSauce(e);
    e.rejectCase("sam", caseId, 1, "Not the product we approved");
    expect(e.state.cases[0]!.state).toBe("rejected");
    expect(dish(e, "d-salmon").resolved).toBe(true);
    expect(() => e.rejectCase("sam", caseId, 2, "again")).toThrow();
  });

  it("mixed sites: an approval at the main kitchen does not change the annex menu, and the annex still needs its own review", () => {
    const { e } = newEngine();
    const annexBefore = JSON.stringify(e.declarationsAt("sam", ANNEX));
    fullSauceChain(e);
    expect(JSON.stringify(e.declarationsAt("sam", ANNEX))).toBe(annexBefore);
    expect(e.declarationsAt("sam", ANNEX).some((d) => d.recipeName === "Glazed chicken rice")).toBe(false);
    expect(dish(e, "d-chicken-rice").contains).toContain("sesame");
    e.addStaff("morgan", { name: "Annex Receiver", grants: [{ role: "receiving_operator", siteId: ANNEX }] });
    const who = e.state.staff.find((s) => s.name === "Annex Receiver")!.id;
    const r = e.receiveDelivery(who, { ...sauceDelivery(ANNEX), deliveryNoteRef: "DN-ANNEX" }, "ax");
    expect(r.delivery.outcome).toBe("review_required");
    expect(e.declarationsAt("sam", ANNEX).find((d) => d.recipeId === "d-salmon")!.resolved).toBe(false);
    // the main kitchen is unaffected by the annex case
    expect(dish(e, "d-salmon").resolved).toBe(true);
    expect(() => e.receiveDelivery("alex", sauceDelivery(ANNEX), "no")).toThrow(/permitted/);
  });

  it("batch-limited substitution applies only to that batch and can be ended", () => {
    const { e } = newEngine();
    const caseId = receiveSauce(e);
    reviewSauce(e, caseId);
    const c = e.state.cases[0]!;
    const { substitution } = e.approveCase("sam", caseId, { expectedVersion: c.version, specId: c.specId!, impactDigest: c.impact!.digest, requestId: "b", batchCodes: ["EG240617"] });
    expect(dish(e, "d-salmon").notes.join(" ")).toMatch(/batch EG240617 only/);
    expect(e.receiveDelivery("alex", { ...sauceDelivery(), batchCode: "EG-OTHER", deliveryNoteRef: "DN-9" }, "o").delivery.outcome).toBe("review_required");
    e.endSubstitution("sam", substitution.id, "Batch used up");
    expect(e.state.substitutions[0]!.endedAt).not.toBeNull();
  });
});

describe("separation of duties and overrides", () => {
  function smallTeam() {
    const { e, clock } = newEngine();
    e.addStaff("morgan", { name: "Pat Cook", grants: [{ role: "receiving_operator", siteId: MAIN }, { role: "publication_approver", siteId: MAIN }, { role: "specification_reviewer", siteId: MAIN }] });
    const pat = e.state.staff.find((s) => s.name === "Pat Cook")!.id;
    return { e, clock, pat };
  }
  const attempt = (e: any, caseId: string, who: string, id: string) => {
    const c = e.state.cases.find((x: any) => x.id === caseId);
    return e.approveCase(who, caseId, { expectedVersion: c.version, specId: c.specId, impactDigest: c.impact.digest, requestId: id });
  };

  it("the receiving operator cannot approve their own consequential substitution", () => {
    const { e, pat } = smallTeam();
    const caseId = receiveSauce(e, sauceDelivery(), pat);
    reviewSauce(e, caseId);
    expect(code(() => attempt(e, caseId, pat, "x"))).toBe("separation_of_duties");
    expect(e.state.substitutions).toHaveLength(0);
  });

  it("neither can the person who verified the specification", () => {
    const { e, pat } = smallTeam();
    const caseId = receiveSauce(e);
    reviewSauce(e, caseId, pat);
    expect(code(() => attempt(e, caseId, pat, "x"))).toBe("separation_of_duties");
    expect(attempt(e, caseId, "sam", "y").substitution.approvedBy).toBe("sam");
  });

  it("a named, reasoned, scoped, expiring exception allows it, is recorded, and stops working when it expires", () => {
    const { e, clock, pat } = smallTeam();
    const caseId = receiveSauce(e, sauceDelivery(), pat);
    reviewSauce(e, caseId);
    expect(() => e.grantOverride("morgan", { kind: "sod_exception", siteId: MAIN, actorId: pat, reason: "short", days: 2 })).toThrow(/full sentence/);
    expect(() => e.grantOverride("morgan", { kind: "sod_exception", siteId: MAIN, actorId: pat, reason: "Two-person kitchen, risk assessed by the manager", days: 99 })).toThrow(/expire/);
    expect(code(() => e.grantOverride("morgan", { kind: "sod_exception", siteId: MAIN, actorId: "morgan", reason: "Granting myself an exception today", days: 2 }))).toBe("separation_of_duties");
    expect(() => e.grantOverride("alex", { kind: "sod_exception", siteId: MAIN, actorId: pat, reason: "Operator trying to grant it", days: 2 })).toThrow(/permitted/);
    const ov = e.grantOverride("morgan", { kind: "sod_exception", siteId: MAIN, actorId: pat, reason: "Two-person kitchen, risk assessed by the manager", days: 2 });
    // expiry
    clock.t += 3 * 86_400_000;
    expect(code(() => attempt(e, caseId, pat, "late"))).toBe("separation_of_duties");
    // a fresh exception works and is named on the decision
    const ov2 = e.grantOverride("morgan", { kind: "sod_exception", siteId: MAIN, actorId: pat, reason: "Renewed after the manager re-checked", days: 2 });
    const res = attempt(e, caseId, pat, "ok");
    expect(res.substitution.approvedBy).toBe(pat);
    expect(e.state.cases[0]!.decision!.viaOverrideId).toBe(ov2.id);
    expect(ov.id).not.toBe(ov2.id);
    // it does not cover a different person or site
    expect(e.state.overrides.every((o) => o.siteId === MAIN && o.actorId === pat)).toBe(true);
  });

  it("no override can turn unknown data into 'not declared' or allergen-free", () => {
    const { e } = newEngine();
    expect(() => e.grantOverride("morgan", { kind: "mark_allergen_free" as any, siteId: MAIN, reason: "We are sure it is fine really", days: 1 })).toThrow(/does not exist/);
    receiveSauce(e); // dishes with the glaze become UNRESOLVED
    expect(() => e.preparePublication("sam", MAIN, "p0")).toThrow(/blocked/);
    e.grantOverride("morgan", { kind: "publish_unresolved_with_warning", siteId: MAIN, recipeId: "d-salmon", reason: "Menu must go out; this dish will say UNRESOLVED", days: 1 });
    expect(() => e.preparePublication("sam", MAIN, "p1")).toThrow(/blocked/); // chicken rice still blocks
    e.grantOverride("morgan", { kind: "publish_unresolved_with_warning", siteId: MAIN, recipeId: "d-chicken-rice", reason: "Menu must go out; this dish will say UNRESOLVED", days: 1 });
    const { publication } = e.preparePublication("sam", MAIN, "p2");
    const salmon = publication.dishes.find((d) => d.recipeId === "d-salmon")!;
    expect(salmon.resolved).toBe(false);
    expect(salmon.unresolved).toEqual(expect.arrayContaining(["sesame", "lupin", "milk"]));
    expect(salmon.lines.join("\n")).toMatch(/UNRESOLVED - do not rely/);
    expect(publication.sources.overrideIds).toHaveLength(2);
  });

  it("an override that expires before channel publication blocks that publication", () => {
    const { e, clock } = newEngine();
    receiveSauce(e);
    for (const r of ["d-salmon", "d-chicken-rice"]) e.grantOverride("morgan", { kind: "publish_unresolved_with_warning", siteId: MAIN, recipeId: r, reason: "Menu must go out; this dish will say UNRESOLVED", days: 1 });
    const { publication } = e.preparePublication("sam", MAIN, "p2");
    clock.t += 2 * 86_400_000;
    expect(code(() => e.publishChannel("sam", publication.id, "qr_web", "c1"))).toBe("publish_blocked");
  });
});
function dishUnresolved(imp: { items: Array<{ kind: string; after: { resolved: boolean } | null }> }) {
  return imp.items.some((i) => i.kind === "dish" && i.after && !i.after.resolved);
}
void ALLERGENS;
