import { specMaps, type Allergen } from "./allergens.js";
import { gtinWithCheck } from "./barcode.js";
import { Engine, type SpecInput } from "./engine.js";
import { sha, stableStringify } from "./util.js";
import { emptyState, type AppState, type Component, type ReceivingInput, type Role } from "./types.js";

export const MAIN = "site-main";
export const ANNEX = "site-annex";
export const OTHER_SITE = "site-other";
export const T1 = "tenant-1";
export const T2 = "tenant-2";

export const PERSONAS: Array<{ id: string; name: string; role: Role; blurb: string }> = [
  { id: "alex", name: "Alex", role: "receiving_operator", blurb: "Books deliveries in" },
  { id: "priya", name: "Priya", role: "specification_reviewer", blurb: "Checks the paperwork" },
  { id: "sam", name: "Sam", role: "publication_approver", blurb: "Approves and publishes" },
  { id: "jo", name: "Jo", role: "service_staff", blurb: "Front of house" },
  { id: "jess", name: "Jess", role: "service_staff", blurb: "Front of house" },
  { id: "morgan", name: "Morgan", role: "administrator", blurb: "Manages staff and exceptions" }
];

type P = [id: string, name: string, supplier: string, declared: Allergen[], stated: Allergen[], pack: string, ingredients: string];
const PRODUCTS: P[] = [
  ["p-flour", "Plain flour 16kg", "Mill & Co (fictional)", ["gluten"], [], "16kg", "Wheat flour"],
  ["p-rice", "Basmati rice 10kg", "Mill & Co (fictional)", [], [], "10kg", "Rice"],
  ["p-chicken", "Chicken breast 2kg", "Farm Direct (fictional)", [], [], "2kg", "Chicken"],
  ["p-salmon", "Salmon fillet 1kg", "Sea Direct (fictional)", ["fish"], [], "1kg", "Salmon"],
  ["p-prawns", "King prawns 1kg", "Sea Direct (fictional)", ["crustaceans"], ["molluscs"], "1kg", "Prawns"],
  ["p-milk", "Whole milk 2L", "Dairy Co (fictional)", ["milk"], [], "2L", "Milk"],
  ["p-eggs", "Eggs tray of 30", "Farm Direct (fictional)", ["eggs"], [], "30", "Eggs"],
  ["p-butter", "Butter 1kg", "Dairy Co (fictional)", ["milk"], [], "1kg", "Butter"],
  ["p-cheddar", "Cheddar 5kg", "Dairy Co (fictional)", ["milk"], [], "5kg", "Cheddar cheese"],
  ["p-oil", "Rapeseed oil 5L", "Pantry Ltd (fictional)", [], [], "5L", "Rapeseed oil"],
  ["p-passata", "Tomato passata 2.5kg", "Pantry Ltd (fictional)", [], [], "2.5kg", "Tomatoes"],
  ["p-onions", "Onions 10kg", "Veg Box (fictional)", [], [], "10kg", "Onions"],
  ["p-garlic", "Garlic 1kg", "Veg Box (fictional)", [], [], "1kg", "Garlic"],
  ["p-celery", "Celery 1kg", "Veg Box (fictional)", ["celery"], [], "1kg", "Celery"],
  ["p-teriyaki", "Harbour Teriyaki Sauce 1L", "Harbour Foods (fictional)", ["soybeans", "gluten"], ["sesame"], "1L", "Water, soy sauce (soybeans, wheat), sugar, rice vinegar"],
  ["p-dijon", "Dijon mustard 1kg", "Pantry Ltd (fictional)", ["mustard", "sulphites"], [], "1kg", "Water, mustard seed, spirit vinegar, salt, preservative (sulphites)"],
  ["p-peanut", "Peanut butter 1kg", "Pantry Ltd (fictional)", ["peanuts"], ["tree_nuts"], "1kg", "Roasted peanuts"],
  ["p-almonds", "Flaked almonds 1kg", "Pantry Ltd (fictional)", ["tree_nuts"], ["peanuts"], "1kg", "Almonds"],
  ["p-sesameoil", "Sesame oil 1L", "Pantry Ltd (fictional)", ["sesame"], [], "1L", "Toasted sesame oil"],
  ["p-stock", "Vegetable stock 1kg", "Pantry Ltd (fictional)", ["celery"], [], "1kg", "Vegetable extract, celery, salt"]
];

export const SUB_BARCODE = gtinWithCheck("501999999991");
export const SUB_NAME = "Eastern Glaze Teriyaki-style Sauce 1L";

/** The replacement sauce's specification as a supplier sheet would state it (typed by a reviewer, never inferred). */
export function substituteSpecInput(): SpecInput {
  const m = specMaps(["soybeans", "gluten", "sesame", "fish"], ["peanuts"]);
  return {
    label: "EG-TS-2026-02", packSize: "1L", batchCodes: null,
    ingredientsText: "Soy sauce (water, soybeans, wheat), sugar, sesame oil, anchovy extract (fish), garlic",
    contains: m.contains, precautionary: m.precautionary,
    evidenceReference: "Supplier specification sheet EG-TS-2026-02 (synthetic)", evidenceNote: "Typed from the sheet by the reviewer."
  };
}
export function sauceDelivery(siteId = MAIN): ReceivingInput {
  return { siteId, orderedProductId: "p-teriyaki", barcode: SUB_BARCODE, packSize: "1L", batchCode: "EG240617", labelSpecRef: "EG-TS-2026-02", deliveryNoteRef: "DN-5521" };
}

export function barcodeOf(id: string): string {
  const i = PRODUCTS.findIndex((p) => p[0] === id);
  return gtinWithCheck("5010000" + String(10000 + i).padStart(5, "0"));
}

/** Plain starting data: two tenants, three sites, 20 ingredients, 9 recipes. No publications yet. */
export function baseState(): AppState {
  const s = emptyState();
  s.tenants.push({ id: T1, name: "Fictional Bistro Group" }, { id: T2, name: "Other Fictional Group" });
  s.sites.push({ id: MAIN, tenantId: T1, name: "Main kitchen" }, { id: ANNEX, tenantId: T1, name: "Annex kitchen" }, { id: OTHER_SITE, tenantId: T2, name: "Other group kitchen" });
  const staff: Array<[string, string, string]> = [
    ["alex", "Alex Rivera", T1], ["priya", "Priya Nair", T1], ["sam", "Sam Okoye", T1], ["jo", "Jo Bell", T1], ["jess", "Jess Hart", T1], ["morgan", "Morgan Lee", T1], ["omar", "Omar Haddad", T2]
  ];
  for (const [id, name, tenantId] of staff) s.staff.push({ id, tenantId, name, status: "active", offboardedAt: null, erased: false });
  const mem = (staffId: string, tenantId: string, siteId: string, role: Role) =>
    s.memberships.push({ id: `mem-${s.memberships.length + 1}`, staffId, tenantId, siteId, role, endedAt: null });
  mem("alex", T1, MAIN, "receiving_operator");
  mem("priya", T1, MAIN, "specification_reviewer");
  mem("sam", T1, "*", "publication_approver");
  mem("jo", T1, MAIN, "service_staff");
  mem("jess", T1, MAIN, "service_staff");
  mem("morgan", T1, "*", "administrator");
  mem("omar", T2, "*", "administrator");
  mem("omar", T2, "*", "publication_approver");
  const at = "2026-10-01T09:00:00.000Z";
  for (const [id, name, supplier, declared, stated, pack, ingredients] of PRODUCTS) {
    const m = specMaps(declared, stated);
    s.products.push({ id, tenantId: T1, name, supplier, barcodes: [barcodeOf(id)], kind: "ingredient", status: "approved", approvedSpecId: `spec-${id}` });
    s.specs.push({
      id: `spec-${id}`, tenantId: T1, productId: id, revision: 1, label: `${id.slice(2).toUpperCase()}-SPEC-1`, packSize: pack, batchCodes: null,
      ingredientsText: ingredients, contains: m.contains, precautionary: m.precautionary,
      evidence: { reference: `Supplier specification sheet for ${name} (synthetic)`, note: "Seed data", enteredBy: "priya", enteredAt: at },
      status: "verified", verifiedBy: "priya", verifiedAt: at
    });
  }
  const rec = (id: string, name: string, kind: "dish" | "component", comps: Component[], sites: string[]) => {
    s.recipes.push({ id, tenantId: T1, name, kind });
    s.recipeVersions.push({ id: `rv-${id}-1`, recipeId: id, tenantId: T1, version: 1, components: comps, siteIds: sites, status: "approved", createdBy: "priya", approvedBy: "sam", approvedAt: at });
  };
  const p = (productId: string): Component => ({ kind: "product", productId });
  const r = (recipeId: string): Component => ({ kind: "recipe", recipeId });
  const both = [MAIN, ANNEX];
  rec("rc-glaze", "House glaze", "component", [p("p-teriyaki"), p("p-garlic"), p("p-onions")], both);
  rec("rc-roux", "White roux", "component", [p("p-flour"), p("p-butter"), p("p-milk")], both);
  rec("rc-tomato", "Tomato base", "component", [p("p-passata"), p("p-onions"), p("p-garlic"), p("p-celery"), p("p-oil")], both);
  rec("d-salmon", "Glazed salmon bowl", "dish", [r("rc-glaze"), p("p-salmon"), p("p-rice")], both);
  rec("d-chicken-rice", "Glazed chicken rice", "dish", [r("rc-glaze"), p("p-chicken"), p("p-rice")], [MAIN]);
  rec("d-prawn", "Prawn tomato pasta", "dish", [r("rc-tomato"), p("p-prawns"), p("p-flour")], both);
  rec("d-omelette", "Cheese omelette", "dish", [p("p-eggs"), p("p-cheddar"), p("p-butter")], both);
  rec("d-mustard", "Mustard chicken", "dish", [r("rc-roux"), p("p-chicken"), p("p-dijon")], both);
  rec("d-satay", "Satay chicken skewers", "dish", [p("p-chicken"), p("p-peanut"), p("p-sesameoil")], both);
  // second tenant: one product and one dish, only for isolation tests
  s.products.push({ id: "p2-flour", tenantId: T2, name: "Other group flour", supplier: "Other Mill (fictional)", barcodes: [gtinWithCheck("501888888881")], kind: "ingredient", status: "approved", approvedSpecId: "spec-p2-flour" });
  const m2 = specMaps(["gluten"]);
  s.specs.push({ id: "spec-p2-flour", tenantId: T2, productId: "p2-flour", revision: 1, label: "OF-1", packSize: "1kg", batchCodes: null, ingredientsText: "Wheat flour", contains: m2.contains, precautionary: m2.precautionary, evidence: { reference: "Other group sheet (synthetic)", note: "", enteredBy: "omar", enteredAt: at }, status: "verified", verifiedBy: "omar", verifiedAt: at });
  s.recipes.push({ id: "d2-bread", tenantId: T2, name: "Other group bread", kind: "dish" });
  s.recipeVersions.push({ id: "rv-d2-bread-1", recipeId: "d2-bread", tenantId: T2, version: 1, components: [p("p2-flour")], siteIds: [OTHER_SITE], status: "approved", createdBy: "omar", approvedBy: "omar", approvedAt: at });
  return s;
}

/** Engine on the base data with menu revision 1 live on every channel and acknowledged at the main kitchen. */
export function syntheticEngine(opts: { now?: () => number } = {}): Engine {
  const e = new Engine(baseState(), opts);
  for (const site of [MAIN, ANNEX]) {
    const { publication } = e.preparePublication("sam", site, `seed-${site}`);
    for (const ch of ["qr_web", "service_view", "printed_menu"] as const) e.publishChannel("sam", publication.id, ch, `seed-${site}-${ch}`);
    if (site === MAIN) for (const who of ["jo", "jess"]) e.acknowledge(who, publication.id, 1);
  }
  return e;
}

export function syntheticExample(): AppState {
  return { ...syntheticEngine().state, synthetic: true };
}

/**
 * A real (non-demonstration) kitchen with one person. That person is the administrator and the publication approver,
 * so the app can be set up. Receiving, checking and service roles are given to other people; one person doing everything
 * is blocked by separation of duties unless a named, reasoned, expiring exception is granted.
 */
export function ownKitchenState(opts: { kitchenName: string; siteName: string; ownerName: string; now?: string }): { state: AppState; ownerId: string; siteId: string } {
  const s = emptyState();
  const at = opts.now ?? new Date().toISOString();
  const tenantId = "tenant-own", siteId = "site-own", ownerId = "staff-owner";
  s.tenants.push({ id: tenantId, name: opts.kitchenName.trim() || "My kitchen" });
  s.sites.push({ id: siteId, tenantId, name: opts.siteName.trim() || "Kitchen" });
  s.staff.push({ id: ownerId, tenantId, name: opts.ownerName.trim() || "Owner", status: "active", offboardedAt: null, erased: false });
  s.memberships.push({ id: "mem-1", staffId: ownerId, tenantId, siteId: "*", role: "administrator", endedAt: null });
  s.memberships.push({ id: "mem-2", staffId: ownerId, tenantId, siteId: "*", role: "publication_approver", endedAt: null });
  s.seq = 2;
  const prev = "genesis";
  const body = stableStringify({ seq: 1, at, tenantId, siteId: null, actorId: ownerId, action: "kitchen.created", targetType: "tenant", targetId: tenantId, detail: "", prev });
  s.audit.push({ seq: 1, at, tenantId, siteId: null, actorId: ownerId, action: "kitchen.created", targetType: "tenant", targetId: tenantId, detail: "", prevHash: prev, hash: sha(body) });
  return { state: s, ownerId, siteId };
}
