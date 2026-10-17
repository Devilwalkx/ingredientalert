export interface BuildInfo { appId: string; version: string; versionCode: string; commit: string; builtAt: string; channel: string }
/** Browser build: identity comes from the page, there is no native build. */
export function buildInfo(): BuildInfo {
  return { appId: "app.devilwalkx.ingredientalert", version: "0.2.0", versionCode: "web", commit: "web build", builtAt: "not recorded", channel: "browser" };
}
