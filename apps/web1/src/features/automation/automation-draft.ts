export interface AutomationDraft {
  name: string;
  segmentId: string;
  trigger: string;
  action: "" | "email" | "task" | "inbox";
  template: string;
  assignee: string;
  text: string;
  enabled: boolean;
  offsetDays: string;
  recipients: string[];
}
export const emptyAutomationDraft: AutomationDraft = {
  name: "",
  segmentId: "",
  trigger: "",
  action: "",
  template: "",
  assignee: "",
  text: "",
  enabled: false,
  offsetDays: "",
  recipients: [],
};
export type SegmentConditionKind = "remaining" | "ending" | "debt" | "noNext" | "kind";
export interface SegmentDraft {
  name: string;
  conditions: { id: string; kind: SegmentConditionKind; value: string }[];
}
export const emptySegmentDraft: SegmentDraft = { name: "", conditions: [] };
export interface AutomationChoice {
  id: string;
  name: string;
  disabled?: boolean;
}
