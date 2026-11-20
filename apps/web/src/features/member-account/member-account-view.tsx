import type { ReactNode } from "react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@ftksaas/ui/components/card";
import { Button, LinkButton } from "@ftksaas/ui/components/button";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@ftksaas/ui/components/item";
import { Switch } from "@ftksaas/ui/components/switch";
import { Input } from "@ftksaas/ui/components/input";
import { Field, FieldLabel } from "@ftksaas/ui/components/field";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import type { CalendarKind } from "./member-calendar";

export type PreferenceId =
  | "email"
  | "transactionalEmail"
  | "inApp"
  | "package"
  | "marketing"
  | "mandatory";
export interface AccountPreference {
  id: PreferenceId;
  selected?: boolean;
  disabled: boolean;
  onChange?: (selected: boolean) => void;
}
export function MemberAccountView({
  profile,
  deletion,
  documents,
  calendar,
  preferences,
  navigationDisabled = false,
}: {
  profile: ReactNode;
  deletion: ReactNode;
  documents?: ReactNode;
  calendar?: ReactNode;
  preferences?: ReactNode;
  navigationDisabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl leading-[1.25] font-semibold tracking-[-.02em]">
            {t(($) => $.memberAccount.title)}
          </h1>
          <p className="mt-1 text-muted-foreground">{t(($) => $.memberAccount.description)}</p>
        </div>
        <LinkButton isDisabled={navigationDisabled} href="/account" variant="outline" size="sm">
          {t(($) => $.memberAccount.security)}
        </LinkButton>
      </header>
      {profile}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t(($) => $.memberAccount.documentsTitle)}</h2>
          </CardTitle>
          <CardDescription>{t(($) => $.memberAccount.documentsDescription)}</CardDescription>
        </CardHeader>
        <CardContent>
          {documents ?? (
            <Alert>
              <AlertDescription>{t(($) => $.memberAccount.documentsUnavailable)}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      {deletion}
      <PersonalCalendarCard>{calendar}</PersonalCalendarCard>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t(($) => $.memberAccount.preferencesTitle)}</h2>
          </CardTitle>
          <CardDescription>{t(($) => $.memberAccount.preferencesDescription)}</CardDescription>
        </CardHeader>
        <CardContent>{preferences}</CardContent>
      </Card>
    </div>
  );
}
export function AccountPreferencesView({
  rows,
  notice,
}: {
  rows: AccountPreference[];
  notice?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId();
  return (
    <div className="flex flex-col gap-3">
      <ItemGroup>
        {rows.map((row) => (
          <Item key={row.id} role="listitem" size="xs">
            <ItemContent className="min-w-0 basis-40">
              <ItemTitle>
                <FieldLabel htmlFor={`${id}-${row.id}`}>
                  {t(($) => $.memberAccount[row.id])}
                </FieldLabel>
              </ItemTitle>
              <ItemDescription id={`${id}-${row.id}-hint`}>
                {t(($) => $.memberAccount[`${row.id}Hint`])}
                {row.selected === undefined && <> {t(($) => $.memberAccount.unavailable)}</>}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <Switch
                id={`${id}-${row.id}`}
                aria-describedby={`${id}-${row.id}-hint`}
                isSelected={row.selected === true}
                isDisabled={row.disabled || row.selected === undefined || !row.onChange}
                onChange={row.onChange}
              />
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
      {notice}
    </div>
  );
}
export function PersonalCalendarCard({
  children,
  kind = "lessons",
}: {
  children: ReactNode;
  kind?: CalendarKind;
}) {
  const { t } = useTranslation();
  const description = {
    lessons: t(($) => $.memberAccount.calendarDescription),
    duties: t(($) => $.memberAccount.instructorCalendarDescription),
    studio_program: t(($) => $.memberAccount.studioCalendarDescription),
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>
            {t(($) =>
              kind === "studio_program"
                ? $.memberAccount.studioCalendarTitle
                : $.memberAccount.calendarTitle,
            )}
          </h2>
        </CardTitle>
        <CardDescription>{description[kind]}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {children}
        <p className="text-sm text-muted-foreground">{t(($) => $.memberAccount.calendarPrivacy)}</p>
        <p className="text-sm text-muted-foreground">{t(($) => $.memberAccount.calendarPolling)}</p>
      </CardContent>
    </Card>
  );
}

export function AccountCalendarView({
  credential,
  actions,
  notice,
}: {
  credential?: string;
  actions?: ReactNode;
  notice?: ReactNode;
}) {
  const { t } = useTranslation(),
    id = useId();
  return (
    <div className="flex flex-col gap-3">
      {credential && (
        <Field>
          <FieldLabel htmlFor={id}>{t(($) => $.memberAccount.calendarLabel)}</FieldLabel>
          <Input id={id} value={credential} readOnly autoComplete="off" />
        </Field>
      )}
      {notice}
      <div className="flex flex-wrap gap-2">
        {actions ?? <Button isDisabled>{t(($) => $.memberAccount.calendarCreate)}</Button>}
      </div>
    </div>
  );
}
