export const browserProfiles = {
  chromium: { device: "Desktop Chrome", engine: "chromium", shards: 2 },
  "mobile-chromium": { device: "Pixel 7", engine: "chromium", shards: 2 },
  "mobile-webkit": { device: "iPhone 15", engine: "webkit", shards: 4 },
  webkit: {
    device: "Desktop Safari",
    engine: "webkit",
    shards: 4,
    // 13.6-inch MacBook Air Retina screen in CSS pixels at DPR 2.
    screen: { width: 1280, height: 832 },
  },
};

export const browserMatrix = Object.entries(browserProfiles).flatMap(
  ([profile, { engine, shards }]) =>
    Array.from({ length: shards }, (_, index) => ({ profile, engine, shard: index + 1 })),
);
