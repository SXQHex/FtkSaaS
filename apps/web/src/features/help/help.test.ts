import { describe, expect, it } from "vitest";
import { filterHelpGroups } from "./help";
import type { HelpGroup } from "./help-view";
const groups: HelpGroup[] = [
  {
    id: "finance",
    title: "Finans",
    questions: [
      { id: "refund", question: "İade nasıl yapılır?", answer: "İlgili satışın önizlemesini aç." },
      {
        id: "collection",
        question: "Tahsilat nasıl kaydedilir?",
        answer: "Tutarı ve işlem referansını kontrol et.",
      },
    ],
  },
  {
    id: "account",
    title: "Hesap",
    questions: [
      {
        id: "password",
        question: "Parolamı nasıl değiştiririm?",
        answer: "Güvenlik bölümünden değiştir.",
      },
    ],
  },
];
describe("help search", () => {
  it("matches dotted Turkish capital I in a question", () => {
    expect(filterHelpGroups(groups, " İADE ").map((g) => g.questions.map((q) => q.id))).toEqual([
      ["refund"],
    ]);
  });
  it("normalizes decomposed Turkish dotted letters", () => {
    expect(filterHelpGroups(groups, "I\u0307ade")[0]?.questions[0]?.id).toBe("refund");
  });
  it("finds answer-only text without dropping its group", () => {
    expect(filterHelpGroups(groups, "REFERANSINI")[0]?.questions.map((q) => q.id)).toEqual([
      "collection",
    ]);
  });
  it("does not fabricate an empty category or mutate the original catalogue", () => {
    const original = structuredClone(groups);
    expect(filterHelpGroups(groups, "bulunmayan arama")).toEqual([]);
    expect(groups).toEqual(original);
  });
  it("restores every question after a cleared or whitespace-only query", () => {
    expect(filterHelpGroups(groups, "\t \n")).toBe(groups);
    expect(filterHelpGroups(groups, "").flatMap((g) => g.questions)).toHaveLength(3);
  });
});
