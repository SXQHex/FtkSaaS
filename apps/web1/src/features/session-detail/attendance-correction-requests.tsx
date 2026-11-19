import { useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Field, FieldError, FieldLabel } from "../../components/ui/field";
import { Textarea } from "../../components/ui/textarea";
import type { AttendanceCorrectionRequest } from "../../lib/api-contracts/generated";

export function AttendanceCorrectionRequests({
  requests,
  revision,
  instructors,
  locked,
  onSubmit,
  onReview,
}: {
  requests: AttendanceCorrectionRequest[];
  revision: number;
  instructors: { id: string; name: string }[];
  locked: boolean;
  onSubmit?: (reason: string) => void;
  onReview?: (row: AttendanceCorrectionRequest, decision: "accepted" | "declined") => void;
}) {
  const { t } = useTranslation();
  const headingId = useId(),
    reasonId = useId(),
    errorId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const [invalid, setInvalid] = useState(false);
  if (!requests.length && !onSubmit) return null;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 border-t pt-4">
      <h3 id={headingId} className="text-sm font-semibold">
        {t(($) => $.sessionDetail.correctionRequests)}
      </h3>
      {requests.length > 0 && (
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
              {onReview && row.state === "pending" && row.closure_revision === revision && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    isDisabled={locked}
                    onPress={() => onReview(row, "declined")}
                  >
                    {t(($) => $.sessionDetail.declineRequest)}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    isDisabled={locked}
                    onPress={() => onReview(row, "accepted")}
                  >
                    {t(($) => $.sessionDetail.acceptRequest)}
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {(onSubmit || onReview) && (
        <p className="text-sm text-muted-foreground">{t(($) => $.sessionDetail.requestEffect)}</p>
      )}
      {onSubmit && (
        <form
          aria-labelledby={headingId}
          className="flex flex-col items-start gap-3"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (locked) return;
            const reason = field.current?.value.trim();
            if (!reason || reason.length > 1000) {
              setInvalid(true);
              field.current?.focus();
              return;
            }
            onSubmit(reason);
          }}
        >
          <Field className="w-full">
            <FieldLabel htmlFor={reasonId}>
              {t(($) => $.sessionDetail.requiredRequestReason)}
            </FieldLabel>
            <Textarea
              ref={field}
              id={reasonId}
              required
              maxLength={1000}
              disabled={locked}
              aria-invalid={invalid}
              aria-describedby={invalid ? errorId : undefined}
              onChange={() => setInvalid(false)}
            />
            {invalid && (
              <FieldError id={errorId} role="alert">
                {t(($) => $.sessionDetail.missingRequestReason)}
              </FieldError>
            )}
          </Field>
          <Button type="submit" isDisabled={locked}>
            {t(($) => $.sessionDetail.submitCorrectionRequest)}
          </Button>
        </form>
      )}
    </section>
  );
}
