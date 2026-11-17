import type { HelpGroup } from "./help-view";
export function filterHelpGroups(groups: HelpGroup[], query: string) {
  const normalize = (value: string) => value.normalize("NFC").toLocaleLowerCase("tr-TR").trim();
  const wanted = normalize(query);
  if (!wanted) return groups;
  return groups
    .map((group) => ({
      ...group,
      questions: group.questions.filter((row) =>
        normalize(`${row.question} ${row.answer}`).includes(wanted),
      ),
    }))
    .filter((group) => group.questions.length > 0);
}
