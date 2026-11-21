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
