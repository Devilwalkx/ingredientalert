import React from "react";
import { ROLE_LABEL, type Role } from "@ingredientalert/core";
import { useStore } from "../store";
import { Btn, Card, Notice, Txt } from "../ui";

/** "This step belongs to someone else": explains it and offers the ordinary shared-device action, switching person (which locks). */
export function NeedsRole({ role, why }: { role: Role; why: string }) {
  const app = useStore();
  return (
    <Card tone="info">
      <Txt v="label">This step is for the {ROLE_LABEL[role]}.</Txt>
      <Txt>{why}</Txt>
      <Txt v="small">You are signed in as {app.actor?.name ?? "nobody"}.</Txt>
      <Btn label="Switch person" kind="secondary" icon="person" onPress={app.lock} />
    </Card>
  );
}
export const ErrorLine = ({ msg }: { msg: string | null }) => (msg ? <Notice tone="bad" text={msg} /> : null);
