import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";

import type { PlatformActivityEntry } from "./platform-activity-context";

const verifiedTime = new Intl.DateTimeFormat("tr-TR", {
  timeZone: "Europe/Istanbul",
  dateStyle: "medium",
  timeStyle: "short",
});

export function PlatformActivityLog({
  actor,
  entries,
}: {
  actor: string;
  entries: PlatformActivityEntry[];
}) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle>
          <h2 id={titleId}>{t(($) => $.platform.activity.title)}</h2>
        </CardTitle>
        <CardDescription>{t(($) => $.platform.activity.description, { actor })}</CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length ? (
          <ol role="list" className="divide-y">
            {entries.map((entry) => (
              <li
                key={entry.key}
                className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2 text-sm"
              >
                <div className="min-w-0 wrap-anywhere">
                  <span className="font-medium">
                    {t(($) => $.platform.activity.actions[entry.kind])}
                  </span>
                  {entry.subject && (
                    <span className="text-muted-foreground"> · {entry.subject}</span>
                  )}
                </div>
                <time dateTime={entry.verifiedAt} className="text-muted-foreground tabular-nums">
                  {verifiedTime.format(new Date(entry.verifiedAt))}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{t(($) => $.platform.activity.empty)}</p>
        )}
      </CardContent>
    </Card>
  );
}
