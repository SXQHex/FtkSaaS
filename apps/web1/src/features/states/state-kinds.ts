export const stateKinds = [
  "loading",
  "empty",
  "noResults",
  "error",
  "offline",
  "conflict",
  "limit",
  "forbidden",
  "readOnly",
  "notFound",
  "expired",
  "received",
] as const;
export type StateKind = (typeof stateKinds)[number];
