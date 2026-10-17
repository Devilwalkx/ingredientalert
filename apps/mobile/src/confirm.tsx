import React, { createContext, useContext, useState } from "react";
import { View } from "react-native";
import { useApp } from "./store";
import { ConfirmCard, Field } from "./ui";

export interface Ask {
  title: string;
  body: string;
  yes: string;
  no?: string;
  danger?: boolean;
  /** Ask the signed-in person for their PIN first (only where the kitchen uses PINs). Per-action attribution on a shared device. */
  pin?: boolean;
  onYes: () => void;
}
const Ctx = createContext<{ ask: (a: Ask) => void }>({ ask: () => undefined });
export const useConfirm = () => useContext(Ctx);

export function ConfirmHost({ children }: { children: React.ReactNode }) {
  const app = useApp();
  const [a, setA] = useState<Ask | null>(null);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const close = () => { setA(null); setPin(""); setErr(null); };
  const needPin = !!a?.pin && app.stepUpRequired;
  return (
    <Ctx.Provider value={{ ask: (x) => { setPin(""); setErr(null); setA(x); } }}>
      {children}
      {a ? (
        <ConfirmCard
          title={a.title}
          body={a.body}
          yes={a.yes}
          no={a.no ?? "No, go back"}
          danger={a.danger}
          onNo={close}
          onYes={() => {
            if (needPin) {
              const r = app.confirmPin(pin);
              if (!r.ok) { setErr(r.error); return; }
            }
            const f = a.onYes;
            close();
            f();
          }}
          extra={needPin ? (
            <View style={{ marginTop: 12 }}>
              <Field label="Your PIN" value={pin} onChange={(v) => { setPin(v.replace(/\D/g, "")); setErr(null); }} keyboard="numeric" secure maxLength={6} error={err} help={`Confirms it is you, ${app.actor?.name.split(" ")[0] ?? ""}, and not the next person to pick up the device.`} />
            </View>
          ) : null}
        />
      ) : null}
    </Ctx.Provider>
  );
}
