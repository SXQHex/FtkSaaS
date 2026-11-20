import type { Duty, RefundMethod } from "@ftksaas/api-contracts";

export interface EventDraft {
  name: string;
  kind: "workshop" | "practice";
  disciplineIds: string[];
  starts: string;
  ends: string;
  startOffset: string;
  endOffset: string;
  timezone: string;
  venueKind: "internal" | "external";
  roomId: string;
  venueName: string;
  address: string;
  nominal: string;
  maximum: string;
  unlimited: boolean;
  fee: string;
  currency: string;
  fullPayment: boolean;
  productIds: string[];
  cutoff: string;
  before: "" | "release" | "consume";
  after: "" | "release" | "consume";
  noShow: "" | "release" | "consume";
  refund: "" | RefundMethod;
  usedUnit: string;
  duties: { personId: string; duty: Duty; fee: string; currency: string }[];
  reviewed: boolean;
}
export const emptyEventDraft: EventDraft = {
  name: "",
  kind: "workshop",
  disciplineIds: [],
  starts: "",
  ends: "",
  startOffset: "",
  endOffset: "",
  timezone: "",
  venueKind: "internal",
  roomId: "",
  venueName: "",
  address: "",
  nominal: "",
  maximum: "",
  unlimited: false,
  fee: "",
  currency: "",
  fullPayment: false,
  productIds: [],
  cutoff: "",
  before: "",
  after: "",
  noShow: "",
  refund: "",
  usedUnit: "",
  duties: [],
  reviewed: false,
};
