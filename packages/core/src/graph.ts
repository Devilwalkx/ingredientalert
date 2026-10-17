import type { AppState, RecipeVersion } from "./types.js";

/** Returns one dependency cycle as a path of recipe ids (first id repeated at the end), or null. */
export function findCycle(edges: Map<string, string[]>): string[] | null {
  const WHITE = 0, GREY = 1, BLACK = 2;
  const colour = new Map<string, number>();
  const stack: string[] = [];
  const visit = (n: string): string[] | null => {
    colour.set(n, GREY);
    stack.push(n);
    for (const m of edges.get(n) ?? []) {
      const c = colour.get(m) ?? WHITE;
      if (c === GREY) return [...stack.slice(stack.indexOf(m)), m];
      if (c === WHITE) {
        const r = visit(m);
        if (r) return r;
      }
    }
    stack.pop();
    colour.set(n, BLACK);
    return null;
  };
  for (const n of edges.keys()) {
    if ((colour.get(n) ?? WHITE) === WHITE) {
      const r = visit(n);
      if (r) return r;
    }
  }
  return null;
}

/** The approved version of a recipe that applies at a site (highest version number), if any. */
export function versionAt(state: AppState, recipeId: string, siteId: string): RecipeVersion | undefined {
  return state.recipeVersions
    .filter((v) => v.recipeId === recipeId && v.status === "approved" && v.siteIds.includes(siteId))
    .sort((a, b) => b.version - a.version)[0];
}

/** Recipe -> child recipes across every approved version (any site), optionally with a candidate version. */
export function recipeEdges(state: AppState, candidate?: { recipeId: string; childRecipeIds: string[] }): Map<string, string[]> {
  const edges = new Map<string, string[]>();
  for (const r of state.recipes) edges.set(r.id, []);
  for (const v of state.recipeVersions) {
    if (v.status !== "approved") continue;
    const list = edges.get(v.recipeId) ?? [];
    for (const c of v.components) if (c.kind === "recipe") list.push(c.recipeId);
    edges.set(v.recipeId, list);
  }
  if (candidate) {
    const list = edges.get(candidate.recipeId) ?? [];
    list.push(...candidate.childRecipeIds);
    edges.set(candidate.recipeId, list);
    for (const c of candidate.childRecipeIds) if (!edges.has(c)) edges.set(c, []);
  }
  return edges;
}

/** First path (recipe names, outermost first) by which `recipeId` depends on `productId` at the site, or null. Cycle-safe. */
export function pathToProduct(state: AppState, siteId: string, recipeId: string, productId: string, seen: string[] = []): string[] | null {
  if (seen.includes(recipeId)) return null;
  const v = versionAt(state, recipeId, siteId);
  const name = state.recipes.find((r) => r.id === recipeId)?.name ?? recipeId;
  if (!v) return null;
  for (const c of v.components) {
    if (c.kind === "product" && c.productId === productId) return [name];
  }
  for (const c of v.components) {
    if (c.kind === "recipe") {
      const sub = pathToProduct(state, siteId, c.recipeId, productId, [...seen, recipeId]);
      if (sub) return [name, ...sub];
    }
  }
  return null;
}

/** Names of recipes referenced by an applicable version that have no approved version at the site (stale/missing). */
export function staleReferences(state: AppState, siteId: string, recipeId: string, seen: string[] = []): string[] {
  if (seen.includes(recipeId)) return [];
  const v = versionAt(state, recipeId, siteId);
  if (!v) return [];
  const out: string[] = [];
  for (const c of v.components) {
    if (c.kind !== "recipe") continue;
    if (!versionAt(state, c.recipeId, siteId)) out.push(state.recipes.find((r) => r.id === c.recipeId)?.name ?? c.recipeId);
    else out.push(...staleReferences(state, siteId, c.recipeId, [...seen, recipeId]));
  }
  return out;
}
