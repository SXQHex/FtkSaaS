import { createContext, useContext } from "react";

type ActivityKind =
  | "created"
  | "suspended"
  | "resumed"
  | "paymentAccepted"
  | "paymentDeclined"
  | "graceExtended"
  | "operatorAdded"
  | "operatorRemoved"
  | "invoicePublished";

type VerifiedActivity = { kind: ActivityKind; key: string; subject?: string };
export type PlatformActivityEntry = VerifiedActivity & { verifiedAt: string };

export const PlatformActivityContext = createContext<{
  record: (activity: VerifiedActivity) => void;
  clear: () => void;
} | null>(null);

export function usePlatformActivity() {
  const activity = useContext(PlatformActivityContext);
  if (!activity) throw new Error("Platform activity requires the platform console");
  return activity;
}
