import type { FinanceView } from "@ftksaas/api-contracts";
import { useMemberCommand } from "../member-profile/use-member-command";
import { writeFinance, readFinanceReceipt, readFinanceResult } from "./finance-command";

export type FinanceReadback = (firstPage: FinanceView, assertCurrent: () => void) => Promise<void>;

export function useFinanceCommand({
  onRefresh,
  onAccessLost,
}: {
  onRefresh: FinanceReadback;
  onAccessLost: (error: unknown) => boolean;
}) {
  return useMemberCommand({
    write: writeFinance,
    readReceipt: readFinanceReceipt,
    readResult: readFinanceResult,
    onRefresh,
    onAccessLost,
  });
}
