import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { filterHelpGroups } from "./help";
import { HelpView, type HelpGroup } from "./help-view";
export function HelpContent() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const clearFeedback = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const lastFeedback = useRef("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(clearFeedback.current);
    };
  }, []);
  const content = t(($) => $.help.groups, { returnObjects: true });
  const groups: HelpGroup[] = Object.entries(content).map(([id, group]) => ({
    id,
    title: group.title,
    questions: Object.entries(group.questions).map(([id, row]) => ({ id, ...row })),
  }));
  const support = t(($) => $.help.contact, { returnObjects: true });
  async function copy() {
    let message: string;
    try {
      await navigator.clipboard.writeText(support.email);
      message = t(($) => $.help.copied);
    } catch {
      message = t(($) => $.help.copyFailed);
    }
    if (!mounted.current) return;
    clearTimeout(clearFeedback.current);
    // A repeated message must still be announced from the existing live region.
    if (message === lastFeedback.current) message += "\u00a0";
    lastFeedback.current = message;
    setFeedback(message);
    clearFeedback.current = setTimeout(() => setFeedback(""), 4_000);
  }
  return (
    <HelpView
      groups={filterHelpGroups(groups, query)}
      query={query}
      onQuery={setQuery}
      support={support}
      onCopy={() => {
        void copy();
      }}
      feedback={feedback}
      onStates={
        import.meta.env.DEV && import.meta.env.MODE === "development"
          ? () => window.location.assign("/login?__states_example=1")
          : undefined
      }
    />
  );
}
