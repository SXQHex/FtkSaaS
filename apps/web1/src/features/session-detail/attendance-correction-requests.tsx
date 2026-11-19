import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { AttendanceCorrectionRequest } from "../../lib/api-contracts/generated";

export function AttendanceCorrectionRequests({
  requests,
  revision,
  instructors,
}: {
  requests: AttendanceCorrectionRequest[];
  revision: number;
  instructors: { id: string; name: string }[];
}) {
  const { t } = useTranslation();
  const headingId = useId();
  if (!requests.length) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 border-t pt-4">
      <h3 id={headingId} className="text-sm font-semibold">
        {t(($) => $.sessionDetail.correctionRequests)}
      </h3>
      <ul className="flex list-disc flex-col gap-3 ps-5">
        {requests.map((row) => (
          <li key={row.id} className="space-y-2 text-sm">
            <p className="font-medium">
              {instructors.find((item) => item.id === row.instructor_id)?.name ??
                t(($) => $.sessionDetail.requestInstructor)}
              {" · "}
              {t(($) => $.sessionDetail.requestStates[row.state])}
            </p>
            <p className="wrap-anywhere whitespace-pre-wrap">{row.reason}</p>
            {row.closure_revision !== revision && (
              <p className="text-muted-foreground">{t(($) => $.sessionDetail.previousClosure)}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
