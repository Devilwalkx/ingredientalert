import * as Application from "expo-application";
import Constants from "expo-constants";

export interface BuildInfo { appId: string; version: string; versionCode: string; commit: string; builtAt: string; channel: string }
/** Identity of the running build, so a tester can tell which build they are looking at. Shown in Settings > About this build. */
export function buildInfo(): BuildInfo {
  const extra = (Constants.expoConfig?.extra ?? {}) as { commit?: string; builtAt?: string; channel?: string };
  return {
    appId: Application.applicationId ?? "app.devilwalkx.ingredientalert",
    version: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "0.2.0",
    versionCode: Application.nativeBuildVersion ?? "dev",
    commit: extra.commit ?? "local",
    builtAt: extra.builtAt || "not recorded",
    channel: extra.channel ?? "development"
  };
}
