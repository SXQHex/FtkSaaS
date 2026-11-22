export const browserProfiles = {
  chromium: { device: "Desktop Chrome", engine: "chromium" },
  "mobile-chromium": { device: "Pixel 7", engine: "chromium" },
  "mobile-webkit": { device: "iPhone 14", engine: "webkit" },
  webkit: { device: "Desktop Safari", engine: "webkit" },
};

export const browserShards = [1, 2, 3];

export const browserMatrix = Object.entries(browserProfiles).flatMap(([profile, { engine }]) =>
  browserShards.map((shard) => ({ profile, engine, shard })),
);

// Temporary refactoring acceptance: run the full selected Playwright inventory
// on Desktop Chromium only. Restore browserMatrix after refactoring is complete.
// Do not delete the other profiles or their tests.
export const refactoringBrowserShards = Array.from({ length: 12 }, (_, index) => index + 1);

export const refactoringBrowserMatrix = refactoringBrowserShards.map((shard) => ({
  profile: "chromium",
  engine: "chromium",
  shard,
}));
