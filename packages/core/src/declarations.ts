import { ALLERGENS, ALLERGEN_LABEL, type Allergen } from "./allergens.js";
import { versionAt } from "./graph.js";
import type { AppState, DeclarationBrief, DishDeclaration, KitchenControl, Substitution } from "./types.js";

export interface ResolveOpts {
  /** What-if: pretend this substitution is approved at the site (used for impact preview). */
  hypothetical?: { siteId: string; replaces: string; withProductId: string; specId: string; batchCodes: string[] | null };
  /** Ignore this review case when deciding whether a product is "awaiting review". */
  ignoreCaseId?: string;
}

export function activeSubstitution(state: AppState, siteId: string, productId: string): Substitution | undefined {
  return state.substitutions
    .filter((s) => s.siteId === siteId && s.replacesProductId === productId && s.endedAt === null)
    .sort((a, b) => b.approvedAt.localeCompare(a.approvedAt))[0];
}

export function openCasesFor(state: AppState, siteId: string, productId: string, ignoreCaseId?: string) {
  return state.cases.filter(
    (c) => c.siteId === siteId && c.orderedProductId === productId && c.id !== ignoreCaseId && c.state !== "approved" && c.state !== "rejected"
  );
}
export function queuedFor(state: AppState, siteId: string, productId: string) {
  return state.outbox.filter((q) => q.siteId === siteId && q.input.orderedProductId === productId && q.status === "queued");
}

interface Acc {
  contains: Set<Allergen>;
  mayContain: Set<Allergen>;
  unknown: Set<Allergen>;
  unknownAll: boolean;
  reasons: string[];
  notes: string[];
  specIds: Set<string>;
  substitutionIds: Set<string>;
}

function walkRecipe(state: AppState, siteId: string, recipeId: string, stack: string[], acc: Acc, opts: ResolveOpts): void {
  const recipe = state.recipes.find((r) => r.id === recipeId);
  const rname = recipe?.name ?? recipeId;
  if (stack.includes(recipeId)) {
    acc.reasons.push(`Dependency cycle through "${rname}": cannot be resolved.`);
    acc.unknownAll = true;
    return;
  }
  const v = versionAt(state, recipeId, siteId);
  if (!v) {
    acc.reasons.push(`No approved version of "${rname}" applies at this site (missing or stale reference).`);
    acc.unknownAll = true;
    return;
  }
  for (const c of v.components) {
    if (c.kind === "recipe") {
      walkRecipe(state, siteId, c.recipeId, [...stack, recipeId], acc, opts);
      continue;
    }
    const product = state.products.find((p) => p.id === c.productId);
    if (!product) {
      acc.reasons.push(`Unknown product reference in "${rname}".`);
      acc.unknownAll = true;
      continue;
    }
    const openCases = openCasesFor(state, siteId, product.id, opts.ignoreCaseId);
    const queued = queuedFor(state, siteId, product.id);
    if (openCases.length > 0) {
      acc.reasons.push(`A delivery of "${product.name}" is awaiting review (information hold). Do not treat this declaration as current.`);
      acc.unknownAll = true;
    }
    if (queued.length > 0) {
      acc.reasons.push(`A receiving record for "${product.name}" is queued and not yet reconciled.`);
      acc.unknownAll = true;
    }
    let specId = product.approvedSpecId;
    const hyp = opts.hypothetical;
    const sub = hyp && hyp.siteId === siteId && hyp.replaces === product.id ? undefined : activeSubstitution(state, siteId, product.id);
    let label = product.name;
    if (hyp && hyp.siteId === siteId && hyp.replaces === product.id) {
      specId = hyp.specId;
      label = state.products.find((p) => p.id === hyp.withProductId)?.name ?? label;
      if (hyp.batchCodes) acc.notes.push(`Substitute "${label}" applies to batch ${hyp.batchCodes.join(", ")} only.`);
    } else if (sub) {
      specId = sub.specId;
      label = state.products.find((p) => p.id === sub.withProductId)?.name ?? label;
      acc.substitutionIds.add(sub.id);
      if (sub.batchCodes) acc.notes.push(`Substitute "${label}" applies to batch ${sub.batchCodes.join(", ")} only.`);
    }
    const spec = specId ? state.specs.find((s) => s.id === specId) : undefined;
    if (!spec || spec.status !== "verified") {
      acc.reasons.push(`No verified specification for "${label}".`);
      acc.unknownAll = true;
      continue;
    }
    acc.specIds.add(spec.id);
    for (const a of ALLERGENS) {
      if (spec.contains[a] === "declared") acc.contains.add(a);
      else if (spec.contains[a] === "unknown") acc.unknown.add(a);
      if (spec.precautionary[a] === "stated") acc.mayContain.add(a);
      else if (spec.precautionary[a] === "unknown") acc.unknown.add(a);
    }
    if (ALLERGENS.some((a) => spec.contains[a] === "unknown" || spec.precautionary[a] === "unknown")) {
      acc.reasons.push(`Specification for "${label}" is incomplete (some fields unknown).`);
    }
  }
}

const list = (xs: Allergen[]) => xs.map((a) => ALLERGEN_LABEL[a]).join(", ");

/**
 * Declaration for one recipe at one site. Unknown never becomes "not declared": an allergen that
 * is unknown anywhere in the dependency tree (and not declared elsewhere) makes the dish UNRESOLVED.
 */
export function declare(state: AppState, recipeId: string, siteId: string, opts: ResolveOpts = {}): DishDeclaration {
  const recipe = state.recipes.find((r) => r.id === recipeId);
  const v = versionAt(state, recipeId, siteId);
  const acc: Acc = {
    contains: new Set(), mayContain: new Set(), unknown: new Set(), unknownAll: false,
    reasons: [], notes: [], specIds: new Set(), substitutionIds: new Set()
  };
  walkRecipe(state, siteId, recipeId, [], acc, opts);
  const contains = ALLERGENS.filter((a) => acc.contains.has(a));
  const mayContain = ALLERGENS.filter((a) => acc.mayContain.has(a));
  const unresolved = ALLERGENS.filter((a) => (acc.unknownAll || acc.unknown.has(a)) && !acc.contains.has(a));
  const reasons = [...new Set(acc.reasons)];
  const resolved = reasons.length === 0 && unresolved.length === 0;
  const lines: string[] = [];
  lines.push(contains.length ? `Contains (ingredient declarations): ${list(contains)}.` : "Contains: none declared in the reviewed specifications.");
  const mayOnly = mayContain.filter((a) => !contains.includes(a));
  lines.push(mayOnly.length ? `May contain (supplier precautionary statements): ${list(mayOnly)}.` : "May contain: no supplier precautionary statements recorded.");
  if (!resolved) {
    lines.push(`UNRESOLVED - do not rely on this label; ask a manager. Not established: ${unresolved.length ? list(unresolved) : "see reasons"}.`);
    for (const r of reasons) lines.push(`Reason: ${r}`);
  }
  for (const n of [...new Set(acc.notes)]) lines.push(n);
  return {
    recipeId,
    recipeName: recipe?.name ?? recipeId,
    recipeVersionId: v?.id ?? null,
    recipeVersion: v?.version ?? null,
    siteId,
    resolved,
    contains, mayContain, unresolved,
    reasons,
    notes: [...new Set(acc.notes)],
    specIds: [...acc.specIds],
    substitutionIds: [...acc.substitutionIds],
    lines
  };
}

export function brief(d: DishDeclaration): DeclarationBrief {
  return { contains: d.contains, mayContain: d.mayContain, unresolved: d.unresolved, resolved: d.resolved };
}

/** Dishes (menu items) that have an approved version at the site, in name order. */
export function dishesAt(state: AppState, siteId: string) {
  return state.recipes
    .filter((r) => r.kind === "dish" && versionAt(state, r.id, siteId))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function siteDeclarations(state: AppState, siteId: string, opts: ResolveOpts = {}): DishDeclaration[] {
  return dishesAt(state, siteId).map((r) => declare(state, r.id, siteId, opts));
}

/** Kitchen cross-contact controls are recorded by people, per site. They are never derived from ingredient declarations. */
export function kitchenControlLines(controls: KitchenControl[], siteId: string): string[] {
  const mine = controls.filter((c) => c.siteId === siteId);
  if (mine.length === 0) return ["Kitchen cross-contact controls: none recorded in this system. They are set by the kitchen and are not inferred from ingredient declarations."];
  return [
    "Kitchen cross-contact controls (recorded by the kitchen, separate from ingredient declarations):",
    ...mine.map((c) => `- ${ALLERGEN_LABEL[c.allergen]}: ${c.note}`)
  ];
}
