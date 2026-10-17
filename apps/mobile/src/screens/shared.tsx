import React from "react";
import { ROLE_LABEL, type Role } from "@ingredientalert/core";
import { useStore } from "../store";
import { personaFor } from "../lib";
import { Button, Callout, Card, Txt } from "../ui";

/** Friendly "this step belongs to someone else" prompt with a one-tap demo switch. */
export function SwitchHint({ role, why }: { role: Role; why: string }) {
  const { setPersona } = useStore();
  const p = personaFor(role);
  return (
    <Card tone="accent">
      <Txt bold>This step is for {ROLE_LABEL[role]}.</Txt>
      <Txt>{why}</Txt>
      <Button label={`Switch to ${p.name} (demo)`} kind="secondary" onPress={() => setPersona(p.id)} />
    </Card>
  );
}

export function ErrorLine({ msg }: { msg: string | null }) {
  return msg ? <Callout kind="bad">{msg}</Callout> : null;
}
