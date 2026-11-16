export interface EventCollectionDraft {
  choice: "" | "now" | "later";
  method: "" | "cash" | "bank_transfer";
  amount: string;
  occurredAt: string;
  reference: string;
  note: string;
}
export const emptyEventCollection: EventCollectionDraft = {
  choice: "",
  method: "",
  amount: "",
  occurredAt: "",
  reference: "",
  note: "",
};
