import { ALLERGENS, ALLERGEN_LABEL, isAllergen, type Allergen, type ContainsMap, type PrecautionMap } from "./allergens.js";
import { isValidGtin, normaliseBarcode } from "./barcode.js";
import { activeSubstitution, brief, declare, dishesAt, kitchenControlLines, openCasesFor, queuedFor, siteDeclarations } from "./declarations.js";
import { DomainError, forbidden, invalid, notFound } from "./errors.js";
import { findCycle, pathToProduct, recipeEdges, staleReferences, versionAt } from "./graph.js";
import { authorize, rolesAt, type Action } from "./permissions.js";
import { makePinRecord, type PinRecord } from "./pin.js";
import {
  CHANNELS, type AppState, type Channel, type ChannelState, type Component, type Delivery, type Finding, type Impact, type ImpactItem,
  type Override, type OverrideKind, type Publication, type ReceivingInput, type ReviewCase, type Role, type SpecRevision, type Substitution
} from "./types.js";
import { deepFreeze, sha, stableStringify } from "./util.js";

/** Design parameter (not a regulatory figure): the longest an override may last. */
export const MAX_OVERRIDE_DAYS = 14;
const DAY = 86_400_000;

export type ChannelResult = { ok: true } | { ok: false; error: string };
export type ChannelAdapter = (channel: Channel, publication: Publication) => ChannelResult;

export interface SpecInput {
  label: string;
  packSize: string;
  batchCodes: string[] | null;
  ingredientsText: string;
  contains: ContainsMap;
  precautionary: PrecautionMap;
  evidenceReference: string;
  evidenceNote: string;
}

export function isSpecComplete(spec: Pick<SpecRevision, "contains" | "precautionary" | "ingredientsText" | "evidence">): boolean {
  return (
    spec.ingredientsText.trim().length > 0 &&
    spec.evidence.reference.trim().length >= 3 &&
    ALLERGENS.every((a) => spec.contains[a] !== "unknown" && spec.precautionary[a] !== "unknown")
  );
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

export class Engine {
  state: AppState;
  adapter: ChannelAdapter = () => ({ ok: true });
  onCommit: ((s: AppState) => void) | null = null;
  private nowFn: () => number;

  constructor(state: AppState, opts: { now?: () => number } = {}) {
    this.nowFn = opts.now ?? (() => Date.now());
    this.state = deepFreeze(structuredClone(state));
  }

  /** Current time including the demo clock offset. */
  now(s: AppState = this.state): Date {
    return new Date(this.nowFn() + s.clockOffsetMs);
  }
  iso(s: AppState = this.state): string {
    return this.now(s).toISOString();
  }

  /** Atomic change: work on a copy; if anything throws nothing is kept. Committed state is frozen. */
  private tx<T>(fn: (s: AppState) => T): T {
    const draft = structuredClone(this.state);
    const result = fn(draft);
    draft.version += 1;
    this.state = deepFreeze(draft);
    this.onCommit?.(this.state);
    return result;
  }

  private id(s: AppState, prefix: string): string {
    s.seq += 1;
    return `${prefix}-${s.seq}`;
  }

  private audit(s: AppState, actorId: string, tenantId: string, siteId: string | null, action: string, targetType: string, targetId: string, detail = ""): void {
    const prev = s.audit[s.audit.length - 1]?.hash ?? "genesis";
    const at = this.iso(s);
    const seq = s.audit.length + 1;
    const body = stableStringify({ seq, at, tenantId, siteId, actorId, action, targetType, targetId, detail, prev });
    s.audit.push({ seq, at, tenantId, siteId, actorId, action, targetType, targetId, detail, prevHash: prev, hash: sha(body) });
  }

  private idem(s: AppState, key: string): string | undefined {
    return s.requests[key];
  }

  private siteOf(s: AppState, siteId: string) {
    const site = s.sites.find((x) => x.id === siteId);
    if (!site) throw forbidden(); // unknown and foreign sites look the same
    return site;
  }
  private auth(s: AppState, actorId: string, action: Action, siteId: string) {
    const site = this.siteOf(s, siteId);
    return { site, staff: authorize(s, actorId, action, site.tenantId, siteId) };
  }
  private caseOf(s: AppState, actorId: string, caseId: string, action: Action): ReviewCase {
    const c = s.cases.find((x) => x.id === caseId);
    if (!c) throw forbidden();
    this.auth(s, actorId, action, c.siteId);
    return c;
  }

  // ---------------------------------------------------------------- receiving
  receiveDelivery(actorId: string, input: ReceivingInput, requestId?: string): { delivery: Delivery; duplicate: boolean; caseId: string | null } {
    return this.tx((s) => this.doReceive(s, actorId, actorId, input, { source: "direct", requestId, capturedAt: this.iso(s), knownSpecIdAtCapture: null }));
  }

  private doReceive(
    s: AppState, authActor: string, recordedBy: string, input: ReceivingInput,
    meta: { source: "direct" | "queued"; requestId: string | undefined; capturedAt: string; knownSpecIdAtCapture: string | null }
  ) {
    const { site } = this.auth(s, authActor, "receive", input.siteId);
    const ordered = s.products.find((p) => p.id === input.orderedProductId && p.tenantId === site.tenantId);
    if (!ordered) throw invalid("Choose the product that was ordered.");
    if (!input.barcode.trim()) throw invalid("Type the barcode number from the pack.");
    if (!input.packSize.trim()) throw invalid("Type the pack size shown on the pack.");
    if (!input.batchCode.trim()) throw invalid("Type the batch or best-before code from the pack.");
    const key = meta.requestId ? `${recordedBy}|receive|${meta.requestId}` : null;
    if (key && this.idem(s, key)) {
      const d = s.deliveries.find((x) => x.id === this.idem(s, key))!;
      return { delivery: d, duplicate: true, caseId: d.caseId };
    }
    const barcode = normaliseBarcode(input.barcode);
    const dedupeKey = [input.siteId, norm(input.deliveryNoteRef), barcode, norm(input.batchCode), norm(input.packSize)].join("|");
    const dup = s.deliveries.find((d) => d.dedupeKey === dedupeKey);
    if (dup) return { delivery: dup, duplicate: true, caseId: dup.caseId };

    const findings: Finding[] = [];
    let observed: string | null = null;
    if (!isValidGtin(barcode)) {
      findings.push({ kind: "barcode_invalid", message: "The barcode number is not a valid barcode (typing slip or unsupported code). The product could not be identified." });
    } else {
      const p = s.products.find((x) => x.tenantId === site.tenantId && x.barcodes.includes(barcode));
      if (!p) findings.push({ kind: "unknown_barcode", message: "This barcode is not in the approved product list. The delivered product is unidentified." });
      else observed = p.id;
    }
    let outcome: Delivery["outcome"] = "identifier_match";
    let specToCheck: SpecRevision | undefined;
    if (observed && observed !== ordered.id) {
      const sub = activeSubstitution(s, input.siteId, ordered.id);
      const covered = sub && sub.withProductId === observed && (sub.batchCodes === null || sub.batchCodes.includes(input.batchCode.trim()));
      if (covered) {
        outcome = "matched_approved_substitute";
        specToCheck = s.specs.find((x) => x.id === sub.specId);
      } else {
        const other = s.products.find((p) => p.id === observed)!;
        findings.push({ kind: "barcode_other_product", message: `The barcode belongs to "${other.name}", not the ordered "${ordered.name}", and no current approved substitution covers it.` });
      }
    } else if (observed === ordered.id) {
      const sub = activeSubstitution(s, input.siteId, ordered.id);
      specToCheck = s.specs.find((x) => x.id === (sub?.specId ?? ordered.approvedSpecId));
    }
    if (specToCheck) {
      if (norm(specToCheck.packSize) !== norm(input.packSize))
        findings.push({ kind: "pack_variant_differs", message: `Pack size "${input.packSize}" differs from the approved specification pack "${specToCheck.packSize}". A different pack can have a different recipe.` });
      if (input.labelSpecRef.trim() && norm(input.labelSpecRef) !== norm(specToCheck.label))
        findings.push({ kind: "spec_label_differs", message: `The pack shows specification/version "${input.labelSpecRef}" but the approved one is "${specToCheck.label}".` });
      if (specToCheck.batchCodes && !specToCheck.batchCodes.includes(input.batchCode.trim()))
        findings.push({ kind: "batch_not_covered", message: `Batch "${input.batchCode}" is not covered by the approved specification.` });
      if (!isSpecComplete(specToCheck))
        findings.push({ kind: "spec_incomplete", message: "The approved specification is incomplete (some answers are unknown)." });
    } else if (observed === ordered.id) {
      findings.push({ kind: "no_approved_spec", message: "There is no approved specification on file for this product." });
    }
    if (meta.knownSpecIdAtCapture !== null && meta.knownSpecIdAtCapture !== ordered.approvedSpecId)
      findings.push({ kind: "spec_changed_since_capture", message: "The approved specification changed after this delivery was written down." });

    const deliveryId = this.id(s, "del");
    let caseId: string | null = null;
    if (findings.length > 0) {
      outcome = "review_required";
      caseId = this.id(s, "case");
      const now = this.iso(s);
      s.cases.push({
        id: caseId, tenantId: site.tenantId, siteId: input.siteId, deliveryId, orderedProductId: ordered.id,
        observedProductId: observed, state: "review_required", version: 1, openedAt: now, specId: null, impact: null,
        decision: null, substitutionId: null,
        events: [{ at: now, actorId: recordedBy, action: "opened", note: findings.map((f) => f.kind).join(", ") }]
      });
    }
    const delivery: Delivery = {
      ...input, barcode, id: deliveryId, tenantId: site.tenantId, receivedBy: recordedBy, receivedAt: this.iso(s),
      observedProductId: observed, findings, outcome, caseId, dedupeKey, source: meta.source, capturedAt: meta.capturedAt
    };
    s.deliveries.push(delivery);
    if (key) s.requests[key] = deliveryId;
    this.audit(s, recordedBy, site.tenantId, input.siteId, "delivery.recorded", "delivery", deliveryId, `outcome=${outcome}; findings=${findings.map((f) => f.kind).join(",") || "none"}; source=${meta.source}`);
    return { delivery, duplicate: false, caseId };
  }

  /** "Offline" for this local-only app: write the delivery down now, check it later (see DECISIONS). Nothing is treated as checked while queued. */
  queueReceiving(actorId: string, input: ReceivingInput, requestId: string) {
    return this.tx((s) => {
      const { site } = this.auth(s, actorId, "receive", input.siteId);
      const prior = s.outbox.find((q) => q.requestId === requestId && q.capturedBy === actorId);
      if (prior) return prior;
      const ordered = s.products.find((p) => p.id === input.orderedProductId && p.tenantId === site.tenantId);
      if (!ordered) throw invalid("Choose the product that was ordered.");
      const q = {
        id: this.id(s, "q"), requestId, tenantId: site.tenantId, siteId: input.siteId, input, capturedBy: actorId,
        capturedAt: this.iso(s), knownSpecIdAtCapture: ordered.approvedSpecId, status: "queued" as const, deliveryId: null
      };
      s.outbox.push(q);
      this.audit(s, actorId, site.tenantId, input.siteId, "delivery.queued", "outbox", q.id, "captured without checking");
      return q;
    });
  }

  reconcileOutbox(actorId: string, siteId: string): { reconciled: number; casesOpened: number; duplicates: number } {
    return this.tx((s) => {
      this.auth(s, actorId, "receive", siteId);
      let reconciled = 0, casesOpened = 0, duplicates = 0;
      for (const q of s.outbox.filter((x) => x.siteId === siteId && x.status === "queued")) {
        // Authorise as the person reconciling, but the record stays attributed to who captured it.
        const r = this.doReceive(s, actorId, q.capturedBy, q.input, { source: "queued", requestId: `q:${q.requestId}`, capturedAt: q.capturedAt, knownSpecIdAtCapture: q.knownSpecIdAtCapture });
        q.status = "reconciled";
        q.deliveryId = r.delivery.id;
        reconciled++;
        if (r.duplicate) duplicates++;
        if (!r.duplicate && r.caseId) casesOpened++;
      }
      this.audit(s, actorId, this.siteOf(s, siteId).tenantId, siteId, "outbox.reconciled", "site", siteId, `${reconciled} records`);
      return { reconciled, casesOpened, duplicates };
    });
  }

  // ---------------------------------------------------------------- review
  private checkVersion(c: ReviewCase, expected: number) {
    if (c.version !== expected)
      throw new DomainError("version_conflict", "Someone else changed this review since you opened it. Reload and look again.", { current: c.version, expected });
  }
  private assertOpen(c: ReviewCase) {
    if (c.state === "approved" || c.state === "rejected") throw new DomainError("version_conflict", `This review is already ${c.state}.`);
  }

  verifySpecification(
    actorId: string, caseId: string, expectedVersion: number,
    input: { existingSpecId?: string; newProduct?: { name: string; supplier: string }; spec?: SpecInput }
  ): SpecRevision {
    return this.tx((s) => {
      const c = this.caseOf(s, actorId, caseId, "verify_spec");
      this.checkVersion(c, expectedVersion);
      this.assertOpen(c);
      const delivery = s.deliveries.find((d) => d.id === c.deliveryId)!;
      let spec: SpecRevision;
      if (input.existingSpecId) {
        const found = s.specs.find((x) => x.id === input.existingSpecId && x.tenantId === c.tenantId && x.status === "verified");
        if (!found) throw notFound("Specification");
        spec = found;
      } else {
        const si = input.spec;
        if (!si) throw invalid("Enter the specification details.");
        if (si.evidenceReference.trim().length < 3) throw invalid("Say where this information came from (for example the supplier sheet reference).");
        if (!si.label.trim()) throw invalid("Enter the supplier's version label for this specification.");
        for (const a of ALLERGENS) {
          if (!["declared", "not_declared", "unknown"].includes(si.contains[a])) throw invalid(`Allergen answer missing for ${ALLERGEN_LABEL[a]}.`);
          if (!["stated", "not_stated", "unknown"].includes(si.precautionary[a])) throw invalid(`Precautionary answer missing for ${ALLERGEN_LABEL[a]}.`);
        }
        let productId = c.observedProductId;
        if (!productId) {
          if (!input.newProduct?.name.trim()) throw invalid("Give the new product a name.");
          if (!isValidGtin(delivery.barcode)) throw invalid("The delivered barcode is not valid, so a new product cannot be created from it. Correct the receiving record first.");
          productId = this.id(s, "prod");
          s.products.push({
            id: productId, tenantId: c.tenantId, name: input.newProduct.name.trim(), supplier: input.newProduct.supplier.trim() || "Unknown supplier",
            barcodes: [delivery.barcode], kind: "ingredient", status: "proposed", approvedSpecId: null
          });
          c.observedProductId = productId;
        }
        const revision = Math.max(0, ...s.specs.filter((x) => x.productId === productId).map((x) => x.revision)) + 1;
        spec = {
          id: this.id(s, "spec"), tenantId: c.tenantId, productId, revision, label: si.label.trim(), packSize: si.packSize.trim(),
          batchCodes: si.batchCodes && si.batchCodes.length ? si.batchCodes.map((b) => b.trim()) : null,
          ingredientsText: si.ingredientsText.trim(), contains: { ...si.contains }, precautionary: { ...si.precautionary },
          evidence: { reference: si.evidenceReference.trim(), note: si.evidenceNote.trim(), enteredBy: actorId, enteredAt: this.iso(s) },
          status: "verified", verifiedBy: actorId, verifiedAt: this.iso(s)
        };
        s.specs.push(spec);
      }
      c.specId = spec.id;
      c.impact = null;
      c.state = "spec_attached";
      c.version += 1;
      c.events.push({ at: this.iso(s), actorId, action: "spec_attached", note: `${spec.id}${isSpecComplete(spec) ? "" : " (incomplete)"}` });
      this.audit(s, actorId, c.tenantId, c.siteId, "spec.verified", "spec", spec.id, `case=${c.id}; complete=${isSpecComplete(spec)}`);
      return spec;
    });
  }

  private computeImpact(s: AppState, c: ReviewCase, actorId: string): Impact {
    const spec = s.specs.find((x) => x.id === c.specId)!;
    const hyp = { siteId: c.siteId, replaces: c.orderedProductId, withProductId: spec.productId, specId: spec.id, batchCodes: spec.batchCodes };
    const items: ImpactItem[] = [];
    const stale = new Set<string>();
    const reasons = new Set<string>();
    for (const r of s.recipes) {
      const path = pathToProduct(s, c.siteId, r.id, c.orderedProductId);
      if (!path) continue;
      const before = declare(s, r.id, c.siteId, { ignoreCaseId: c.id });
      const after = declare(s, r.id, c.siteId, { ignoreCaseId: c.id, hypothetical: hyp });
      items.push({ recipeId: r.id, name: r.name, kind: r.kind, path, before: brief(before), after: brief(after) });
      staleReferences(s, c.siteId, r.id).forEach((n) => stale.add(n));
      if (r.kind === "dish") after.reasons.forEach((x) => reasons.add(x));
    }
    items.sort((a, b) => a.recipeId.localeCompare(b.recipeId));
    const digest = sha(stableStringify({ case: c.id, spec: spec.id, items, stale: [...stale].sort() })).slice(0, 24);
    return { digest, computedAt: this.iso(s), computedBy: actorId, items, stale: [...stale].sort(), unresolvedReasons: [...reasons] };
  }

  reviewImpact(actorId: string, caseId: string, expectedVersion: number): Impact {
    return this.tx((s) => {
      const c = this.caseOf(s, actorId, caseId, "review_impact");
      this.checkVersion(c, expectedVersion);
      this.assertOpen(c);
      if (!c.specId) throw invalid("Check the specification first (step 1).");
      c.impact = this.computeImpact(s, c, actorId);
      c.state = "impact_reviewed";
      c.version += 1;
      c.events.push({ at: this.iso(s), actorId, action: "impact_reviewed", note: `${c.impact.items.length} recipes; digest ${c.impact.digest}` });
      this.audit(s, actorId, c.tenantId, c.siteId, "impact.reviewed", "case", c.id, `digest=${c.impact.digest}`);
      return c.impact;
    });
  }

  rejectCase(actorId: string, caseId: string, expectedVersion: number, reason: string): ReviewCase {
    return this.tx((s) => {
      const site = s.cases.find((x) => x.id === caseId)?.siteId;
      if (!site) throw forbidden();
      let c: ReviewCase;
      try { c = this.caseOf(s, actorId, caseId, "reject_case"); } catch { throw forbidden(); }
      this.checkVersion(c, expectedVersion);
      this.assertOpen(c);
      if (reason.trim().length < 5) throw invalid("Say why this product is not approved.");
      c.state = "rejected";
      c.version += 1;
      c.events.push({ at: this.iso(s), actorId, action: "rejected", note: reason.trim() });
      this.audit(s, actorId, c.tenantId, c.siteId, "case.rejected", "case", c.id, "");
      return c;
    });
  }

  activeOverride(s: AppState, kind: OverrideKind, siteId: string, match: { actorId?: string; recipeId?: string }): Override | undefined {
    const now = this.now(s).getTime();
    return s.overrides.find(
      (o) => o.kind === kind && o.siteId === siteId && o.revokedAt === null && Date.parse(o.expiresAt) > now &&
        (match.actorId === undefined || o.actorId === match.actorId) && (match.recipeId === undefined || o.recipeId === match.recipeId)
    );
  }

  approveCase(
    actorId: string, caseId: string,
    req: { expectedVersion: number; specId: string; impactDigest: string; requestId: string; batchCodes?: string[] | null }
  ): { substitution: Substitution; replayed: boolean } {
    return this.tx((s) => {
      const c = this.caseOf(s, actorId, caseId, "approve_case");
      const key = `${actorId}|approve|${req.requestId}`;
      const prior = this.idem(s, key);
      if (prior) return { substitution: s.substitutions.find((x) => x.id === prior)!, replayed: true };
      this.checkVersion(c, req.expectedVersion);
      this.assertOpen(c);
      if (c.state !== "impact_reviewed" || !c.specId || !c.impact) throw invalid("Finish steps 1 and 2 (check the specification and the affected recipes) before approving.");
      if (req.specId !== c.specId) throw new DomainError("wrong_revision", "You approved a different specification revision from the one now attached to this review.");
      const spec = s.specs.find((x) => x.id === c.specId)!;
      if (spec.status !== "verified") throw new DomainError("wrong_revision", "That specification revision is no longer current.");
      const fresh = this.computeImpact(s, c, actorId);
      if (req.impactDigest !== c.impact.digest || fresh.digest !== c.impact.digest)
        throw new DomainError("stale_basis", "The affected recipes changed since the impact was reviewed. Review the impact again.");
      if (!isSpecComplete(spec))
        throw new DomainError("validation", "This specification has UNKNOWN answers or no evidence, so it cannot be approved. Get the missing information first.");
      const delivery = s.deliveries.find((d) => d.id === c.deliveryId)!;
      const batchCodes = req.batchCodes === undefined ? spec.batchCodes : req.batchCodes;
      if (batchCodes && !batchCodes.includes(delivery.batchCode.trim())) throw invalid("The batch list must include the delivered batch.");
      const changed = c.impact.items.some((i) => stableStringify(i.before) !== stableStringify(i.after));
      const consequential = spec.productId !== c.orderedProductId || changed;
      let viaOverrideId: string | null = null;
      if (consequential && (actorId === delivery.receivedBy || actorId === spec.verifiedBy)) {
        const ex = this.activeOverride(s, "sod_exception", c.siteId, { actorId });
        if (!ex)
          throw new DomainError("separation_of_duties", "A different person must approve this change. You recorded the delivery or checked the specification. (A reviewed, recorded small-team exception would be needed.)");
        viaOverrideId = ex.id;
      }
      const now = this.iso(s);
      for (const old of s.substitutions.filter((x) => x.siteId === c.siteId && x.replacesProductId === c.orderedProductId && x.endedAt === null)) {
        old.endedAt = now; old.endedBy = actorId; old.endReason = "Replaced by a newer approved substitution";
      }
      const sub: Substitution = {
        id: this.id(s, "sub"), tenantId: c.tenantId, siteId: c.siteId, caseId: c.id, replacesProductId: c.orderedProductId,
        withProductId: spec.productId, specId: spec.id, batchCodes: batchCodes ?? null, approvedBy: actorId, approvedAt: now,
        endedAt: null, endedBy: null, endReason: null
      };
      s.substitutions.push(sub);
      const prod = s.products.find((p) => p.id === spec.productId)!;
      if (prod.status === "proposed") { prod.status = "approved"; prod.approvedSpecId = spec.id; }
      c.state = "approved";
      c.version += 1;
      c.substitutionId = sub.id;
      c.decision = { by: actorId, at: now, requestId: req.requestId, specId: spec.id, impactDigest: c.impact.digest, viaOverrideId };
      c.events.push({ at: now, actorId, action: "approved", note: `${sub.id}${viaOverrideId ? ` via exception ${viaOverrideId}` : ""}` });
      s.requests[key] = sub.id;
      this.audit(s, actorId, c.tenantId, c.siteId, "case.approved", "substitution", sub.id, `spec=${spec.id}; impact=${c.impact.digest}; override=${viaOverrideId ?? "none"}`);
      return { substitution: sub, replayed: false };
    });
  }

  endSubstitution(actorId: string, substitutionId: string, reason: string): Substitution {
    return this.tx((s) => {
      const sub = s.substitutions.find((x) => x.id === substitutionId);
      if (!sub) throw forbidden();
      this.auth(s, actorId, "end_substitution", sub.siteId);
      if (sub.endedAt) return sub;
      if (reason.trim().length < 5) throw invalid("Say why this substitution is ending (for example: batch used up).");
      sub.endedAt = this.iso(s); sub.endedBy = actorId; sub.endReason = reason.trim();
      this.audit(s, actorId, sub.tenantId, sub.siteId, "substitution.ended", "substitution", sub.id, "");
      return sub;
    });
  }

  // ---------------------------------------------------------------- recipes
  /** Adds an approved recipe version. Rejects dependency cycles and unknown references. */
  addRecipeVersion(actorId: string, input: { recipeId?: string; newRecipe?: { name: string; kind: "dish" | "component" }; components: Component[]; siteIds: string[] }) {
    return this.tx((s) => {
      const site0 = input.siteIds[0];
      if (!site0) throw invalid("Choose at least one site.");
      const { site } = this.auth(s, actorId, "approve_recipe", site0);
      return this.addVersion(s, actorId, site.tenantId, input);
    });
  }

  addVersion(s: AppState, actorId: string, tenantId: string, input: { recipeId?: string; newRecipe?: { name: string; kind: "dish" | "component" }; components: Component[]; siteIds: string[] }) {
    for (const sid of input.siteIds) if (s.sites.find((x) => x.id === sid)?.tenantId !== tenantId) throw forbidden();
    let recipeId = input.recipeId;
    if (recipeId) {
      if (s.recipes.find((r) => r.id === recipeId)?.tenantId !== tenantId) throw forbidden();
    } else {
      if (!input.newRecipe?.name.trim()) throw invalid("Name the recipe.");
      recipeId = this.id(s, "rec");
      s.recipes.push({ id: recipeId, tenantId, name: input.newRecipe.name.trim(), kind: input.newRecipe.kind });
    }
    for (const c of input.components) {
      if (c.kind === "product" && s.products.find((p) => p.id === c.productId)?.tenantId !== tenantId) throw invalid("Unknown product in recipe.");
      if (c.kind === "recipe" && s.recipes.find((r) => r.id === c.recipeId)?.tenantId !== tenantId) throw invalid("Unknown sub-recipe in recipe.");
    }
    const childIds = input.components.flatMap((c) => (c.kind === "recipe" ? [c.recipeId] : []));
    const cycle = findCycle(recipeEdges(s, { recipeId, childRecipeIds: childIds }));
    if (cycle) {
      const names = cycle.map((id) => s.recipes.find((r) => r.id === id)?.name ?? id);
      throw new DomainError("cycle", `This would make recipes depend on themselves: ${names.join(" -> ")}.`, { cycle });
    }
    const version = Math.max(0, ...s.recipeVersions.filter((v) => v.recipeId === recipeId).map((v) => v.version)) + 1;
    for (const v of s.recipeVersions) {
      if (v.recipeId === recipeId && v.status === "approved" && v.siteIds.every((x) => input.siteIds.includes(x))) v.status = "superseded";
    }
    const rv = {
      id: this.id(s, "rv"), recipeId, tenantId, version, components: input.components, siteIds: [...input.siteIds],
      status: "approved" as const, createdBy: actorId, approvedBy: actorId, approvedAt: this.iso(s)
    };
    s.recipeVersions.push(rv);
    this.audit(s, actorId, tenantId, null, "recipe.version_added", "recipe_version", rv.id, `recipe=${recipeId} v${version}`);
    return rv;
  }

  // ---------------------------------------------------------------- controls
  setKitchenControl(actorId: string, siteId: string, allergen: Allergen, note: string) {
    return this.tx((s) => {
      const { site } = this.auth(s, actorId, "set_controls", siteId);
      if (!isAllergen(allergen)) throw invalid("Unknown allergen.");
      if (note.trim().length < 5) throw invalid("Describe the kitchen control in a few words.");
      s.controls = s.controls.filter((c) => !(c.siteId === siteId && c.allergen === allergen));
      const c = { id: this.id(s, "ctl"), tenantId: site.tenantId, siteId, allergen, note: note.trim(), setBy: actorId, setAt: this.iso(s) };
      s.controls.push(c);
      this.audit(s, actorId, site.tenantId, siteId, "control.set", "control", c.id, allergen);
      return c;
    });
  }

  // ---------------------------------------------------------------- publication
  /** Hash of everything a publication depends on. If it changes, an already-prepared publication is stale. */
  basisOf(s: AppState, siteId: string): string {
    const decl = siteDeclarations(s, siteId).map((d) => ({ r: d.recipeId, v: d.recipeVersionId, c: d.contains, m: d.mayContain, u: d.unresolved, ok: d.resolved, sp: d.specIds, sb: d.substitutionIds }));
    const open = s.cases.filter((c) => c.siteId === siteId && c.state !== "approved" && c.state !== "rejected").map((c) => c.id);
    const queued = s.outbox.filter((q) => q.siteId === siteId && q.status === "queued").map((q) => q.id);
    const ctl = s.controls.filter((c) => c.siteId === siteId).map((c) => [c.allergen, c.note]);
    return sha(stableStringify({ decl, open, queued, ctl }));
  }

  latestPublication(s: AppState, siteId: string): Publication | undefined {
    return s.publications.filter((p) => p.siteId === siteId).sort((a, b) => b.revision - a.revision)[0];
  }

  preparePublication(actorId: string, siteId: string, requestId: string): { publication: Publication; replayed: boolean } {
    return this.tx((s) => {
      const { site } = this.auth(s, actorId, "prepare_publication", siteId);
      const key = `${actorId}|prepare|${requestId}`;
      const prior = this.idem(s, key);
      if (prior) return { publication: s.publications.find((p) => p.id === prior)!, replayed: true };
      const dishes = siteDeclarations(s, siteId);
      if (dishes.length === 0) throw new DomainError("publish_blocked", "There are no approved dishes at this site to publish.");
      const blockers: string[] = [];
      const overrideIds: string[] = [];
      for (const d of dishes) {
        if (d.resolved) continue;
        const ov = this.activeOverride(s, "publish_unresolved_with_warning", siteId, { recipeId: d.recipeId });
        if (ov) overrideIds.push(ov.id);
        else blockers.push(`${d.recipeName}: UNKNOWN - cannot be used on a menu. ${d.reasons[0] ?? ""}`.trim());
      }
      if (blockers.length) throw new DomainError("publish_blocked", "Publishing is blocked because some dishes are unresolved.", { blockers });
      const rev = Math.max(0, ...s.publications.filter((p) => p.siteId === siteId).map((p) => p.revision)) + 1;
      const emptyChannel = (): ChannelState => ({ status: "pending", attempts: 0, lastError: null, lastAttemptAt: null, lastRequestId: null, publishedAt: null });
      const subs = [...new Set(dishes.flatMap((d) => d.substitutionIds))];
      const pub: Publication = {
        id: this.id(s, "pub"), tenantId: site.tenantId, siteId, revision: rev, createdBy: actorId, createdAt: this.iso(s),
        basisHash: this.basisOf(s, siteId), dishes, kitchenControlLines: kitchenControlLines(s.controls, siteId),
        sources: {
          substitutionIds: subs, specIds: [...new Set(dishes.flatMap((d) => d.specIds))],
          caseIds: subs.map((id) => s.substitutions.find((x) => x.id === id)!.caseId), overrideIds
        },
        channels: { qr_web: emptyChannel(), service_view: emptyChannel(), printed_menu: emptyChannel() }
      };
      s.publications.push(pub);
      s.requests[key] = pub.id;
      this.audit(s, actorId, site.tenantId, siteId, "publication.prepared", "publication", pub.id, `revision=${rev}`);
      return { publication: pub, replayed: false };
    });
  }

  publishChannel(actorId: string, publicationId: string, channel: Channel, requestId: string): { ok: boolean; replayed: boolean; error: string | null } {
    return this.tx((s) => {
      if (!CHANNELS.includes(channel)) throw invalid("Unknown channel.");
      const pub = s.publications.find((p) => p.id === publicationId);
      if (!pub) throw forbidden();
      this.auth(s, actorId, "publish_channel", pub.siteId);
      const key = `${actorId}|channel|${publicationId}|${channel}|${requestId}`;
      const st = pub.channels[channel];
      if (this.idem(s, key)) return { ok: st.status === "published", replayed: true, error: st.lastError };
      const latest = this.latestPublication(s, pub.siteId)!;
      if (pub.revision < latest.revision)
        throw new DomainError("superseded", `Revision ${pub.revision} has been replaced by revision ${latest.revision}. Use the newest one.`);
      if (st.status === "published") { s.requests[key] = pub.id; return { ok: true, replayed: true, error: null }; }
      if (this.basisOf(s, pub.siteId) !== pub.basisHash)
        throw new DomainError("stale_basis", "Declarations changed (for example a delivery is awaiting review) since this revision was prepared. Prepare a new revision.");
      for (const d of pub.dishes) {
        if (!d.resolved && !this.activeOverride(s, "publish_unresolved_with_warning", pub.siteId, { recipeId: d.recipeId }))
          throw new DomainError("publish_blocked", `${d.recipeName} is UNKNOWN and its override has expired or was withdrawn.`);
      }
      let res: ChannelResult;
      try { res = this.adapter(channel, pub); } catch (e) { res = { ok: false, error: e instanceof Error ? e.message : "Channel failed" }; }
      const now = this.iso(s);
      st.attempts += 1; st.lastAttemptAt = now; st.lastRequestId = requestId;
      if (res.ok) { st.status = "published"; st.publishedAt = now; st.lastError = null; }
      else { st.status = "failed"; st.lastError = res.error; }
      s.requests[key] = pub.id;
      this.audit(s, actorId, pub.tenantId, pub.siteId, res.ok ? "channel.published" : "channel.failed", "publication", pub.id, `${channel} revision=${pub.revision}`);
      return { ok: res.ok, replayed: false, error: res.ok ? null : res.error };
    });
  }

  // ---------------------------------------------------------------- acknowledgement
  acknowledge(actorId: string, publicationId: string, revision: number) {
    return this.tx((s) => {
      const pub = s.publications.find((p) => p.id === publicationId);
      if (!pub) throw forbidden();
      this.auth(s, actorId, "acknowledge", pub.siteId);
      const existing = s.acks.find((a) => a.publicationId === publicationId && a.staffId === actorId);
      if (existing) return existing;
      if (revision !== pub.revision) throw new DomainError("wrong_revision", `You confirmed revision ${revision}, but this is revision ${pub.revision}.`);
      const latest = this.latestPublication(s, pub.siteId)!;
      if (pub.revision !== latest.revision) throw new DomainError("superseded", `Revision ${pub.revision} is out of date. The current one is revision ${latest.revision}.`);
      if (pub.channels.service_view.status !== "published") throw new DomainError("validation", "The service view has not been updated for this revision yet, so it cannot be acknowledged.");
      const a = { id: this.id(s, "ack"), tenantId: pub.tenantId, siteId: pub.siteId, staffId: actorId, publicationId, revision: pub.revision, ackedAt: this.iso(s) };
      s.acks.push(a);
      this.audit(s, actorId, pub.tenantId, pub.siteId, "ack.recorded", "publication", pub.id, `revision=${pub.revision}`);
      return a;
    });
  }

  // ---------------------------------------------------------------- overrides
  grantOverride(
    actorId: string,
    input: { kind: OverrideKind; siteId: string; actorId?: string; recipeId?: string; reason: string; days: number }
  ): Override {
    return this.tx((s) => {
      const { site } = this.auth(s, actorId, "grant_override", input.siteId);
      if (input.kind !== "sod_exception" && input.kind !== "publish_unresolved_with_warning")
        throw invalid("That kind of override does not exist. No override can mark unknown data as free from an allergen.");
      if (input.reason.trim().length < 15) throw invalid("Write the reason in a full sentence (at least 15 characters).");
      if (!Number.isFinite(input.days) || input.days < 1 || input.days > MAX_OVERRIDE_DAYS) throw invalid(`Overrides must expire: choose 1 to ${MAX_OVERRIDE_DAYS} days.`);
      let beneficiary: string | null = null;
      let recipeId: string | null = null;
      if (input.kind === "sod_exception") {
        if (!input.actorId) throw invalid("Choose who the exception is for.");
        if (input.actorId === actorId) throw new DomainError("separation_of_duties", "You cannot grant an exception to yourself.");
        const b = s.staff.find((x) => x.id === input.actorId);
        if (!b || b.tenantId !== site.tenantId || b.status !== "active") throw invalid("Choose an active member of this kitchen.");
        if (!rolesAt(s, b.id, input.siteId).includes("publication_approver")) throw invalid("An exception only makes sense for someone who already holds the approver role at this site.");
        beneficiary = b.id;
      } else {
        const r = s.recipes.find((x) => x.id === input.recipeId && x.tenantId === site.tenantId && x.kind === "dish");
        if (!r) throw invalid("Choose the dish this override covers.");
        recipeId = r.id;
      }
      const now = this.now(s);
      const o: Override = {
        id: this.id(s, "ovr"), tenantId: site.tenantId, siteId: input.siteId, kind: input.kind, actorId: beneficiary, recipeId,
        reason: input.reason.trim(), grantedBy: actorId, grantedAt: now.toISOString(), expiresAt: new Date(now.getTime() + input.days * DAY).toISOString(), revokedAt: null
      };
      s.overrides.push(o);
      this.audit(s, actorId, site.tenantId, input.siteId, "override.granted", "override", o.id, `${o.kind}; expires ${o.expiresAt}`);
      return o;
    });
  }

  revokeOverride(actorId: string, overrideId: string) {
    return this.tx((s) => {
      const o = s.overrides.find((x) => x.id === overrideId);
      if (!o) throw forbidden();
      this.auth(s, actorId, "grant_override", o.siteId);
      if (!o.revokedAt) { o.revokedAt = this.iso(s); this.audit(s, actorId, o.tenantId, o.siteId, "override.revoked", "override", o.id, ""); }
      return o;
    });
  }

  // ---------------------------------------------------------------- staff
  addStaff(actorId: string, input: { name: string; grants: Array<{ role: Role; siteId: string }> }) {
    return this.tx((s) => {
      const actor = s.staff.find((x) => x.id === actorId);
      if (!actor) throw forbidden();
      authorize(s, actorId, "manage_staff", actor.tenantId, null);
      if (!input.name.trim()) throw invalid("Enter a name. Everyone needs their own login; shared accounts are not allowed.");
      const id = this.id(s, "staff");
      s.staff.push({ id, tenantId: actor.tenantId, name: input.name.trim(), status: "active", offboardedAt: null, erased: false });
      for (const g of input.grants) {
        if (g.siteId !== "*" && s.sites.find((x) => x.id === g.siteId)?.tenantId !== actor.tenantId) throw forbidden();
        s.memberships.push({ id: this.id(s, "mem"), staffId: id, tenantId: actor.tenantId, siteId: g.siteId, role: g.role, endedAt: null });
      }
      this.audit(s, actorId, actor.tenantId, null, "staff.added", "staff", id, "");
      return id;
    });
  }

  offboardStaff(actorId: string, staffId: string) {
    return this.tx((s) => {
      const actor = s.staff.find((x) => x.id === actorId);
      if (!actor) throw forbidden();
      authorize(s, actorId, "manage_staff", actor.tenantId, null);
      const t = s.staff.find((x) => x.id === staffId);
      if (!t || t.tenantId !== actor.tenantId) throw forbidden();
      if (t.status === "offboarded") return t;
      const admins = s.staff.filter((x) => x.tenantId === actor.tenantId && x.status === "active" && s.memberships.some((m) => m.staffId === x.id && m.endedAt === null && m.role === "administrator" && m.siteId === "*"));
      if (admins.length === 1 && admins[0]!.id === t.id) throw invalid("You cannot offboard the last administrator.");
      const now = this.iso(s);
      t.status = "offboarded"; t.offboardedAt = now;
      for (const m of s.memberships) if (m.staffId === t.id && m.endedAt === null) m.endedAt = now;
      for (const o of s.overrides) if (o.actorId === t.id && !o.revokedAt) o.revokedAt = now;
      this.audit(s, actorId, actor.tenantId, null, "staff.offboarded", "staff", t.id, "");
      return t;
    });
  }

  /** Removes personal details; keeps the audit trail with a documented reason. */
  requestStaffErasure(actorId: string, staffId: string) {
    return this.tx((s) => {
      const actor = s.staff.find((x) => x.id === actorId);
      if (!actor) throw forbidden();
      authorize(s, actorId, "erase_staff", actor.tenantId, null);
      const t = s.staff.find((x) => x.id === staffId);
      if (!t || t.tenantId !== actor.tenantId) throw forbidden();
      if (t.status !== "offboarded") throw invalid("Offboard the person first.");
      if (t.erased) return s.retention.find((r) => r.subjectId === staffId)!;
      const n = s.retention.length + 1;
      t.name = `Former staff member ${n}`; t.erased = true;
      const rec = {
        id: this.id(s, "ret"), tenantId: actor.tenantId, subjectType: "staff" as const, subjectId: t.id, requestedBy: actorId, at: this.iso(s),
        deleted: ["Display name replaced with a neutral label"],
        retained: [
          { what: "Audit events and approvals attributed to the pseudonymous staff id", why: "Needed to show who approved a change to allergen declarations and when. The retention period is NOT decided; open item for legal and food-safety review." },
          { what: "Approved publications, substitutions and acknowledgements that reference the staff id", why: "Published declarations are an operational record; they cannot be edited, and deleting them would break the source-linked history." }
        ]
      };
      s.retention.push(rec);
      this.audit(s, actorId, actor.tenantId, null, "staff.erased", "staff", t.id, "personal details removed; audit retained");
      return rec;
    });
  }


  // ---------------------------------------------------------------- catalogue (own kitchen)
  /**
   * Adds an approved ingredient with its supplier specification as the evidence. Catalogue entry is attributable (audit)
   * but is not a substitution approval: a product that arrives in place of another still needs the full review.
   */
  addProduct(actorId: string, input: { siteId: string; name: string; supplier: string; barcode: string; spec: SpecInput }): { productId: string; specId: string } {
    return this.tx((s) => {
      const { site } = this.auth(s, actorId, "manage_catalogue", input.siteId);
      if (!input.name.trim()) throw invalid("Give the product a name.");
      const barcode = normaliseBarcode(input.barcode);
      if (barcode && !isValidGtin(barcode)) throw invalid("That barcode number is not valid (check the digits), or leave it empty and add it later.");
      if (barcode && s.products.some((p) => p.tenantId === site.tenantId && p.barcodes.includes(barcode))) throw invalid("This barcode already belongs to another product.");
      const si = input.spec;
      if (si.evidenceReference.trim().length < 3) throw invalid("Say where the allergen information came from (for example the supplier sheet reference).");
      if (!si.label.trim()) throw invalid("Enter the supplier's version label for the specification.");
      if (!si.packSize.trim()) throw invalid("Enter the pack size.");
      const productId = this.id(s, "prod");
      const specId = this.id(s, "spec");
      const now = this.iso(s);
      s.products.push({ id: productId, tenantId: site.tenantId, name: input.name.trim(), supplier: input.supplier.trim() || "Unknown supplier", barcodes: barcode ? [barcode] : [], kind: "ingredient", status: "approved", approvedSpecId: specId });
      s.specs.push({
        id: specId, tenantId: site.tenantId, productId, revision: 1, label: si.label.trim(), packSize: si.packSize.trim(), batchCodes: null,
        ingredientsText: si.ingredientsText.trim(), contains: { ...si.contains }, precautionary: { ...si.precautionary },
        evidence: { reference: si.evidenceReference.trim(), note: si.evidenceNote.trim(), enteredBy: actorId, enteredAt: now },
        status: "verified", verifiedBy: actorId, verifiedAt: now
      });
      this.audit(s, actorId, site.tenantId, input.siteId, "product.added", "product", productId, `spec=${specId}; complete=${isSpecComplete(s.specs[s.specs.length - 1]!)}`);
      return { productId, specId };
    });
  }

  // ---------------------------------------------------------------- per-person PIN
  /** A person sets their own PIN, or an administrator sets it for someone. The PIN itself is never stored or logged. */
  setPin(actorId: string, staffId: string, pin: string): void {
    const rec = makePinRecord(pin); // validates; slow hash computed outside the transaction work
    this.storePin(actorId, staffId, rec);
  }
  storePin(actorId: string, staffId: string, rec: PinRecord): void {
    this.tx((s) => {
      const actor = s.staff.find((x) => x.id === actorId);
      const target = s.staff.find((x) => x.id === staffId);
      if (!actor || !target || actor.tenantId !== target.tenantId || actor.status !== "active" || target.status !== "active") throw forbidden();
      if (actorId !== staffId) authorize(s, actorId, "manage_staff", actor.tenantId, null);
      s.pins = { ...(s.pins ?? {}), [staffId]: { ...rec, setAt: this.iso(s) } };
      this.audit(s, actorId, actor.tenantId, null, "pin.set", "staff", staffId, actorId === staffId ? "own PIN" : "set by administrator");
    });
  }
  /** An administrator clears someone's PIN (forgotten PIN). The person chooses a new one at their next sign-in. The administrator never learns it. */
  resetPin(actorId: string, staffId: string): void {
    this.tx((s) => {
      const actor = s.staff.find((x) => x.id === actorId);
      const target = s.staff.find((x) => x.id === staffId);
      if (!actor || !target || actor.tenantId !== target.tenantId) throw forbidden();
      authorize(s, actorId, "manage_staff", actor.tenantId, null);
      if (actorId === staffId) throw invalid("Ask another administrator to reset your PIN, or sign out and use Switch person.");
      if (s.pins) { const { [staffId]: _gone, ...rest } = s.pins; s.pins = rest; }
      this.audit(s, actorId, actor.tenantId, null, "pin.reset", "staff", staffId, "cleared; person chooses a new PIN at next sign-in");
    });
  }
  /** Audit-only record that a person signed in or a sensitive action was re-confirmed with the PIN (no secret in the record). */
  recordSession(staffId: string, event: "signed_in" | "locked" | "pin_failed" | "reconfirmed", detail = ""): void {
    this.tx((s) => {
      const t = s.staff.find((x) => x.id === staffId);
      if (!t) throw forbidden();
      this.audit(s, staffId, t.tenantId, null, `session.${event}`, "staff", staffId, detail);
    });
  }

  // ---------------------------------------------------------------- demo clock
  advanceClock(ms: number): void {
    this.tx((s) => { s.clockOffsetMs += ms; });
  }

  // ---------------------------------------------------------------- reads (all authorised)
  casesAt(actorId: string, siteId: string): ReviewCase[] {
    this.auth(this.state, actorId, "read", siteId);
    return this.state.cases.filter((c) => c.siteId === siteId);
  }
  publicationsAt(actorId: string, siteId: string): Publication[] {
    this.auth(this.state, actorId, "read", siteId);
    return this.state.publications.filter((p) => p.siteId === siteId).sort((a, b) => b.revision - a.revision);
  }
  declarationsAt(actorId: string, siteId: string) {
    this.auth(this.state, actorId, "read", siteId);
    return siteDeclarations(this.state, siteId);
  }

  channelStatus(siteId: string) {
    return channelStatus(this.state, siteId);
  }
  outstandingAcks(siteId: string) {
    return outstandingAcks(this.state, siteId);
  }

  exportHistory(actorId: string, siteId: string) {
    const s = this.state;
    const { site } = this.auth(s, actorId, "export", siteId);
    const pubs = this.publicationsAt(actorId, siteId);
    const latest = pubs[0];
    const productName = (id: string) => s.products.find((p) => p.id === id)?.name ?? id;
    const chain = (subId: string) => {
      const sub = s.substitutions.find((x) => x.id === subId)!;
      const c = s.cases.find((x) => x.id === sub.caseId)!;
      const d = s.deliveries.find((x) => x.id === c.deliveryId)!;
      const spec = s.specs.find((x) => x.id === sub.specId)!;
      return {
        substitutionId: sub.id, replaces: productName(sub.replacesProductId), with: productName(sub.withProductId),
        approvedBy: sub.approvedBy, approvedAt: sub.approvedAt, ended: sub.endedAt,
        caseId: c.id, deliveryId: d.id, deliveryBatch: d.batchCode, deliveryNote: d.deliveryNoteRef, receivedBy: d.receivedBy,
        specId: spec.id, specLabel: spec.label, specVerifiedBy: spec.verifiedBy, evidence: spec.evidence
      };
    };
    return {
      exportedAt: this.iso(s),
      exportedBy: actorId,
      site: { id: site.id, name: site.name },
      synthetic: true,
      notice: "Source-linked history for review. A recorded history is not proof that a dish was safe.",
      menuVersions: pubs.map((p) => ({
        publicationId: p.id, revision: p.revision, createdAt: p.createdAt, createdBy: p.createdBy,
        menuStatus: p.id === latest!.id ? "ACTIVE (newest)" : "STALE (replaced by a newer revision)",
        channels: Object.fromEntries(CHANNELS.map((c) => [c, { status: p.channels[c].status, attempts: p.channels[c].attempts, lastError: p.channels[c].lastError }])),
        dishes: p.dishes.map((d) => ({ name: d.recipeName, recipeVersion: d.recipeVersion, resolved: d.resolved, lines: d.lines, specIds: d.specIds })),
        sources: p.sources.substitutionIds.map(chain)
      })),
      acknowledgements: s.acks.filter((a) => a.siteId === siteId),
      overrides: s.overrides.filter((o) => o.siteId === siteId),
      audit: s.audit.filter((a) => a.siteId === siteId || (a.siteId === null && a.tenantId === site.tenantId))
    };
  }
}

// ------------------------------------------------------------------ selectors
export interface ChannelView {
  channel: Channel;
  liveRevision: number | null;
  latestRevision: number | null;
  status: "current" | "stale" | "failed" | "pending" | "never";
  text: string;
}

export function channelStatus(s: AppState, siteId: string): ChannelView[] {
  const pubs = s.publications.filter((p) => p.siteId === siteId).sort((a, b) => b.revision - a.revision);
  const latest = pubs[0];
  return CHANNELS.map((channel) => {
    const live = pubs.find((p) => p.channels[channel].status === "published");
    const liveRevision = live?.revision ?? null;
    if (!latest) return { channel, liveRevision, latestRevision: null, status: "never", text: "Nothing prepared yet." };
    if (liveRevision === latest.revision) return { channel, liveRevision, latestRevision: latest.revision, status: "current", text: `Showing revision ${liveRevision} (newest).` };
    const st = latest.channels[channel];
    const old = liveRevision === null ? "Nothing has ever been published here." : `Still showing OLD revision ${liveRevision}.`;
    if (st.status === "failed") return { channel, liveRevision, latestRevision: latest.revision, status: "failed", text: `Update to revision ${latest.revision} FAILED (${st.lastError ?? "unknown error"}). ${old}` };
    return { channel, liveRevision, latestRevision: latest.revision, status: liveRevision === null ? "never" : "pending", text: `Not yet updated to revision ${latest.revision}. ${old}` };
  });
}

export function outstandingAcks(s: AppState, siteId: string): { revision: number | null; required: string[]; acked: string[]; outstanding: string[] } {
  const latest = s.publications.filter((p) => p.siteId === siteId).sort((a, b) => b.revision - a.revision)[0];
  if (!latest) return { revision: null, required: [], acked: [], outstanding: [] };
  const required = s.staff.filter((x) => x.status === "active" && rolesAt(s, x.id, siteId).includes("service_staff")).map((x) => x.id);
  const acked = required.filter((id) => s.acks.some((a) => a.publicationId === latest.id && a.staffId === id));
  return { revision: latest.revision, required, acked, outstanding: required.filter((id) => !acked.includes(id)) };
}

/** Is a physical copy (identified by the revision number printed on it) current? */
export function checkCopy(s: AppState, siteId: string, printedRevision: number): "current" | "stale" | "unknown" {
  const revs = s.publications.filter((p) => p.siteId === siteId).map((p) => p.revision);
  if (!revs.includes(printedRevision)) return "unknown";
  return printedRevision === Math.max(...revs) ? "current" : "stale";
}

export interface SiteStatus {
  openCases: number;
  queued: number;
  unresolvedDishes: string[];
  channels: ChannelView[];
  outstandingChannels: number;
  outstandingAcks: number;
  pendingChange: boolean;
}
export function siteStatus(e: Engine, siteId: string): SiteStatus {
  const s = e.state;
  const decl = siteDeclarations(s, siteId);
  const channels = channelStatus(s, siteId);
  const latest = e.latestPublication(s, siteId);
  return {
    openCases: s.cases.filter((c) => c.siteId === siteId && c.state !== "approved" && c.state !== "rejected").length,
    queued: s.outbox.filter((q) => q.siteId === siteId && q.status === "queued").length,
    unresolvedDishes: decl.filter((d) => !d.resolved).map((d) => d.recipeName),
    channels,
    outstandingChannels: channels.filter((c) => c.status !== "current").length,
    outstandingAcks: outstandingAcks(s, siteId).outstanding.length,
    pendingChange: !latest || latest.basisHash !== e.basisOf(s, siteId)
  };
}

export function verifyAuditChain(s: AppState): boolean {
  let prev = "genesis";
  for (const [i, a] of s.audit.entries()) {
    const body = stableStringify({ seq: a.seq, at: a.at, tenantId: a.tenantId, siteId: a.siteId, actorId: a.actorId, action: a.action, targetType: a.targetType, targetId: a.targetId, detail: a.detail, prev });
    if (a.seq !== i + 1 || a.prevHash !== prev || a.hash !== sha(body)) return false;
    prev = a.hash;
  }
  return true;
}

export { openCasesFor, queuedFor, dishesAt, versionAt };
