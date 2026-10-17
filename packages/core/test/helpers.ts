import { Engine, MAIN, SUB_NAME, sauceDelivery, substituteSpecInput, syntheticEngine, type ReceivingInput } from "../src/index.js";

export const T0 = Date.parse("2026-10-17T10:00:00.000Z");

export function newEngine() {
  const clock = { t: T0 };
  const e = syntheticEngine({ now: () => clock.t });
  return { e, clock };
}

export function receiveSauce(e: Engine, input: ReceivingInput = sauceDelivery(), who = "alex", req = "recv-1") {
  const r = e.receiveDelivery(who, input, req);
  if (!r.caseId) throw new Error("expected a review case");
  return r.caseId;
}

export function caseVersion(e: Engine, id: string) {
  return e.state.cases.find((c) => c.id === id)!.version;
}

/** Steps 1 and 2 done by the reviewer; returns what the approver needs. */
export function reviewSauce(e: Engine, caseId: string, reviewer = "priya") {
  const spec = e.verifySpecification(reviewer, caseId, caseVersion(e, caseId), { newProduct: { name: SUB_NAME, supplier: "Fictional Foods Ltd" }, spec: substituteSpecInput() });
  const impact = e.reviewImpact(reviewer, caseId, caseVersion(e, caseId));
  return { spec, impact };
}

export function approveSauce(e: Engine, caseId: string, approver = "sam", requestId = "appr-1") {
  const c = e.state.cases.find((x) => x.id === caseId)!;
  return e.approveCase(approver, caseId, { expectedVersion: c.version, specId: c.specId!, impactDigest: c.impact!.digest, requestId });
}

export function fullSauceChain(e: Engine) {
  const caseId = receiveSauce(e);
  reviewSauce(e, caseId);
  const { substitution } = approveSauce(e, caseId);
  return { caseId, substitution };
}

export const dish = (e: Engine, id: string, site = MAIN) => e.declarationsAt("sam", site).find((d) => d.recipeId === id)!;
