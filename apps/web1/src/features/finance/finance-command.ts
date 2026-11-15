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
export type FinanceIntent = CollectionIntent | CorrectionIntent | CreditRefundIntent;
export function writeFinance(intent: FinanceIntent) {
  switch (intent.operation) {
    case "collection_record_v1":
      return writeCollection(intent);
    case "collection_correct_apply_v1":
      return writeCorrection(intent);
    case "student_credit_refund_v1":
      return writeCreditRefund(intent);
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
  }
}
export function readFinanceResult(intent: FinanceIntent, id?: string) {
  switch (intent.operation) {
    case "collection_record_v1":
      return readCollectionResult(intent, id);
    case "collection_correct_apply_v1":
      return readCorrectionResult(intent, id);
    case "student_credit_refund_v1":
      return readCreditRefundResult(intent, id);
  }
}
