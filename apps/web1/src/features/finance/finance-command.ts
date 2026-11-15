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
export type FinanceIntent = CollectionIntent | CorrectionIntent;
export const writeFinance = (intent: FinanceIntent) =>
  intent.operation === "collection_record_v1" ? writeCollection(intent) : writeCorrection(intent);
export const readFinanceReceipt = (intent: FinanceIntent) =>
  intent.operation === "collection_record_v1"
    ? readCollectionReceipt(intent)
    : readCorrectionReceipt(intent);
export const readFinanceResult = (intent: FinanceIntent, id?: string) =>
  intent.operation === "collection_record_v1"
    ? readCollectionResult(intent, id)
    : readCorrectionResult(intent, id);
