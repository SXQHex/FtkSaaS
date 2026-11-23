import type { ProductView } from "@ftksaas/api-contracts";
import { useMemberCommand } from "../member-profile/use-member-command";
import {
  writeProduct,
  readProductReceipt,
  readProductResult,
  type readProductHistory,
} from "./products";

export type ProductReadback = (
  result: ProductView | undefined,
  historyPage: Awaited<ReturnType<typeof readProductHistory>> | undefined,
  assertCurrent: () => void,
) => Promise<void>;

export function useProductCommand({
  onRefresh,
  onAccessLost,
}: {
  onRefresh: ProductReadback;
  onAccessLost: (error: unknown) => boolean;
}) {
  return useMemberCommand({
    write: writeProduct,
    readReceipt: readProductReceipt,
    readResult: async (intent, id) => {
      let historyPage: Awaited<ReturnType<typeof readProductHistory>> | undefined;
      const product = await readProductResult(intent, id, (page) => {
        historyPage = page;
      });
      return { product, historyPage };
    },
    onRefresh: ({ product, historyPage }, assertCurrent) =>
      onRefresh(product, historyPage, assertCurrent),
    onAccessLost,
  });
}
