import React from "react";
import { Btn, Card, Notice, Txt } from "./ui";
import type { ScannerProps } from "./Scanner";

/** Browser build: no camera scanning (it is an Android function). The fallback is the same one used when the camera is unavailable. */
export function Scanner(p: ScannerProps) {
  return (
    <Card>
      <Txt v="heading" header>Camera scanning is not available here</Txt>
      <Notice tone="info" text="Barcode scanning with the camera is built for the Android app only. In this browser build, type the number printed under the barcode, or search by name." />
      <Btn label="Type the number or search instead" icon="search" onPress={p.onManual} />
    </Card>
  );
}
