import type { Allergen, ContainsMap, PrecautionMap } from "./allergens.js";

export const SYNTHETIC_NOTICE =
  "Synthetic demonstration data. Fictional kitchen, products and recipes. Not for real food-safety decisions.";
export const ROLE_SWITCH_NOTICE = "Demo: one phone plays every role; real staff logins need a server (not built).";
export const HOLD_NOTICE =
  "Information hold only. This does not prove the physical stock has been separated or isolated; follow your kitchen's own procedure for that.";
export const ACK_NOTICE = "Acknowledgement is a recorded receipt of this revision only. It is not training and does not verify understanding.";
export const NOT_A_GUARANTEE =
  "This supports trained people and existing kitchen controls. It cannot guarantee that any dish is safe. Allergens not listed are simply not declared in the reviewed specifications; ask a manager if unsure.";

export type Role = "receiving_operator" | "specification_reviewer" | "publication_approver" | "service_staff" | "administrator";
export const ROLES: Role[] = ["receiving_operator", "specification_reviewer", "publication_approver", "service_staff", "administrator"];
export const ROLE_LABEL: Record<Role, string> = {
  receiving_operator: "Receiving operator",
  specification_reviewer: "Specification reviewer",
  publication_approver: "Publication approver",
  service_staff: "Service staff",
  administrator: "Administrator"
};

export type Channel = "qr_web" | "service_view" | "printed_menu";
export const CHANNELS: Channel[] = ["qr_web", "service_view", "printed_menu"];
export const CHANNEL_LABEL: Record<Channel, string> = {
  qr_web: "QR / web menu",
  service_view: "Service view (staff)",
  printed_menu: "Printed menu"
};

export interface Tenant { id: string; name: string }
export interface Site { id: string; tenantId: string; name: string }
export interface Staff {
  id: string;
  tenantId: string;
  name: string;
  status: "active" | "offboarded";
  offboardedAt: string | null;
  erased: boolean;
}
export interface Membership {
  id: string;
  staffId: string;
  tenantId: string;
  /** a site id, or "*" for every site of this tenant only (never across tenants) */
  siteId: string;
  role: Role;
  endedAt: string | null;
}

export interface Product {
  id: string;
  tenantId: string;
  name: string;
  supplier: string;
  /** Identifier aid only. A barcode is not evidence of formulation. */
  barcodes: string[];
  kind: "ingredient";
  /** "proposed" until a substitution using it is approved. */
  status: "approved" | "proposed";
  approvedSpecId: string | null;
}

export interface Evidence {
  reference: string; // e.g. "Supplier specification sheet SS-1042 v3, page 2"
  note: string;
  enteredBy: string;
  enteredAt: string;
}
export interface SpecRevision {
  id: string;
  tenantId: string;
  productId: string;
  revision: number;
  /** The supplier's own version label, as printed on the specification. */
  label: string;
  packSize: string;
  /** null = applies to every batch; otherwise only these batch codes */
  batchCodes: string[] | null;
  ingredientsText: string;
  contains: ContainsMap;
  precautionary: PrecautionMap;
  evidence: Evidence;
  status: "verified" | "superseded";
  verifiedBy: string;
  verifiedAt: string;
}

export type Component = { kind: "product"; productId: string } | { kind: "recipe"; recipeId: string };
export interface Recipe { id: string; tenantId: string; name: string; kind: "dish" | "component" }
export interface RecipeVersion {
  id: string;
  recipeId: string;
  tenantId: string;
  version: number;
  components: Component[];
  /** site applicability */
  siteIds: string[];
  status: "approved" | "superseded";
  createdBy: string;
  approvedBy: string;
  approvedAt: string;
}

export type FindingKind =
  | "unknown_barcode" | "barcode_invalid" | "barcode_other_product" | "pack_variant_differs"
  | "spec_label_differs" | "batch_not_covered" | "no_approved_spec" | "spec_incomplete" | "spec_changed_since_capture";
export interface Finding { kind: FindingKind; message: string }

export interface ReceivingInput {
  siteId: string;
  orderedProductId: string;
  barcode: string;
  packSize: string;
  batchCode: string;
  /** supplier specification/version label printed on the delivered pack, if any */
  labelSpecRef: string;
  deliveryNoteRef: string;
}
export interface Delivery extends ReceivingInput {
  id: string;
  tenantId: string;
  receivedBy: string;
  receivedAt: string;
  observedProductId: string | null;
  findings: Finding[];
  /** "matched_approved_substitute": an earlier approved substitution covers this exact product and batch. */
  outcome: "identifier_match" | "matched_approved_substitute" | "review_required";
  caseId: string | null;
  dedupeKey: string;
  source: "direct" | "queued";
  capturedAt: string;
}
export interface QueuedReceipt {
  id: string;
  requestId: string;
  tenantId: string;
  siteId: string;
  input: ReceivingInput;
  capturedBy: string;
  capturedAt: string;
  knownSpecIdAtCapture: string | null;
  status: "queued" | "reconciled";
  deliveryId: string | null;
}

export type CaseState = "review_required" | "spec_attached" | "impact_reviewed" | "approved" | "rejected";
export interface ImpactItem {
  recipeId: string;
  name: string;
  kind: "dish" | "component";
  path: string[];
  before: DeclarationBrief | null;
  after: DeclarationBrief | null;
}
export interface DeclarationBrief { contains: Allergen[]; mayContain: Allergen[]; unresolved: Allergen[]; resolved: boolean }
export interface Impact { digest: string; computedAt: string; computedBy: string; items: ImpactItem[]; stale: string[]; unresolvedReasons: string[] }
export interface CaseEvent { at: string; actorId: string; action: string; note: string }
export interface ReviewCase {
  id: string;
  tenantId: string;
  siteId: string;
  deliveryId: string;
  orderedProductId: string;
  observedProductId: string | null;
  state: CaseState;
  /** optimistic concurrency token */
  version: number;
  openedAt: string;
  specId: string | null;
  impact: Impact | null;
  decision: { by: string; at: string; requestId: string; specId: string; impactDigest: string; viaOverrideId: string | null } | null;
  substitutionId: string | null;
  events: CaseEvent[];
}

export interface Substitution {
  id: string;
  tenantId: string;
  siteId: string;
  caseId: string;
  replacesProductId: string;
  withProductId: string;
  specId: string;
  batchCodes: string[] | null;
  approvedBy: string;
  approvedAt: string;
  endedAt: string | null;
  endedBy: string | null;
  endReason: string | null;
}

export interface DishDeclaration {
  recipeId: string;
  recipeName: string;
  recipeVersionId: string | null;
  recipeVersion: number | null;
  siteId: string;
  resolved: boolean;
  contains: Allergen[];
  mayContain: Allergen[];
  unresolved: Allergen[];
  reasons: string[];
  notes: string[];
  specIds: string[];
  substitutionIds: string[];
  lines: string[];
}
export interface KitchenControl { id: string; tenantId: string; siteId: string; allergen: Allergen; note: string; setBy: string; setAt: string }

export interface ChannelState {
  status: "pending" | "published" | "failed";
  attempts: number;
  lastError: string | null;
  lastAttemptAt: string | null;
  lastRequestId: string | null;
  publishedAt: string | null;
}
export interface Publication {
  id: string;
  tenantId: string;
  siteId: string;
  revision: number;
  createdBy: string;
  createdAt: string;
  basisHash: string;
  dishes: DishDeclaration[];
  kitchenControlLines: string[];
  sources: { substitutionIds: string[]; specIds: string[]; caseIds: string[]; overrideIds: string[] };
  channels: Record<Channel, ChannelState>;
}
export interface Ack { id: string; tenantId: string; siteId: string; staffId: string; publicationId: string; revision: number; ackedAt: string }

export type OverrideKind = "sod_exception" | "publish_unresolved_with_warning";
export interface Override {
  id: string;
  tenantId: string;
  siteId: string;
  kind: OverrideKind;
  /** sod_exception: the person who may approve despite being involved. */
  actorId: string | null;
  /** publish_unresolved_with_warning: the dish recipe it covers. */
  recipeId: string | null;
  reason: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
}

export interface AuditEvent {
  seq: number;
  at: string;
  tenantId: string;
  siteId: string | null;
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  detail: string;
  prevHash: string;
  hash: string;
}
export interface RetentionRecord {
  id: string;
  tenantId: string;
  subjectType: "staff";
  subjectId: string;
  requestedBy: string;
  at: string;
  deleted: string[];
  retained: Array<{ what: string; why: string }>;
}

export interface AppState {
  schema: 1;
  /** increments on every committed change */
  version: number;
  seq: number;
  clockOffsetMs: number;
  tenants: Tenant[];
  sites: Site[];
  staff: Staff[];
  memberships: Membership[];
  products: Product[];
  specs: SpecRevision[];
  recipes: Recipe[];
  recipeVersions: RecipeVersion[];
  deliveries: Delivery[];
  outbox: QueuedReceipt[];
  cases: ReviewCase[];
  substitutions: Substitution[];
  controls: KitchenControl[];
  publications: Publication[];
  acks: Ack[];
  overrides: Override[];
  audit: AuditEvent[];
  retention: RetentionRecord[];
  /** idempotency keys -> id of the entity the first call produced */
  requests: Record<string, string>;
}

export function emptyState(): AppState {
  return {
    schema: 1, version: 0, seq: 0, clockOffsetMs: 0,
    tenants: [], sites: [], staff: [], memberships: [], products: [], specs: [], recipes: [], recipeVersions: [],
    deliveries: [], outbox: [], cases: [], substitutions: [], controls: [], publications: [], acks: [], overrides: [],
    audit: [], retention: [], requests: {}
  };
}
