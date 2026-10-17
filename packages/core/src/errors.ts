export type ErrorCode =
  | "forbidden" | "not_found" | "validation" | "version_conflict" | "stale_basis"
  | "publish_blocked" | "cycle" | "separation_of_duties" | "replayed_mismatch" | "wrong_revision" | "superseded";

export class DomainError extends Error {
  constructor(public readonly code: ErrorCode, message: string, public readonly detail?: unknown) {
    super(message);
    this.name = "DomainError";
  }
}

/** Deliberately the same message for "does not exist" and "not yours" so tenants cannot probe each other. */
export const forbidden = () => new DomainError("forbidden", "Not found or you are not permitted to do this.");
export const notFound = (what: string) => new DomainError("not_found", `${what} not found.`);
export const invalid = (msg: string, detail?: unknown) => new DomainError("validation", msg, detail);
