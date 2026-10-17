import React, { useState } from "react";
import { CHANNEL_LABEL, CHANNELS, DomainError, canAct, channelStatus, kitchenControlLines, siteDeclarations, type Channel, type DishDeclaration } from "@ingredientalert/core";
import { useStore } from "../store";
import { newRequestId, staffName } from "../lib";
import { c } from "../theme";
import { AllergenGroups, Button, Callout, Card, Chip, Screen, Section, Txt, useConfirm } from "../ui";
import { ErrorLine, SwitchHint } from "./shared";

export function PublishScreen() {
  const { go } = useStore();
  return (
    <Screen title="Publish menu updates" onBack={() => go("home")}>
      <PublishBody />
    </Screen>
  );
}

function PublishBody() {
  const { state, engine, site, personaId, run, go } = useStore();
  const s = state!;
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const allowed = canAct(s, personaId, "prepare_publication", site);
  const latest = engine!.latestPublication(s, site);
  const channels = channelStatus(s, site);
  const decl = siteDeclarations(s, site);
  const pending = !latest || latest.basisHash !== engine!.basisOf(s, site);
  const openCases = s.cases.filter((x) => x.siteId === site && x.state !== "approved" && x.state !== "rejected").length;
  const queued = s.outbox.filter((q) => q.siteId === site && q.status === "queued").length;
  const outstanding = channels.filter((ch) => ch.status !== "current");
  const unresolved = decl.filter((d) => !d.resolved);
  const controls = kitchenControlLines(s.controls, site);
  const nextRev = (latest?.revision ?? 0) + 1;
  const changed = latest ? decl.filter((d) => JSON.stringify([d.contains, d.mayContain, d.unresolved]) !== JSON.stringify(latestOf(latest.dishes, d.recipeId))) : decl;

  const prepare = () => {
    confirm.ask({
      title: `Prepare revision ${nextRev}?`,
      body: `This makes revision ${nextRev} of the menu for ${s.sites.find((x) => x.id === site)!.name}, with ${decl.length} dishes (${changed.length} changed). It is not shown anywhere until you update each place in the next step.`,
      yes: `Yes, prepare revision ${nextRev}`,
      onYes: () => {
        const r = run((e) => e.preparePublication(personaId, site, newRequestId()));
        if (r.ok) { setError(null); setBlockers([]); } else { setError(r.error); setBlockers(r.code === "publish_blocked" ? ((findDetail(r)) ?? []) : []); }
      }
    });
  };

  const update = (ch: Channel) => {
    const pub = latest!;
    confirm.ask({
      title: `Update ${CHANNEL_LABEL[ch]}?`,
      body: `Put revision ${pub.revision} on: ${CHANNEL_LABEL[ch]}. ${ch === "printed_menu" ? "In this demo the printer can be set to fail." : ""}`.trim(),
      yes: `Yes, update ${CHANNEL_LABEL[ch]}`,
      onYes: () => {
        const r = run((e) => e.publishChannel(personaId, pub.id, ch, newRequestId()));
        if (!r.ok) setError(r.error); else setError(r.value.ok ? null : `${CHANNEL_LABEL[ch]} update failed: ${r.value.error}`);
      }
    });
  };

  return (
    <>
      {!allowed && <SwitchHint role="publication_approver" why="Preparing and publishing a new menu revision is done by the publication approver." />}
      <ErrorLine msg={error} />
      {blockers.map((b) => <Callout key={b} kind="unk">{b}</Callout>)}

      {(openCases > 0 || queued > 0) && (
        <Card>
          <Chip kind="unk">Cannot publish yet</Chip>
          <Txt v="h2">{openCases + queued} {openCases + queued === 1 ? "delivery" : "deliveries"} not checked</Txt>
          <Txt>Menus that use {openCases + queued === 1 ? "it" : "them"} are UNKNOWN. A new revision cannot go out while a review is waiting.</Txt>
          <Button label="Go to Check a change" onPress={() => go(openCases > 0 ? "review" : "receive")} />
        </Card>
      )}

      {openCases === 0 && queued === 0 && pending && (
        <Card>
          <Txt v="h2" role="header">Step 1 of 2: Make revision {nextRev}</Txt>
          {unresolved.length > 0 ? (
            <>
              <Chip kind="unk">Still unknown - cannot be used</Chip>
              {unresolved.map((d) => <Txt key={d.recipeId}>• {d.recipeName}: UNKNOWN - cannot be used on a menu</Txt>)}
            </>
          ) : (
            <>
              <Chip kind="wait">{changed.length} {changed.length === 1 ? "dish" : "dishes"} changed</Chip>
              {changed.map((d) => <Txt key={d.recipeId}>• {d.recipeName}</Txt>)}
              <Button label={`Prepare revision ${nextRev}`} onPress={prepare} disabled={!allowed} />
            </>
          )}
        </Card>
      )}

      {latest && !pending && outstanding.length === 0 && (
        <Card><Chip kind="ok">Up to date</Chip><Txt>Revision {latest.revision} is on every menu. Nothing to publish.</Txt></Card>
      )}

      {latest && outstanding.length > 0 && openCases === 0 && (
        <>
          <Txt v="h2" role="header">Step 2 of 2: Update each place (revision {latest.revision})</Txt>
          {CHANNELS.map((ch) => {
            const v = channels.find((x) => x.channel === ch)!;
            return (
              <Card key={ch}>
                <Txt v="h2">{CHANNEL_LABEL[ch]}</Txt>
                {v.status === "current" ? <Chip kind="ok">Up to date (revision {v.liveRevision})</Chip>
                  : v.status === "failed" ? <Chip kind="bad">Update failed - still the old menu</Chip>
                  : <Chip kind="wait">Out of date</Chip>}
                <Txt color={c.muted}>{v.text}</Txt>
                {v.status !== "current" && <Button label={v.status === "failed" ? `Try ${CHANNEL_LABEL[ch]} again` : ch === "printed_menu" ? "Replace printed menus" : `Update ${CHANNEL_LABEL[ch]}`} onPress={() => update(ch)} disabled={!allowed} />}
              </Card>
            );
          })}
          {channels.some((v) => v.channel === "printed_menu" && v.status !== "current") && (
            <Callout kind="wait">Printed menus already on tables or walls keep the OLD information until someone replaces them. The revision number is printed at the bottom of each copy.</Callout>
          )}
        </>
      )}

      {latest && (
        <Section title="Details">
          <Txt color={c.muted}>Newest revision: {latest.revision}, made by {staffName(s, latest.createdBy)}. Older revisions are marked out of date.</Txt>
          {s.publications.filter((p) => p.siteId === site).sort((a, b) => b.revision - a.revision).map((p) => (
            <Txt key={p.id} color={c.muted}>Revision {p.revision}: {p.id === latest.id ? "newest" : "OUT OF DATE (replaced)"}; QR {p.channels.qr_web.status}, service {p.channels.service_view.status}, printed {p.channels.printed_menu.status}</Txt>
          ))}
          {decl.map((d) => <DishLine key={d.recipeId} d={d} controls={controls} />)}
        </Section>
      )}
    </>
  );
}

function latestOf(dishes: DishDeclaration[], id: string) {
  const d = dishes.find((x) => x.recipeId === id);
  return d ? [d.contains, d.mayContain, d.unresolved] : null;
}
function findDetail(r: { ok: false; error: string; code: string; detail?: unknown }): string[] | null {
  const d = r.detail as { blockers?: string[] } | undefined;
  return d?.blockers ?? null;
}

export function DishLine({ d, controls }: { d: DishDeclaration; controls: string[] }) {
  return (
    <Card>
      <Txt bold>{d.recipeName}</Txt>
      {d.resolved ? <Chip kind="ok">Recorded</Chip> : <Chip kind="unk">UNKNOWN - cannot be used on a menu</Chip>}
      <Section title="Allergens"><AllergenGroups d={d} controls={controls} /></Section>
    </Card>
  );
}
void DomainError;
