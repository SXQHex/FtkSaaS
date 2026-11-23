import type { FinanceView } from "@ftksaas/api-contracts";
import {
  writeCollection,
  readCollectionReceipt,
  readCollectionResult,
  type CollectionIntent,
} from "./finance";
import {
  writeCorrection,
  readCorrectionReceipt,
  readCorrectionResult,
  type CorrectionIntent,
} from "./correction";
import {
  writeCreditRefund,
  readCreditRefundReceipt,
  readCreditRefundResult,
  type CreditRefundIntent,
} from "./credit-refund";
import { writeDebt, readDebtReceipt, readDebtResult, type DebtIntent } from "./debt-command";
export type FinanceIntent = CollectionIntent | CorrectionIntent | CreditRefundIntent | DebtIntent;
export function writeFinance(intent: FinanceIntent) {
  switch (intent.operation) {
    case "collection_record_v1":
      return writeCollection(intent);
    case "collection_correct_apply_v1":
      return writeCorrection(intent);
    case "student_credit_refund_v1":
      return writeCreditRefund(intent);
    case "student_credit_offset_v1":
    case "debt_adjust_v1":
      return writeDebt(intent);
  }
}
export function readFinanceReceipt(intent: FinanceIntent) {
  switch (intent.operation) {
    case "collection_record_v1":
      return readCollectionReceipt(intent);
    case "collection_correct_apply_v1":
      return readCorrectionReceipt(intent);
    case "student_credit_refund_v1":
      return readCreditRefundReceipt(intent);
    case "student_credit_offset_v1":
    case "debt_adjust_v1":
      return readDebtReceipt(intent);
  }
}
export async function readFinanceResult(intent: FinanceIntent, id?: string) {
  let firstPage: FinanceView | undefined;
  const remember = (page: FinanceView) => {
    firstPage = page;
  };
  switch (intent.operation) {
    case "collection_record_v1":
      await readCollectionResult(intent, id, remember);
      break;
    case "collection_correct_apply_v1":
      await readCorrectionResult(intent, id, remember);
      break;
    case "student_credit_refund_v1":
      await readCreditRefundResult(intent, id, remember);
      break;
    case "student_credit_offset_v1":
    case "debt_adjust_v1":
      await readDebtResult(intent, id, remember);
      break;
  }
  if (!firstPage) throw new Error("FINANCE_FIRST_PAGE_UNAVAILABLE");
  return firstPage;
}
