import { forbidden } from "./errors.js";
import type { AppState, Role, Staff } from "./types.js";

export type Action =
  | "read" | "receive" | "verify_spec" | "review_impact" | "reject_case" | "approve_case" | "end_substitution"
  | "edit_recipe" | "approve_recipe" | "prepare_publication" | "publish_channel" | "acknowledge"
  | "manage_staff" | "grant_override" | "export" | "erase_staff" | "set_controls" | "manage_catalogue";

export const ROLE_ACTIONS: Record<Role, Action[]> = {
  receiving_operator: ["read", "receive"],
  specification_reviewer: ["read", "verify_spec", "review_impact", "reject_case", "edit_recipe", "manage_catalogue"],
  publication_approver: ["read", "approve_case", "reject_case", "end_substitution", "approve_recipe", "prepare_publication", "publish_channel", "export"],
  service_staff: ["read", "acknowledge"],
  administrator: ["read", "manage_staff", "grant_override", "export", "erase_staff", "set_controls", "manage_catalogue"]
};

export function getStaff(state: AppState, staffId: string): Staff | undefined {
  return state.staff.find((s) => s.id === staffId);
}

export function activeMemberships(state: AppState, staffId: string) {
  return state.memberships.filter((m) => m.staffId === staffId && m.endedAt === null);
}

/** Roles the person holds at a site (their own tenant only). Used for display and for checks. */
export function rolesAt(state: AppState, staffId: string, siteId: string): Role[] {
  const st = getStaff(state, staffId);
  if (!st || st.status !== "active") return [];
  const site = state.sites.find((s) => s.id === siteId);
  if (!site || site.tenantId !== st.tenantId) return [];
  return activeMemberships(state, staffId)
    .filter((m) => m.tenantId === site.tenantId && (m.siteId === "*" || m.siteId === siteId))
    .map((m) => m.role);
}

/**
 * Server-side style authorisation, enforced in core: the actor must be an ACTIVE member of the
 * resource's tenant, hold a role granting the action, and the role must cover the site.
 * siteId null = tenant-wide action, which needs a tenant-wide ("*") membership.
 */
export function authorize(state: AppState, actorId: string, action: Action, tenantId: string, siteId: string | null): Staff {
  const st = getStaff(state, actorId);
  if (!st || st.status !== "active" || st.tenantId !== tenantId) throw forbidden();
  const ok = activeMemberships(state, actorId).some(
    (m) =>
      m.tenantId === tenantId &&
      ROLE_ACTIONS[m.role].includes(action) &&
      (m.siteId === "*" || (siteId !== null && m.siteId === siteId))
  );
  if (!ok) throw forbidden();
  return st;
}

export function canAct(state: AppState, actorId: string, action: Action, siteId: string): boolean {
  const site = state.sites.find((s) => s.id === siteId);
  if (!site) return false;
  try {
    authorize(state, actorId, action, site.tenantId, siteId);
    return true;
  } catch {
    return false;
  }
}
