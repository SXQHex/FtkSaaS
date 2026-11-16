export type LeadMode = "edit" | "stage" | "activity" | "offer" | "confirm" | "convert";
export interface LeadDraft {
  source: string;
  interest: string;
  assignedTo: string;
  stageKey: string;
  tagKeys: string[];
  lossReason: string;
  kind: "contact" | "followup" | "outcome";
  note: string;
  due: string;
  outcome: string;
  productVersionId: string;
  sessionId: string;
  offerId: string;
  reviewed: boolean;
}
export const emptyLeadDraft: LeadDraft = {
  source: "manual",
  interest: "",
  assignedTo: "",
  stageKey: "",
  tagKeys: [],
  lossReason: "",
  kind: "contact",
  note: "",
  due: "",
  outcome: "",
  productVersionId: "",
  sessionId: "",
  offerId: "",
  reviewed: false,
};
