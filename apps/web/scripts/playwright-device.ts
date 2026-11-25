import { devices } from "@playwright/test";
import { browserProfiles } from "./browser-profiles.mjs";

export function activeBrowserProfile() {
  const project = process.env.FTK_BROWSER_PROJECT ?? "chromium";
  if (!Object.hasOwn(browserProfiles, project)) throw new Error("Unknown browser project");
  const profile = browserProfiles[project as keyof typeof browserProfiles];
  const base = devices[profile.device];
  if (base?.defaultBrowserType !== profile.engine)
    throw new Error("Browser profile engine mismatch");
  const device = "screen" in profile ? { ...base, screen: profile.screen } : base;
  return { project, engine: profile.engine, device };
}
