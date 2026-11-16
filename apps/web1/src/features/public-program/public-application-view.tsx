import { useState, type FormEventHandler, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardFooter } from "../../components/ui/card";
import { Field, FieldGroup, FieldLabel, FieldDescription } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Button } from "../../components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";

export function PublicApplicationView({
  consent,
  interests = [],
  onSubmit,
  botWidget,
  notice,
}: {
  consent?: string;
  interests?: { id: string; name: string }[];
  onSubmit?: FormEventHandler<HTMLFormElement>;
  botWidget?: ReactNode;
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const unavailable = !onSubmit || !consent || !botWidget;
  return (
    <>
      <div>
        <h1 id="public-apply-title" className="text-3xl font-semibold">
          {t(($) => $.publicApplication.title)}
        </h1>
        <p className="mt-1 text-muted-foreground">{t(($) => $.publicApplication.description)}</p>
      </div>
      {unavailable && (
        <Alert>
          <AlertTitle>{t(($) => $.publicApplication.unavailable)}</AlertTitle>
          <AlertDescription>{t(($) => $.publicApplication.unavailableHint)}</AlertDescription>
        </Alert>
      )}
      {notice}
      <form
        method="post"
        aria-labelledby="public-apply-title"
        onSubmit={(event) => {
          event.preventDefault();
          if (!unavailable) onSubmit?.(event);
        }}
      >
        <Card>
          <CardContent>
            <FieldGroup className="grid grid-cols-1 sm:grid-cols-2">
              <Field className="sm:col-span-2" data-disabled={unavailable}>
                <FieldLabel htmlFor="public-name">{t(($) => $.publicApplication.name)}</FieldLabel>
                <Input
                  id="public-name"
                  name="display_name"
                  autoComplete="name"
                  required
                  disabled={unavailable}
                />
              </Field>
              <Field data-disabled={unavailable}>
                <FieldLabel htmlFor="public-email">
                  {t(($) => $.publicApplication.email)}
                </FieldLabel>
                <Input
                  id="public-email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-describedby="public-contact-hint"
                  disabled={unavailable}
                />
              </Field>
              <Field data-disabled={unavailable}>
                <FieldLabel htmlFor="public-phone">
                  {t(($) => $.publicApplication.phone)}
                </FieldLabel>
                <Input
                  id="public-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  aria-describedby="public-contact-hint"
                  disabled={unavailable}
                />
              </Field>
              <FieldDescription id="public-contact-hint" className="sm:col-span-2">
                {t(($) => $.publicApplication.contactHint)}
              </FieldDescription>
              <Field className="sm:col-span-2" data-disabled={unavailable}>
                <FieldLabel htmlFor="public-interest">
                  {t(($) => $.publicApplication.interest)}
                </FieldLabel>
                <NativeSelect
                  id="public-interest"
                  name="interest"
                  className="w-full"
                  defaultValue=""
                  disabled={unavailable}
                >
                  <NativeSelectOption value="">
                    {t(($) => $.publicApplication.unsure)}
                  </NativeSelectOption>
                  {interests.map((interest) => (
                    <NativeSelectOption key={interest.id} value={interest.id}>
                      {interest.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
              <Field className="sm:col-span-2" data-disabled={unavailable}>
                <FieldLabel htmlFor="public-message">
                  {t(($) => $.publicApplication.message)}
                </FieldLabel>
                <Textarea
                  id="public-message"
                  name="message"
                  rows={3}
                  maxLength={500}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t(($) => $.publicApplication.messagePlaceholder)}
                  aria-describedby="public-message-count"
                  disabled={unavailable}
                />
                <FieldDescription id="public-message-count" className="tabular-nums">
                  {t(($) => $.publicApplication.messageCount, { length: message.length })}
                </FieldDescription>
              </Field>
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="public-website">{t(($) => $.publicApplication.website)}</label>
                <Input
                  id="public-website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  disabled={unavailable}
                />
              </div>
              <Field orientation="horizontal" className="sm:col-span-2" data-disabled={unavailable}>
                <Checkbox
                  id="public-consent"
                  name="consent"
                  isDisabled={unavailable}
                  isRequired
                  aria-describedby="public-consent-hint"
                />
                <div className="flex min-w-0 flex-col gap-1">
                  <FieldLabel htmlFor="public-consent">
                    {consent ?? t(($) => $.publicApplication.consentUnavailable)}
                  </FieldLabel>
                  <FieldDescription id="public-consent-hint">
                    {t(($) => $.publicApplication.consentHint)}
                  </FieldDescription>
                </div>
              </Field>
              {botWidget && <div className="min-w-0 sm:col-span-2">{botWidget}</div>}
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-wrap justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">
              {t(($) => $.publicApplication.submitHint)}
            </p>
            <Button type="submit" isDisabled={unavailable}>
              {t(($) => $.publicApplication.submit)}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
