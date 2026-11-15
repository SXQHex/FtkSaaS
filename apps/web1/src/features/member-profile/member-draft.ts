export interface MemberDraft {
  productVersionId: string;
  startDate: string;
  endDate: string;
  quantity: string;
  direction: "increase" | "decrease";
  disciplineId: string;
  reason: string;
  collectAfterSale: boolean;
  reservations: Record<string, "keep" | "cancel">;
}
export const emptyMemberDraft = (): MemberDraft => ({
  productVersionId: "",
  startDate: "",
  endDate: "",
  quantity: "",
  direction: "increase",
  disciplineId: "",
  reason: "",
  collectAfterSale: false,
  reservations: {},
});
