import React from "react";
import { View } from "react-native";
import { ALLERGENS, ALLERGEN_LABEL, CHANNEL_LABEL, allUnknownContains, allUnknownPrecaution, deliveryComparison, type Affected, type AppState, type Allergen, type ContainsMap, type DeclarationBrief, type PrecautionMap, type ReviewCase } from "@ingredientalert/core";
import { useTheme } from "./design/theme";
import { radius, space } from "./design/tokens";
import { Btn, Chip, Group, Txt } from "./ui";

const names = (xs: Allergen[]) => xs.map((a) => ALLERGEN_LABEL[a]).join(", ");

/**
 * Three separate groups, always in this order, never merged:
 *  1. Contains: ingredient declarations from the specification.
 *  2. Supplier precautionary statements ("may contain"): a different kind of statement, not an ingredient.
 *  3. Kitchen cross-contact procedures: written by people in this kitchen, never worked out from ingredients.
 */
export function AllergenGroups({ d, controls }: { d: DeclarationBrief; controls: string[] }) {
  const c = useTheme();
  const may = d.mayContain.filter((a) => !d.contains.includes(a));
  return (
    <View>
      {!d.resolved ? (
        <View style={{ backgroundColor: c.unkBg, borderRadius: radius.m, padding: space.s, marginBottom: space.s }}>
          <Txt v="label" color={c.unkText}>UNKNOWN: cannot be used on a menu</Txt>
          <Txt color={c.unkText}>Not established: {d.unresolved.length ? names(d.unresolved) : "see reasons"}.</Txt>
        </View>
      ) : null}
      <Group title="Contains (ingredients)" note="From the ingredient declarations in the reviewed specifications.">
        <Txt>{d.contains.length ? names(d.contains) : "None declared in the reviewed specifications"}</Txt>
      </Group>
      <Group title="Supplier precautionary statements (may contain)" note="The supplier's own warnings. These are not ingredients, and they are not the kitchen's procedures." tone="wait">
        <Txt>{may.length ? names(may) : "No supplier statements recorded"}</Txt>
      </Group>
      <Group title="Kitchen cross-contact procedures" note="Written by people in this kitchen. Never worked out from ingredients, and never a promise that a dish is free of an allergen." tone="info">
        {controls.length ? controls.map((l) => <Txt key={l}>{l}</Txt>) : <Txt>No kitchen procedures recorded</Txt>}
      </Group>
    </View>
  );
}

function Cell({ label, value, flag }: { label: string; value: string; flag: boolean }) {
  const c = useTheme();
  return (
    <View style={{ flexGrow: 1, flexShrink: 1, flexBasis: 130, minWidth: 0, backgroundColor: flag ? c.warnBg : c.surfaceAlt, borderRadius: radius.m, padding: space.xs }}>
      <Txt v="small" color={flag ? c.warnText : c.textMuted}>{label}</Txt>
      <Txt color={flag ? c.warnText : c.text}>{value}</Txt>
    </View>
  );
}

/** Expected and delivered side by side (stacked only if a column would be too narrow). A difference is marked with the words DIFFERENT, not just a colour. */
export function ComparisonTable({ s, cs }: { s: AppState; cs: ReviewCase }) {
  const c = useTheme();
  const { rows, allergenRows } = deliveryComparison(s, cs);
  const diffs = rows.filter((r) => r.differs).length;
  return (
    <View testID="comparison">
      <Txt color={c.textMuted}>{diffs === 0 ? "Nothing differs in the fields compared. A barcode and a label do not show what is inside the pack." : `${diffs} ${diffs === 1 ? "thing differs" : "things differ"}, marked DIFFERENT below.`}</Txt>
      {rows.map((r) => (
        <View key={r.field} style={{ marginTop: space.s }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8 }}>
            <Txt v="label">{r.field}</Txt>
            {r.differs ? <Chip tone="wait" text="DIFFERENT" /> : <Txt v="small" color={c.textMuted}>same</Txt>}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: 4 }}>
            <Cell label="Ordered (expected)" value={r.expected} flag={r.differs} />
            <Cell label="Arrived (delivered)" value={r.delivered} flag={r.differs} />
          </View>
          {r.note ? <Txt v="small" color={c.textMuted}>{r.note}</Txt> : null}
        </View>
      ))}
      {allergenRows ? (
        <View style={{ marginTop: space.m }}>
          <Txt v="heading" header>Allergen statements compared</Txt>
          <Txt v="small" color={c.textMuted}>Ingredient declarations and the supplier's "may contain" warnings are compared separately.</Txt>
          <Pair title="Contains (ingredients)" a={allergenRows.expectedContains} b={allergenRows.deliveredContains} />
          <Pair title="Supplier may-contain statements" a={allergenRows.expectedMay} b={allergenRows.deliveredMay} />
        </View>
      ) : null}
    </View>
  );
}
function Pair({ title, a, b }: { title: string; a: string; b: string }) {
  const diff = a !== b;
  return (
    <View style={{ marginTop: space.s }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 8 }}>
        <Txt v="label">{title}</Txt>
        {diff ? <Chip tone="wait" text="DIFFERENT" /> : null}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.xs, marginTop: 4 }}>
        <Cell label="Ordered (expected)" value={a} flag={diff} />
        <Cell label="Arrived (delivered)" value={b} flag={diff} />
      </View>
    </View>
  );
}

/** Which recipes, which site, which publication places a change touches, and which sites it does not. */
export function ScopeBlock({ a }: { a: Affected }) {
  const c = useTheme();
  return (
    <View testID="scope">
      <Txt v="label">Recipes affected ({a.recipes.length})</Txt>
      {a.recipes.length === 0 ? <Txt color={c.textMuted}>Not worked out yet. It is calculated in the review step.</Txt> : a.recipes.map((r) => (
        <Txt key={r.id}>• {r.name}{r.kind === "component" ? " (a recipe used inside other recipes)" : ""}{r.changes ? "" : " (allergen answers do not change)"}</Txt>
      ))}
      <Txt v="label" style={{ marginTop: space.s }}>Site changed by this approval</Txt>
      <Txt>• {a.siteName}</Txt>
      {a.otherSites.length ? <Txt v="small" color={c.textMuted}>Also uses these recipes but is NOT changed by this approval: {a.otherSites.join(", ")}. Each site decides for itself.</Txt> : null}
      <Txt v="label" style={{ marginTop: space.s }}>Publication places that will need a new revision</Txt>
      {a.channels.map((ch) => (
        <Txt key={ch.channel}>• {CHANNEL_LABEL[ch.channel]}: {ch.liveRevision === null ? "nothing published yet" : `showing revision ${ch.liveRevision}`}</Txt>
      ))}
    </View>
  );
}

const CYCLE_C: Record<string, string> = { unknown: "declared", declared: "not_declared", not_declared: "unknown" };
const CYCLE_P: Record<string, string> = { unknown: "stated", stated: "not_stated", not_stated: "unknown" };
const WORD_C: Record<string, string> = { unknown: "UNKNOWN", declared: "Yes", not_declared: "No" };
const WORD_P: Record<string, string> = { unknown: "UNKNOWN", stated: "Yes", not_stated: "No" };
export interface Maps { c: ContainsMap; p: PrecautionMap }

/** Entering a specification: ingredient declarations and the supplier's "may contain" warnings are two separate groups of answers. */
export function AllergenEditor({ maps, setMaps }: { maps: Maps; setMaps: (m: Maps) => void }) {
  const unkC = ALLERGENS.filter((a) => maps.c[a] === "unknown").length;
  const unkP = ALLERGENS.filter((a) => maps.p[a] === "unknown").length;
  return (
    <>
      <Group title="Contains (ingredients)" note={`Does the sheet list it as an ingredient? Tap to change. ${unkC} UNKNOWN.`}>
        {ALLERGENS.map((a) => (
          <Btn key={a} kind="secondary" label={`${ALLERGEN_LABEL[a]}: contains ${WORD_C[maps.c[a]]}`} onPress={() => setMaps({ ...maps, c: { ...maps.c, [a]: CYCLE_C[maps.c[a]] as ContainsMap[Allergen] } })} />
        ))}
      </Group>
      <Group tone="wait" title="Supplier precautionary statements (may contain)" note={`Does the supplier add a "may contain" warning? Separate from ingredients. ${unkP} UNKNOWN.`}>
        {ALLERGENS.map((a) => (
          <Btn key={a} kind="secondary" label={`${ALLERGEN_LABEL[a]}: may contain ${WORD_P[maps.p[a]]}`} onPress={() => setMaps({ ...maps, p: { ...maps.p, [a]: CYCLE_P[maps.p[a]] as PrecautionMap[Allergen] } })} />
        ))}
      </Group>
    </>
  );
}
export const unknownMaps = (): Maps => ({ c: allUnknownContains(), p: allUnknownPrecaution() });
export const unknownCountOf = (m: Maps) => ALLERGENS.filter((a) => m.c[a] === "unknown" || m.p[a] === "unknown").length;
