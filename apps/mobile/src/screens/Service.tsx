import React, { useState } from "react";
import { ACK_NOTICE, canAct, channelStatus, checkCopy, outstandingAcks } from "@ingredientalert/core";
import { useStore } from "../store";
import { staffName } from "../lib";
import { c } from "../theme";
import { Button, Callout, Card, Chip, Field, Screen, Txt, useConfirm } from "../ui";
import { ErrorLine, SwitchHint } from "./shared";
import { DishLine } from "./Publish";

export function ServiceScreen() {
  const { go } = useStore();
  return (
    <Screen title="Menu for service" onBack={() => go("home")}>
      <ServiceBody />
    </Screen>
  );
}

function ServiceBody() {
  const { state, site, personaId, run } = useStore();
  const s = state!;
  const confirm = useConfirm();
  const [error, setError] = useState<string | null>(null);
  const [copyRev, setCopyRev] = useState("");
  const [copyResult, setCopyResult] = useState<"current" | "stale" | "unknown" | null>(null);
  const sv = channelStatus(s, site).find((x) => x.channel === "service_view")!;
  const shown = s.publications.find((p) => p.siteId === site && p.revision === sv.liveRevision);
  const latestRev = sv.latestRevision;
  const acks = outstandingAcks(s, site);
  const myAck = shown ? s.acks.find((a) => a.publicationId === shown.id && a.staffId === personaId) : undefined;
  const isService = canAct(s, personaId, "acknowledge", site);
  const siteName = s.sites.find((x) => x.id === site)!.name;

  return (
    <>
      {!shown ? (
        <Card><Chip kind="wait">Nothing here yet</Chip><Txt>No menu has been put on the service view. Use your normal allergen procedure.</Txt></Card>
      ) : (
        <>
          {sv.status !== "current" && (
            <Callout kind="bad">OUT OF DATE: this screen shows revision {shown.revision}, but revision {latestRev} exists and is not here yet. Ask a manager before relying on it.</Callout>
          )}
          <Card>
            <Chip kind={sv.status === "current" ? "ok" : "bad"}>{sv.status === "current" ? `Revision ${shown.revision} - newest` : `Revision ${shown.revision} - OLD`}</Chip>
            <Txt color={c.muted}>Open "Allergens" on a dish. "Contains" and "May contain" come from supplier paperwork. "Kitchen controls" are set by the kitchen. If a dish says UNKNOWN, do not serve it on this information; ask a manager.</Txt>
          </Card>
          {shown.dishes.map((d) => <DishLine key={d.recipeId} d={d} controls={shown.kitchenControlLines} />)}

          {sv.status === "current" && (
            <Card>
              <Txt v="h2" role="header">Have you seen this?</Txt>
              {myAck ? <Chip kind="ok">You acknowledged revision {shown.revision}</Chip>
                : isService ? (
                  <Button label={`I have seen revision ${shown.revision}`} onPress={() =>
                    confirm.ask({
                      title: `Confirm you saw revision ${shown.revision}?`,
                      body: `Record that ${staffName(s, personaId)} has seen revision ${shown.revision} of the menu for ${siteName}. ${ACK_NOTICE}`,
                      yes: "Yes, I have seen it",
                      onYes: () => { const r = run((e) => e.acknowledge(personaId, shown.id, shown.revision)); setError(r.ok ? null : r.error); }
                    })} />
                ) : <SwitchHint role="service_staff" why="Only service staff confirm they have seen a new menu revision." />}
              <ErrorLine msg={error} />
              <Txt color={c.muted}>{ACK_NOTICE}</Txt>
              {acks.outstanding.length > 0
                ? <Txt>Not yet acknowledged: {acks.outstanding.map((id) => staffName(s, id)).join(", ")}</Txt>
                : <Txt>Everyone on the list has acknowledged.</Txt>}
            </Card>
          )}
        </>
      )}

      <Card>
        <Txt v="h2" role="header">Is a printed menu out of date?</Txt>
        <Txt color={c.muted}>Type the revision number printed at the bottom of the copy.</Txt>
        <Field label="Revision number on the printed copy" value={copyRev} onChange={(v) => { setCopyRev(v); setCopyResult(null); }} keyboard="numeric" />
        <Button label="Check this copy" kind="secondary" onPress={() => setCopyResult(checkCopy(s, site, Number(copyRev)))} disabled={!copyRev} />
        {copyResult === "current" && <Chip kind="ok">This copy is the newest revision</Chip>}
        {copyResult === "stale" && <Chip kind="bad">OUT OF DATE - replace this copy</Chip>}
        {copyResult === "unknown" && <Chip kind="unk">Not a revision this kitchen knows - do not rely on it</Chip>}
      </Card>
    </>
  );
}
