import { describe, expect, it } from "vitest";
import { ALLERGENS, baseState, declare, findCycle, MAIN, ANNEX, recipeEdges, type AppState, type ContainsState, type PrecautionState } from "../src/index.js";
import { newEngine, dish, fullSauceChain } from "./helpers.js";

function rng(seed: number) {
  let x = seed;
  return () => ((x = (x * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe("declarations: unknown is never turned into 'not declared'", () => {
  it("property: for random specifications, an allergen unknown anywhere (and not declared elsewhere) is listed as unresolved, the dish is unresolved and the label says UNRESOLVED", () => {
    const rand = rng(42);
    for (let i = 0; i < 300; i++) {
      const s: AppState = baseState();
      for (const spec of s.specs.filter((x) => x.tenantId === "tenant-1")) {
        for (const a of ALLERGENS) {
          const r = rand();
          spec.contains[a] = (r < 0.15 ? "unknown" : r < 0.4 ? "declared" : "not_declared") as ContainsState;
          const q = rand();
          spec.precautionary[a] = (q < 0.1 ? "unknown" : q < 0.3 ? "stated" : "not_stated") as PrecautionState;
        }
      }
      const d = declare(s, "d-salmon", MAIN);
      const used = ["spec-p-teriyaki", "spec-p-garlic", "spec-p-onions", "spec-p-salmon", "spec-p-rice"].map((id) => s.specs.find((x) => x.id === id)!);
      for (const a of ALLERGENS) {
        const declared = used.some((sp) => sp.contains[a] === "declared");
        const unknown = used.some((sp) => sp.contains[a] === "unknown" || sp.precautionary[a] === "unknown");
        if (declared) {
          expect(d.contains).toContain(a);
        } else if (unknown) {
          expect(d.unresolved, `${a} unknown must stay unresolved`).toContain(a);
          expect(d.contains).not.toContain(a);
          expect(d.resolved).toBe(false);
          expect(d.lines.join("\n")).toContain("UNRESOLVED");
        } else {
          expect(d.unresolved).not.toContain(a);
        }
      }
    }
  });

  it("a missing specification makes every allergen unresolved", () => {
    const s = baseState();
    s.products.find((p) => p.id === "p-rice")!.approvedSpecId = null;
    const d = declare(s, "d-salmon", MAIN);
    expect(d.resolved).toBe(false);
    expect(d.unresolved.length).toBeGreaterThanOrEqual(ALLERGENS.length - d.contains.length);
    expect(d.reasons.join(" ")).toMatch(/No verified specification/);
  });

  it("unknown product reference and stale (missing) sub-recipe at a site are unresolved", () => {
    const { e } = newEngine();
    e.addRecipeVersion("sam", { newRecipe: { name: "Main-only relish", kind: "component" }, components: [{ kind: "product", productId: "p-onions" }], siteIds: [MAIN] });
    const relishId = e.state.recipes.find((r) => r.name === "Main-only relish")!.id;
    e.addRecipeVersion("sam", { newRecipe: { name: "Annex burger", kind: "dish" }, components: [{ kind: "recipe", recipeId: relishId }], siteIds: [ANNEX] });
    const burger = e.state.recipes.find((r) => r.name === "Annex burger")!;
    const d = declare(e.state, burger.id, ANNEX);
    expect(d.resolved).toBe(false);
    expect(d.reasons.join(" ")).toMatch(/missing or stale reference/);
    expect(() => e.addRecipeVersion("sam", { newRecipe: { name: "Bad", kind: "dish" }, components: [{ kind: "product", productId: "nope" }], siteIds: [MAIN] })).toThrow();
  });
});

describe("contains / may contain / kitchen controls stay separate", () => {
  it("the replacement sauce adds sesame as an ingredient declaration and peanuts only as a precautionary statement", () => {
    const { e } = newEngine();
    const before = dish(e, "d-salmon");
    expect(before.contains).toEqual(expect.arrayContaining(["fish", "soybeans", "gluten"]));
    expect(before.mayContain).toContain("sesame");
    expect(before.contains).not.toContain("sesame");
    fullSauceChain(e);
    const after = dish(e, "d-salmon");
    expect(after.contains).toContain("sesame");
    expect(after.contains).not.toContain("peanuts");
    expect(after.mayContain).toContain("peanuts");
    expect(after.resolved).toBe(true);
    expect(after.lines.join("\n")).toMatch(/Contains \(ingredient declarations\): .*Sesame/);
    expect(after.lines.join("\n")).toMatch(/May contain \(supplier precautionary statements\): .*Peanuts/);
  });

  it("kitchen controls are recorded by people, shown separately and never change the ingredient declaration; none recorded is stated, not inferred", () => {
    const { e } = newEngine();
    const pubBefore = e.publicationsAt("sam", MAIN)[0]!;
    expect(pubBefore.kitchenControlLines.join(" ")).toMatch(/none recorded/);
    const declBefore = JSON.stringify(dish(e, "d-satay"));
    e.setKitchenControl("morgan", MAIN, "peanuts", "Separate chopping board and tongs for peanut dishes");
    expect(JSON.stringify(dish(e, "d-satay"))).toBe(declBefore);
    const { publication } = e.preparePublication("sam", MAIN, "p2");
    expect(publication.kitchenControlLines.join("\n")).toMatch(/Peanuts: Separate chopping board/);
    expect(publication.dishes.flatMap((d) => d.lines).join("\n")).not.toMatch(/chopping board/);
  });
});

describe("nested recipes and cycles", () => {
  it("the sauce reaches both dishes through the glaze recipe, not the unrelated ones", () => {
    const { e } = newEngine();
    const hold = e.receiveDelivery("alex", { siteId: MAIN, orderedProductId: "p-teriyaki", barcode: "5019999999919", packSize: "1L", batchCode: "X", labelSpecRef: "", deliveryNoteRef: "DN-1" }, "r");
    expect(hold.caseId).toBeTruthy();
    expect(dish(e, "d-salmon").resolved).toBe(false);
    expect(dish(e, "d-chicken-rice").resolved).toBe(false);
    expect(dish(e, "d-prawn").resolved).toBe(true);
    expect(dish(e, "d-omelette").resolved).toBe(true);
  });

  it("rejects a recipe version that makes recipes depend on themselves and leaves data unchanged", () => {
    const { e } = newEngine();
    const v = e.state.version;
    let err: any;
    try { e.addRecipeVersion("sam", { recipeId: "rc-glaze", components: [{ kind: "recipe", recipeId: "d-salmon" }], siteIds: [MAIN] }); } catch (x) { err = x; }
    expect(err?.code).toBe("cycle");
    expect(e.state.version).toBe(v);
    expect(() => e.addRecipeVersion("sam", { recipeId: "rc-glaze", components: [{ kind: "recipe", recipeId: "rc-glaze" }], siteIds: [MAIN] })).toThrow(/themselves/);
  });

  it("detects a longer A -> B -> C -> A cycle", () => {
    const cyc = findCycle(new Map([["A", ["B"]], ["B", ["C"]], ["C", ["A"]], ["D", []]]));
    expect(cyc).toEqual(["A", "B", "C", "A"]);
    expect(findCycle(new Map([["A", ["B"]], ["B", []]]))).toBeNull();
    expect(findCycle(recipeEdges(baseState()))).toBeNull();
  });

  it("a cycle that already exists in imported data resolves as UNRESOLVED instead of looping", () => {
    const s = baseState();
    s.recipeVersions.find((v) => v.recipeId === "rc-glaze")!.components.push({ kind: "recipe", recipeId: "d-salmon" });
    const d = declare(s, "d-salmon", MAIN);
    expect(d.resolved).toBe(false);
    expect(d.reasons.join(" ")).toMatch(/cycle/i);
  });
});
