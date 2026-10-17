import React, { useState } from "react";
import { ACK_NOTICE, NOTIFICATION_NOTICE, canAct, channelStatus, checkCopy, outstandingAcks } from "@ingredientalert/core";
import { useStore } from "../store";
import { useConfirm } from "../confirm";
import { staffName } from "../lib";
import { useTheme } from "../design/theme";
import { Btn, Card, Chip, EmptyState, Field, Notice, StatusChip, Txt } from "../ui";
import { ErrorLine, NeedsRole } from "./shared";
import { DishLine } from "./Publish";

export function ServiceScreen() {
  const app = useStore();
  const c = useTheme();
  const s = app.state!;
  const site = app.siteId;
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [copyRev, setCopyRev] = useState("");
  const [copyResult, setCopyResult] = useState<"current" | "stale" | "unknown" | null>(null);
  const sv = channelStatus(s, site).find((x) => x.channel === "service_view")!;
  const shown = s.publications.find((p) => p.siteId === site && p.revision === sv.liveRevision);
  const acks = outstandingAcks(s, site);
  const me = app.actorId!;
  const myAck = shown ? s.acks.find((a) => a.publicationId === shown.id && a.staffId === me) : undefined;
  const isService = canAct(s, me, "acknowledge", site);
  const siteName = s.sites.find((x) => x.id === site)!.name;
  return (
    <>
      {!shown ? (
        <EmptyState icon="menu" title="No menu on the service view yet" body="Nothing has been put on this view. Use your normal allergen procedure and ask a manager." />
      ) : (
        <>
          {sv.status !== "current" ? <Notice tone="bad" text={`OUT OF DATE: this screen shows revision ${shown.revision}, but revision ${sv.latestRevision} exists and is not here yet. Ask a manager before relying on it.`} /> : null}
          <Card>
            <Chip tone={sv.status === "current" ? "ok" : "bad"} text={sv.status === "current" ? `Revision ${shown.revision}: newest` : `Revision ${shown.revision}: OLD`} />
            <Txt color={c.textMuted}>Open the allergens of a dish. "Contains" is from the ingredient declarations, "may contain" is the supplier's warning, and "Kitchen cross-contact procedures" are what this kitchen does. If a dish says UNKNOWN, do not serve it on this information: ask a manager.</Txt>
          </Card>
          {shown.dishes.map((d) => <DishLine key={d.recipeId} d={d} controls={shown.kitchenControlLines} />)}
          {sv.status === "current" ? (
            <Card>
              <Txt v="heading" header>Have you seen this?</Txt>
              {myAck ? <Chip tone="ok" text={`You acknowledged revision ${shown.revision}`} />
                : isService ? (
                  <Btn label={`I have seen revision ${shown.revision}`} onPress={() => confirm.ask({
                    title: `Confirm you saw revision ${shown.revision}?`,
                    body: `Record that ${staffName(s, me)} has seen revision ${shown.revision} of the menu for ${siteName}. ${ACK_NOTICE}`,
                    yes: "Yes, I have seen it", pin: true,
                    onYes: () => { const r = app.run((e, a) => e.acknowledge(a, shown.id, shown.revision)); setError(r.ok ? null : r.error); }
                  })} />
                ) : <NeedsRole role="service_staff" why="Only service staff confirm they have seen a new menu revision, each on their own sign-in." />}
              <ErrorLine msg={error} />
              <Txt color={c.textMuted}>{ACK_NOTICE}</Txt>
              {acks.outstanding.length > 0
                ? <><StatusChip id="ack_outstanding" extra={`${acks.outstanding.length}`} /><Txt>Not yet confirmed: {acks.outstanding.map((id) => staffName(s, id)).join(", ")}</Txt></>
                : <Txt>Everyone on the list has confirmed this revision.</Txt>}
              <Txt v="small" color={c.textMuted}>{NOTIFICATION_NOTICE}</Txt>
            </Card>
          ) : null}
        </>
      )}
      <Card>
        <Txt v="heading" header>Is a printed menu out of date?</Txt>
        <Txt color={c.textMuted}>Type the revision number printed at the bottom of the copy.</Txt>
        <Field label="Revision number on the printed copy" value={copyRev} onChange={(v) => { setCopyRev(v); setCopyResult(null); }} keyboard="numeric" />
        <Btn label="Check this copy" kind="secondary" onPress={() => setCopyResult(checkCopy(s, site, Number(copyRev)))} disabled={!copyRev} />
        {copyResult === "current" ? <Chip tone="ok" text="This copy is the newest revision" /> : null}
        {copyResult === "stale" ? <Chip tone="bad" text="OUT OF DATE: replace this copy" /> : null}
        {copyResult === "unknown" ? <Chip tone="unk" text="Not a revision this kitchen knows: do not rely on it" /> : null}
      </Card>
    </>
  );
}
