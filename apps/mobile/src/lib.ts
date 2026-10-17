import { PERSONAS, ROLE_LABEL, rolesAt, type AppState, type Role } from "@ingredientalert/core";

export const productName = (s: AppState, id: string | null) => (id ? s.products.find((p) => p.id === id)?.name ?? id : "Unknown product");
export const staffName = (s: AppState, id: string) => (s.staff.find((x) => x.id === id)?.name ?? id).split(" ")[0]!;
export function personaLine(s: AppState, id: string, site: string): string {
  const roles = rolesAt(s, id, site).map((r) => ROLE_LABEL[r]);
  return `${staffName(s, id)} · ${roles.length ? roles.join(", ") : "no role here"}`;
}
/** Demo persona who holds a role (to offer a one-tap switch). */
export function personaFor(role: Role) {
  return PERSONAS.find((p) => p.role === role)!;
}
export function newRequestId(): string {
  const a = new Uint8Array(8);
  globalThis.crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}
