import { type FormEventHandler, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription, AlertTitle } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { Card, CardContent, CardFooter } from "@ftksaas/ui/components/card";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import type { PublicProgramRow } from "./public-calendar-view";

export function PublicEventApplicationView({
  event,
  locked,
  onSubmit,
  botWidget,
  notice,
}: {
  event: PublicProgramRow;
  locked: boolean;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  botWidget?: ReactNode;
  notice: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <>
      <div>
        <h1 id="public-event-title" className="text-3xl font-semibold wrap-anywhere">
          {event.title}
        </h1>
        <p className="mt-1 text-muted-foreground wrap-anywhere">
          {[event.dayLabel, `${event.start} – ${event.end}`, event.venue, event.fee]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {event.conditions && <p className="mt-1 wrap-anywhere">{event.conditions}</p>}
      </div>
      {!onSubmit && (
        <Alert>
          <AlertTitle>{t(($) => $.publicApplication.unavailable)}</AlertTitle>
          <AlertDescription>{t(($) => $.publicApplication.unavailableHint)}</AlertDescription>
        </Alert>
      )}
      {notice}
      <form
        method="post"
        aria-labelledby="public-event-title"
        onSubmit={(submission) => {
          submission.preventDefault();
          if (!locked) onSubmit?.(submission);
        }}
      >
        <Card>
          <CardContent className="space-y-4">
            <p>{t(($) => $.publicApplication.eventDescription)}</p>
            <Field>
              <FieldLabel htmlFor="public-event-email">
                {t(($) => $.publicApplication.eventEmail)}
              </FieldLabel>
              <Input
                id="public-event-email"
                name="email"
                type="email"
                required
                maxLength={320}
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={locked || !onSubmit}
              />
            </Field>
            {botWidget}
          </CardContent>
          <CardFooter>
            <Button type="submit" isDisabled={locked || !onSubmit}>
              {t(($) => $.publicApplication.submit)}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
