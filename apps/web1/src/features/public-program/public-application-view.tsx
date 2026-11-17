import type { DiscoveredPublicForm } from "./public-discovery";
import { useState, type FormEventHandler, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Card, CardContent, CardFooter } from "../../components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Checkbox } from "../../components/ui/checkbox";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Button } from "../../components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "../../components/ui/alert";

export function PublicApplicationView({
  form,
  locked = false,
  interests = [],
  onSubmit,
  botWidget,
  notice,
}: {
  form?: DiscoveredPublicForm;
  locked?: boolean;
  interests?: { id: string; name: string }[];
  onSubmit?: FormEventHandler<HTMLFormElement>;
  botWidget?: ReactNode;
  notice?: ReactNode;
}) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const unavailable = !onSubmit || !form || !botWidget;
  const disabled = unavailable || locked;
  const required = new Set(form?.required_fields);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
          if (!disabled) onSubmit?.(event);
        }}
        aria-busy={locked}
        onInvalid={(event) => {
          const input = event.target;
          if (
            input instanceof HTMLInputElement ||
            input instanceof HTMLTextAreaElement ||
            input instanceof HTMLSelectElement
          ) {
            input.setAttribute("aria-invalid", "true");
            const hint =
              input.id === "public-email" || input.id === "public-phone"
                ? "public-contact-hint "
                : input.id === "public-message"
                  ? "public-message-count "
                  : "";
            input.setAttribute("aria-describedby", `${hint}${input.id}-error`);
            setErrors((old) => ({ ...old, [input.id]: input.validationMessage }));
          }
        }}
        onInput={(event) => {
          const input = event.target;
          if (
            input instanceof HTMLInputElement ||
            input instanceof HTMLTextAreaElement ||
            input instanceof HTMLSelectElement
          ) {
            input.setAttribute("aria-invalid", "false");
            const hint =
              input.id === "public-email" || input.id === "public-phone"
                ? "public-contact-hint"
                : input.id === "public-message"
                  ? "public-message-count"
                  : "";
            if (hint) input.setAttribute("aria-describedby", hint);
            else input.removeAttribute("aria-describedby");
            setErrors((old) => ({ ...old, [input.id]: "" }));
          }
        }}
      >
        <Card>
          <CardContent>
            <FieldGroup className="grid grid-cols-1 sm:grid-cols-2">
              <Field className="sm:col-span-2" data-disabled={disabled}>
                <FieldLabel htmlFor="public-name">{t(($) => $.publicApplication.name)}</FieldLabel>
                <Input
                  id="public-name"
                  name="display_name"
                  autoComplete="name"
                  maxLength={200}
                  required
                  disabled={disabled}
                />
              </Field>
              <Field data-disabled={disabled}>
                <FieldLabel htmlFor="public-email">
                  {t(($) => $.publicApplication.email)}
                </FieldLabel>
                <Input
                  id="public-email"
                  name="email"
                  type="email"
                  maxLength={320}
                  required={form?.contact_requirement === "email"}
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-describedby="public-contact-hint"
                  disabled={disabled}
                />
              </Field>
              <Field data-disabled={disabled}>
                <FieldLabel htmlFor="public-phone">
                  {t(($) => $.publicApplication.phone)}
                </FieldLabel>
                <Input
                  id="public-phone"
                  name="phone"
                  type="tel"
                  minLength={7}
                  maxLength={40}
                  required={form?.contact_requirement === "phone"}
                  inputMode="tel"
                  autoComplete="tel"
                  aria-describedby="public-contact-hint"
                  disabled={disabled}
                />
              </Field>
              <FieldDescription id="public-contact-hint" className="sm:col-span-2">
                {form?.contact_requirement === "phone"
                  ? t(($) => $.publicApplication.phoneRequired)
                  : form?.contact_requirement === "email"
                    ? t(($) => $.publicApplication.emailRequired)
                    : t(($) => $.publicApplication.contactHint)}
              </FieldDescription>
              <Field className="sm:col-span-2" data-disabled={disabled}>
                <FieldLabel htmlFor="public-interest">
                  {t(($) => $.publicApplication.interest)}
                </FieldLabel>
                {interests.length ? (
                  <NativeSelect
                    required={required.has("interest")}
                    id="public-interest"
                    name="interest"
                    className="w-full"
                    defaultValue=""
                    disabled={disabled}
                  >
                    <NativeSelectOption value="">
                      {t(($) => $.publicApplication.unsure)}
                    </NativeSelectOption>
                    {interests.map((interest) => (
                      <NativeSelectOption key={interest.id} value={interest.name}>
                        {interest.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                ) : (
                  <Input
                    id="public-interest"
                    name="interest"
                    maxLength={1000}
                    required={required.has("interest")}
                    disabled={disabled}
                  />
                )}
              </Field>
              <Field className="sm:col-span-2" data-disabled={disabled}>
                <FieldLabel htmlFor="public-message">
                  {t(($) => $.publicApplication.message)}
                </FieldLabel>
                <Textarea
                  id="public-message"
                  name="message"
                  rows={3}
                  required={required.has("message")}
                  maxLength={500}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder={t(($) => $.publicApplication.messagePlaceholder)}
                  aria-describedby="public-message-count"
                  disabled={disabled}
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
                  disabled={disabled}
                />
              </div>
              {(["partner_name", "mode", "level"] as const)
                .filter((name) => required.has(name))
                .map((name) => (
                  <Field key={name} className="sm:col-span-2" data-disabled={disabled}>
                    <FieldLabel htmlFor={`public-${name}`}>
                      {t(($) => $.publicApplication[name])}
                    </FieldLabel>
                    <Input
                      id={`public-${name}`}
                      name={name}
                      required
                      maxLength={200}
                      disabled={disabled}
                    />
                  </Field>
                ))}
              {!form && (
                <Field orientation="horizontal" className="sm:col-span-2" data-disabled>
                  <Checkbox
                    id="public-consent"
                    name="consent"
                    isDisabled
                    aria-label={t(($) => $.publicApplication.consentUnavailable)}
                  />
                  <FieldLabel htmlFor="public-consent">
                    {t(($) => $.publicApplication.consentUnavailable)}
                  </FieldLabel>
                </Field>
              )}
              {form?.consents.map((consent, index) => (
                <Field
                  key={`${consent.purpose}:${consent.version}`}
                  className="sm:col-span-2"
                  data-disabled={disabled}
                >
                  <div lang={consent.content.language} className="min-w-0 space-y-2 wrap-anywhere">
                    <h2 className="text-sm font-semibold">{consent.content.name}</h2>
                    <p
                      role="region"
                      aria-label={consent.content.name}
                      id={`public-consent-text-${index}`}
                      className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border p-3 text-sm"
                      tabIndex={0}
                    >
                      {consent.content.text}
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`public-consent-${index}`}
                      name={`consent-${index}`}
                      isDisabled={disabled}
                      isRequired={consent.required}
                      aria-label={consent.content.name}
                      aria-describedby={`public-consent-text-${index}`}
                    />
                    <FieldLabel
                      htmlFor={`public-consent-${index}`}
                      className="min-w-0 wrap-anywhere"
                    >
                      {consent.content.name}
                      {consent.required
                        ? t(($) => $.publicApplication.required)
                        : t(($) => $.publicApplication.optional)}
                    </FieldLabel>
                  </div>
                  <FieldDescription>{t(($) => $.publicApplication.consentHint)}</FieldDescription>
                </Field>
              ))}
              {Object.entries(errors)
                .filter(([, error]) => error)
                .map(([id, error]) => (
                  <FieldError key={id} id={`${id}-error`} className="sm:col-span-2">
                    {error}
                  </FieldError>
                ))}
              {botWidget && <div className="min-w-0 sm:col-span-2">{botWidget}</div>}
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex-wrap justify-between gap-3">
            <p className="min-w-0 text-sm text-muted-foreground">
              {t(($) => $.publicApplication.submitHint)}
            </p>
            <Button type="submit" isDisabled={disabled}>
              {t(($) => $.publicApplication.submit)}
            </Button>
          </CardFooter>
        </Card>
      </form>
    </>
  );
}
