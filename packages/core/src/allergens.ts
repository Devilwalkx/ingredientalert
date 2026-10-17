/**
 * The 14 allergens that must be declared in the UK (as listed in the build brief).
 * The list is data, not advice: confirm against current FSA guidance (not verified in this build).
 */
export const ALLERGENS = [
  "celery", "gluten", "crustaceans", "eggs", "fish", "lupin", "milk",
  "molluscs", "mustard", "tree_nuts", "peanuts", "sesame", "soybeans", "sulphites"
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  celery: "Celery",
  gluten: "Cereals containing gluten",
  crustaceans: "Crustaceans",
  eggs: "Eggs",
  fish: "Fish",
  lupin: "Lupin",
  milk: "Milk",
  molluscs: "Molluscs",
  mustard: "Mustard",
  tree_nuts: "Tree nuts",
  peanuts: "Peanuts",
  sesame: "Sesame",
  soybeans: "Soybeans",
  sulphites: "Sulphur dioxide / sulphites"
};

/**
 * Declared ingredient allergens. Evidence states only what a source says:
 * "declared" = the specification lists it as an ingredient, "not_declared" = the specification
 * says it is not an ingredient, "unknown" = nobody has established it. Unknown is never "not_declared".
 */
export type ContainsState = "declared" | "not_declared" | "unknown";
/** Supplier precautionary ("may contain") statements. Kept apart from ingredient declarations. */
export type PrecautionState = "stated" | "not_stated" | "unknown";

export type ContainsMap = Record<Allergen, ContainsState>;
export type PrecautionMap = Record<Allergen, PrecautionState>;

export function allUnknownContains(): ContainsMap {
  return Object.fromEntries(ALLERGENS.map((a) => [a, "unknown"])) as ContainsMap;
}
export function allUnknownPrecaution(): PrecautionMap {
  return Object.fromEntries(ALLERGENS.map((a) => [a, "unknown"])) as PrecautionMap;
}

/** Convenience for fixtures: everything not listed is `not_declared` / `not_stated`. */
export function specMaps(declared: Allergen[], stated: Allergen[] = []): { contains: ContainsMap; precautionary: PrecautionMap } {
  const contains = Object.fromEntries(ALLERGENS.map((a) => [a, declared.includes(a) ? "declared" : "not_declared"])) as ContainsMap;
  const precautionary = Object.fromEntries(ALLERGENS.map((a) => [a, stated.includes(a) ? "stated" : "not_stated"])) as PrecautionMap;
  return { contains, precautionary };
}

export function isAllergen(x: unknown): x is Allergen {
  return typeof x === "string" && (ALLERGENS as readonly string[]).includes(x);
}
