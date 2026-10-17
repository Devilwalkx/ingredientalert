import React, { useState } from "react";
import {
  CHANNEL_LABEL, CHANNELS, PUBLICATION_NOTICE, STATUS_MEANING, canAct, channelStatus, kitchenControlLines, outstandingAcks, siteDeclarations, statusItems,
  type Channel, type DishDeclaration
} from "@ingredientalert/core";
import { useStore } from "../store";
import { useConfirm } from "../confirm";
import { newRequestId, plural, staffName } from "../lib";
import { AllergenGroups } from "../components";
import { useTheme } from "../design/theme";
import { Btn, Card, Chip, Collapsible, EmptyState, Notice, StatusChip, Txt } from "../ui";
import { ErrorLine, NeedsRole } from "./shared";

const SIM: Record<Channel, string> = { qr_web: "QR / web menu (simulated)", service_view: "Service view (on this device)", printed_menu: "Printed menu (simulated printer)" };

export function PublishScreen() {
  const app = useStore();
  const c = useTheme();
  const s = app.state!;
  const e = app.engine!;
  const site = app.siteId;
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const allowed = canAct(s, app.actorId!, "prepare_publication", site);
  const latest = e.latestPublication(s, site);
  const channels = channelStatus(s, site);
  const decl = siteDeclarations(s, site);
  const pending = !latest || latest.basisHash !== e.basisOf(s, site);
  const openCases = s.cases.filter((x) => x.siteId === site && x.state !== "approved" && x.state !== "rejected").length;
  const queued = s.outbox.filter((q) => q.siteId === site && q.status === "queued").length;
  const outstanding = channels.filter((ch) => ch.status !== "current");
  const unresolved = decl.filter((d) => !d.resolved);
  const nextRev = (latest?.revision ?? 0) + 1;
  const changed = latest ? decl.filter((d) => JSON.stringify([d.contains, d.mayContain, d.unresolved]) !== JSON.stringify(latestOf(latest.dishes, d.recipeId))) : decl;
  const items = statusItems(e, site);
  const acks = outstandingAcks(s, site);
  const siteName = s.sites.find((x) => x.id === site)!.name;

  const prepare = () => confirm.ask({
    title: `Prepare revision ${nextRev}?`,
    body: `This makes revision ${nextRev} of the menu for ${siteName}, with ${decl.length} dishes (${changed.length} changed). It is not shown anywhere until you update each place in the next step.`,
    yes: `Yes, prepare revision ${nextRev}`, pin: true,
    onYes: () => {
      const r = app.run((en, a) => en.preparePublication(a, site, newRequestId()));
      if (r.ok) { setError(null); setBlockers([]); } else { setError(r.error); setBlockers(r.code === "publish_blocked" ? ((r.detail as { blockers?: string[] } | undefined)?.blockers ?? []) : []); }
    }
  });
  const update = (ch: Channel) => {
    const pub = latest!;
    confirm.ask({
      title: `Update ${SIM[ch]}?`,
      body: ch === "service_view"
        ? `Show revision ${pub.revision} on the service view on this device.`
        : `Record that revision ${pub.revision} is on: ${SIM[ch]}. ${PUBLICATION_NOTICE}`,
      yes: `Yes, update ${CHANNEL_LABEL[ch]}`, pin: true,
      onYes: () => {
        const r = app.run((en, a) => en.publishChannel(a, pub.id, ch, newRequestId()));
        if (!r.ok) setError(r.error); else setError(r.value.ok ? null : `${CHANNEL_LABEL[ch]} update failed: ${r.value.error}`);
      }
    });
  };

  return (
    <>
      <Notice tone="info" text={PUBLICATION_NOTICE} />
      {!allowed ? <NeedsRole role="publication_approver" why="Preparing and publishing a new menu revision is done by the publication approver." /> : null}
      <ErrorLine msg={error} />
      {blockers.map((b) => <Notice key={b} tone="unk" text={b} />)}

      {items.length === 0 && !pending ? (
        <EmptyState icon="ok" title="Nothing outstanding" body="No review is waiting, every place shows the newest revision, and everyone on the list has confirmed it. This is the app's record, not a guarantee about the kitchen." />
      ) : null}

      {(openCases > 0 || queued > 0) ? (
        <Card tone="unk">
          <StatusChip id={s.cases.some((x) => x.siteId === site && x.state === "review_required") || queued > 0 ? "awaiting_specification" : "awaiting_review"} />
          <Txt v="heading">{plural(openCases + queued, "delivery", "deliveries")} not decided</Txt>
          <Txt>Menus that use {openCases + queued === 1 ? "it" : "them"} are UNKNOWN. A new revision cannot go out while a review is waiting.</Txt>
          <Btn label={openCases > 0 ? "Go to review" : "Check the written-down deliveries"} onPress={() => app.go(openCases > 0 ? "review" : "receive")} />
        </Card>
      ) : null}

      {openCases === 0 && queued === 0 && pending ? (
        <Card>
          <Txt v="heading" header>Step 1 of 2: make revision {nextRev}</Txt>
          {unresolved.length > 0 ? (
            <>
              <Chip tone="unk" text="Still unknown: cannot be used" />
              {unresolved.map((d) => <Txt key={d.recipeId}>• {d.recipeName}: UNKNOWN, cannot be used on a menu</Txt>)}
            </>
          ) : decl.length === 0 ? (
            <Txt>There are no dishes yet. Add recipes in kitchen setup first.</Txt>
          ) : (
            <>
              <Chip tone="wait" text={`${plural(changed.length, "dish", "dishes")} changed since the last revision`} />
              {changed.map((d) => <Txt key={d.recipeId}>• {d.recipeName}</Txt>)}
              <Btn label={`Prepare revision ${nextRev}`} onPress={prepare} disabled={!allowed} />
            </>
          )}
        </Card>
      ) : null}

      {latest && !pending && outstanding.length === 0 ? (
        <Card tone="ok"><Chip tone="ok" text={`Revision ${latest.revision} is on every place`} /><Txt>Nothing to publish.</Txt></Card>
      ) : null}

      {latest && outstanding.length > 0 && openCases === 0 ? (
        <>
          <Txt v="heading" header>Step 2 of 2: update each place (revision {latest.revision})</Txt>
          <StatusChip id="publication_incomplete" extra={`${outstanding.length} of ${CHANNELS.length} places`} />
          {CHANNELS.map((ch) => {
            const v = channels.find((x) => x.channel === ch)!;
            return (
              <Card key={ch}>
                <Txt v="heading">{SIM[ch]}</Txt>
                {v.status === "current" ? <Chip tone="ok" text={`Up to date (revision ${v.liveRevision})`} />
                  : v.status === "failed" ? <Chip tone="bad" text="Update failed: still the old menu" />
                  : <Chip tone="wait" text="Out of date" />}
                <Txt color={c.textMuted}>{v.text}</Txt>
                {v.status !== "current" ? <Btn label={v.status === "failed" ? `Try ${CHANNEL_LABEL[ch]} again` : ch === "printed_menu" ? "Replace printed menus" : `Update ${CHANNEL_LABEL[ch]}`} onPress={() => update(ch)} disabled={!allowed} /> : null}
              </Card>
            );
          })}
          {channels.some((v) => v.channel === "printed_menu" && v.status !== "current") ? (
            <Notice tone="wait" text="Printed menus already on tables or walls keep the OLD information until someone replaces them. The revision number is printed at the bottom of each copy." />
          ) : null}
        </>
      ) : null}

      {acks.revision !== null && acks.outstanding.length > 0 && channels.find((x) => x.channel === "service_view")?.status === "current" ? (
        <Card>
          <StatusChip id="ack_outstanding" extra={`${acks.outstanding.length}`} />
          <Txt>{STATUS_MEANING.ack_outstanding}</Txt>
          <Txt>Not yet confirmed: {acks.outstanding.map((id) => staffName(s, id)).join(", ")}.</Txt>
          <Txt v="small" color={c.textMuted}>No message is sent to them. They confirm by signing in on this device and opening the service menu.</Txt>
          <Btn label="Open the service menu" kind="secondary" onPress={() => app.go("service")} />
        </Card>
      ) : null}

      {latest ? (
        <Collapsible title="History and details">
          <Txt color={c.textMuted}>Newest revision: {latest.revision}, made by {staffName(s, latest.createdBy)}. Older revisions are marked out of date.</Txt>
          {s.publications.filter((p) => p.siteId === site).sort((a, b) => b.revision - a.revision).map((p) => (
            <Txt key={p.id} color={c.textMuted}>Revision {p.revision}: {p.id === latest.id ? "newest" : "OUT OF DATE (replaced)"}; QR {p.channels.qr_web.status}, service {p.channels.service_view.status}, printed {p.channels.printed_menu.status}</Txt>
          ))}
        </Collapsible>
      ) : null}
    </>
  );
}

function latestOf(dishes: DishDeclaration[], id: string) {
  const d = dishes.find((x) => x.recipeId === id);
  return d ? [d.contains, d.mayContain, d.unresolved] : null;
}

export function DishLine({ d, controls }: { d: DishDeclaration; controls: string[] }) {
  return (
    <Card>
      <Txt v="heading">{d.recipeName}</Txt>
      {d.resolved ? <Chip tone="ok" text="Recorded" /> : <Chip tone="unk" text="UNKNOWN: cannot be used on a menu" />}
      <Collapsible title={`Allergens: ${d.recipeName}`}><AllergenGroups d={d} controls={controls} /></Collapsible>
    </Card>
  );
}
void kitchenControlLines;
