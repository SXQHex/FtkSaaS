export interface MemberDraft {
  productVersionId: string;
  startDate: string;
  endDate: string;
  quantity: string;
  netMinor: string;
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
  netMinor: "",
  direction: "increase",
  disciplineId: "",
  reason: "",
  collectAfterSale: false,
  reservations: {},
});
