import { siteDeclarations } from "./declarations.js";
import { channelStatus, outstandingAcks, type Engine } from "./engine.js";
import { CHANNEL_LABEL, type AppState, type Channel, type ReviewCase } from "./types.js";
import { ALLERGEN_LABEL } from "./allergens.js";
import { isSpecComplete } from "./engine.js";

/**
 * The five status words used everywhere. Each means exactly one thing, and none implies another:
 *  - a notification is never an acknowledgement, an acknowledgement is not understanding, an approval is not publication.
 */
export type StatusId = "awaiting_specification" | "awaiting_review" | "approved_revision" | "publication_incomplete" | "ack_outstanding";
export const STATUS_LABEL: Record<StatusId, string> = {
  awaiting_specification: "Awaiting specification",
  awaiting_review: "Awaiting review",
  approved_revision: "Approved revision",
  publication_incomplete: "Publication incomplete",
  ack_outstanding: "Staff acknowledgement outstanding"
};
export const STATUS_MEANING: Record<StatusId, string> = {
  awaiting_specification: "A delivery did not match. Nobody has yet entered the supplier's specification for what arrived.",
  awaiting_review: "A specification is entered. The affected recipes or the approval decision are still waiting.",
  approved_revision: "A named approver approved this exact specification revision and its affected recipes. It is not on any menu until it is published.",
  publication_incomplete: "An approved change has not reached every place (QR/web menu, service view, printed menu).",
  ack_outstanding: "The newest menu revision is on the service view, but not everyone required has confirmed they saw it."
};
export const NOTIFICATION_NOTICE = "This app sends no notifications and no messages. Telling someone is not the same as them acknowledging. Only a person confirming on this device counts.";
export const PUBLICATION_NOTICE = "There is no server. The QR / web menu and the printer are simulated here: marking one \"updated\" records the decision on this device only. Nothing is sent to a guest-facing page or printer.";

/** A rejected case is shown as "Not approved" (it is not one of the five statuses and is never called approved). */
export function caseStatus(c: ReviewCase): StatusId | "not_approved" {
  if (c.state === "review_required") return "awaiting_specification";
  if (c.state === "rejected") return "not_approved";
  if (c.state === "approved") return "approved_revision";
  return "awaiting_review";
}

export interface StatusItem { id: StatusId; count: number; detail: string; to: "review" | "publish" | "service" }

/** Only real conditions appear; there is never a zero-count item. */
export function statusItems(e: Engine, siteId: string): StatusItem[] {
  const s = e.state;
  const out: StatusItem[] = [];
  const open = s.cases.filter((c) => c.siteId === siteId && c.state !== "approved" && c.state !== "rejected");
  const awaitSpec = open.filter((c) => caseStatus(c) === "awaiting_specification").length;
  const awaitRev = open.length - awaitSpec;
  if (awaitSpec) out.push({ id: "awaiting_specification", count: awaitSpec, detail: "Enter the supplier specification for what arrived.", to: "review" });
  if (awaitRev) out.push({ id: "awaiting_review", count: awaitRev, detail: "Review affected recipes and decide.", to: "review" });
  const latest = e.latestPublication(s, siteId);
  const channels = channelStatus(s, siteId);
  const behind = channels.filter((c) => c.status !== "current" && c.latestRevision !== null);
  const pendingChange = !latest || latest.basisHash !== e.basisOf(s, siteId);
  const queuedN = s.outbox.filter((q) => q.siteId === siteId && q.status === "queued").length;
  const approvedNotPrepared = pendingChange && open.length === 0 && queuedN === 0 && !!latest;
  if (behind.length || approvedNotPrepared) {
    const n = behind.length || 1;
    out.push({ id: "publication_incomplete", count: n, detail: behind.length ? `${behind.map((b) => CHANNEL_LABEL[b.channel]).join(", ")} not up to date.` : "An approved change (or a changed kitchen control) is not in a new menu revision yet.", to: "publish" });
  }
  const sv = channels.find((c) => c.channel === "service_view");
  const acks = outstandingAcks(s, siteId);
  if (acks.revision !== null && acks.outstanding.length > 0 && sv?.status === "current")
    out.push({ id: "ack_outstanding", count: acks.outstanding.length, detail: "People who have not confirmed they saw the newest revision.", to: "service" });
  return out;
}

// ------------------------------------------------------------------ delivery comparison (expected vs delivered)
export interface CompareRow { field: string; expected: string; delivered: string; differs: boolean; note?: string }
const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");

export function deliveryComparison(s: AppState, c: ReviewCase): { rows: CompareRow[]; allergenRows: { expectedContains: string; deliveredContains: string; expectedMay: string; deliveredMay: string; known: boolean } | null } {
  const d = s.deliveries.find((x) => x.id === c.deliveryId)!;
  const ordered = s.products.find((p) => p.id === c.orderedProductId)!;
  const orderedSpec = s.specs.find((x) => x.id === ordered.approvedSpecId);
  const obsId = c.observedProductId;
  const obs = obsId ? s.products.find((p) => p.id === obsId) : undefined;
  const dSpec = c.specId ? s.specs.find((x) => x.id === c.specId) : obs?.approvedSpecId ? s.specs.find((x) => x.id === obs.approvedSpecId) : undefined;
  const none = "Not identified";
  const rows: CompareRow[] = [];
  const row = (field: string, expected: string, delivered: string, note?: string) => rows.push({ field, expected, delivered, differs: norm(expected) !== norm(delivered), note });
  row("Product", ordered.name, obs?.name ?? none);
  row("Supplier", ordered.supplier, obs?.supplier ?? none);
  row("Barcode", ordered.barcodes.join(", ") || "none on file", d.barcode, "A barcode only helps find a product. It does not show what is inside.");
  row("Pack size", orderedSpec?.packSize ?? "no specification on file", d.packSize || "not entered");
  row("Specification version", orderedSpec?.label ?? "none on file", dSpec?.label ?? (d.labelSpecRef || "none shown"));
  if (orderedSpec?.batchCodes) row("Batch", `covers ${orderedSpec.batchCodes.join(", ")}`, d.batchCode);
  else rows.push({ field: "Batch", expected: "any batch covered", delivered: d.batchCode, differs: false });
  row("Ingredients", orderedSpec?.ingredientsText ?? "none on file", dSpec?.ingredientsText ?? "not entered yet");
  let allergenRows = null as ReturnType<typeof deliveryComparison>["allergenRows"];
  if (orderedSpec) {
    const list = (spec: typeof orderedSpec, kind: "c" | "m") => {
      const keys = Object.keys(ALLERGEN_LABEL) as Array<keyof typeof ALLERGEN_LABEL>;
      const hit = keys.filter((a) => (kind === "c" ? spec.contains[a] === "declared" : spec.precautionary[a] === "stated")).map((a) => ALLERGEN_LABEL[a]);
      const unk = keys.filter((a) => (kind === "c" ? spec.contains[a] === "unknown" : spec.precautionary[a] === "unknown"));
      return (hit.length ? hit.join(", ") : "none stated") + (unk.length ? ` (${unk.length} UNKNOWN)` : "");
    };
    allergenRows = {
      expectedContains: list(orderedSpec, "c"), deliveredContains: dSpec ? list(dSpec, "c") : "Not known until the specification is entered",
      expectedMay: list(orderedSpec, "m"), deliveredMay: dSpec ? list(dSpec, "m") : "Not known until the specification is entered",
      known: !!dSpec && isSpecComplete(dSpec)
    };
  }
  return { rows, allergenRows };
}

// ------------------------------------------------------------------ what a change touches
export interface Affected {
  recipes: Array<{ id: string; name: string; kind: "dish" | "component"; changes: boolean }>;
  siteName: string;
  otherSites: string[];
  channels: Array<{ channel: Channel; label: string; liveRevision: number | null; latestRevision: number | null; status: string }>;
}
export function affectedScope(s: AppState, c: ReviewCase): Affected {
  const site = s.sites.find((x) => x.id === c.siteId)!;
  const recipes = (c.impact?.items ?? []).map((i) => ({ id: i.recipeId, name: i.name, kind: i.kind, changes: JSON.stringify(i.before) !== JSON.stringify(i.after) }));
  const ids = new Set(recipes.map((r) => r.id));
  const other = new Set<string>();
  for (const v of s.recipeVersions) if (ids.has(v.recipeId) && v.status === "approved") for (const sid of v.siteIds) if (sid !== c.siteId) { const n = s.sites.find((x) => x.id === sid && x.tenantId === c.tenantId)?.name; if (n) other.add(n); }
  const ch = channelStatus(s, c.siteId).map((x) => ({ channel: x.channel, label: CHANNEL_LABEL[x.channel], liveRevision: x.liveRevision, latestRevision: x.latestRevision, status: x.status }));
  return { recipes, siteName: site.name, otherSites: [...other].sort(), channels: ch };
}

// ------------------------------------------------------------------ product search (manual entry, also the scan fallback)
export function searchProducts(s: AppState, tenantId: string, query: string) {
  const q = query.trim().toLowerCase().replace(/[\s-]/g, "");
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!q) return [];
  return s.products.filter((p) => p.tenantId === tenantId).filter((p) => {
    const hay = `${p.name} ${p.supplier}`.toLowerCase();
    return words.every((w) => hay.includes(w)) || p.barcodes.some((b) => b.includes(q)) || p.id.toLowerCase() === q;
  }).slice(0, 12);
}

export { siteDeclarations };
