import { useId, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Building2Icon,
  ShieldIcon,
  BellIcon,
  MailIcon,
  MonitorIcon,
  UsersIcon,
  PackageIcon,
  ClockIcon,
  PlusIcon,
  UploadIcon,
} from "lucide-react";
import { BuildingIcon, CalendarIcon, DashboardIcon } from "../../components/studiom-icons";
import { cn } from "@ftksaas/ui/lib/utils";
import { useIsMobile } from "@ftksaas/ui/hooks/use-mobile";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@ftksaas/ui/components/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction,
} from "@ftksaas/ui/components/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldSet,
  FieldLegend,
  FieldContent,
} from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import { Switch } from "@ftksaas/ui/components/switch";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import { Progress } from "@ftksaas/ui/components/progress";
import { BlobAvatar } from "../account/profile-photo-row";
import { Avatar, AvatarImage, AvatarFallback } from "@ftksaas/ui/components/avatar";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@ftksaas/ui/components/table";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
import {
  settingsLayout,
  type SettingsSection,
  type SettingsCardKey,
  type SettingsFieldKey,
} from "./settings-layout";

const icons = {
  genel: BuildingIcon,
  kurallar: CalendarIcon,
  politika: ShieldIcon,
  salonlar: DashboardIcon,
  bildirim: BellIcon,
  sablon: MailIcon,
  yayin: MonitorIcon,
  ekip: UsersIcon,
  plan: PackageIcon,
  organizasyon: BuildingIcon,
  gecmis: ClockIcon,
};
type ColumnKey =
  | "name"
  | "policy"
  | "version"
  | "summary"
  | "action"
  | "room"
  | "capacity"
  | "futureSessions"
  | "futureOperations"
  | "active"
  | "template"
  | "kind"
  | "automation"
  | "state"
  | "person"
  | "roles"
  | "when"
  | "section"
  | "change"
  | "invoice"
  | "total"
  | "organizationState"
  | "centerState";
export interface SettingsTableData {
  after?: ReactNode;
  columns: ColumnKey[];
  rows: { id: string; cells: ReactNode[] }[];
}
export interface SettingsFieldValue {
  value: string | boolean | null;
  writable: boolean;
  inherited?: boolean;
  options?: { id: string; label: string }[];
  description?: string;
}
export interface SettingsViewData {
  fields?: Partial<Record<SettingsFieldKey, SettingsFieldValue>>;
  forms?: Partial<
    Record<
      SettingsCardKey,
      { dirty: boolean; pending: boolean; read: boolean; writable: boolean; notice?: string }
    >
  >;
  tables?: Partial<Record<SettingsSection | "disciplines", SettingsTableData>>;
  brand?: {
    name: string;
    logo?: { src?: string; blob?: Blob; alt: string } | null;
    logoError?: string;
    colors: {
      key: "primaryColor" | "secondaryColor" | "accentColor";
      value: string | null;
      writable: boolean;
    }[];
  };
  metrics?: {
    id: string;
    label: string;
    value: number;
    maximum: number | null;
    unlimited: boolean;
    limitDescription?: string;
  }[];
  plan?: {
    name: string;
    nextInvoice: string | null;
    paymentMethod: string | null;
    paymentDescription: string | null;
    subscriptionState: string | null;
    pendingDescription?: string | null;
    renewalActionLabel?: string;
  };
  reminderPreview?: { id: string; lesson: string; delivery: string | null }[];
  preparationManagement?: ReactNode;
  billingTax?: ReactNode;
  invoiceHistory?: ReactNode;
}
export type SettingsAction =
  | { kind: "reset"; card: SettingsCardKey }
  | {
      kind:
        | "publicSettings"
        | "invite"
        | "discipline"
        | "room"
        | "changePlan"
        | "changePeriod"
        | "cancelChange"
        | "upgradePlan"
        | "payment"
        | "cancelSubscription"
        | "copyLink"
        | "preview"
        | "removeLogo"
        | "renameOrganization"
        | "renameCenter";
    };
export interface SettingsViewProps {
  data: SettingsViewData;
  scope?: {
    selected: "organization" | "center";
    organizationLabel: string;
    centerLabel: string;
    organizationAvailable: boolean;
    centerAvailable: boolean;
  };
  onScope?: (scope: "organization" | "center") => void;
  section?: SettingsSection;
  locked?: boolean;
  onSection?: (section: SettingsSection) => void;
  onField?: (key: SettingsFieldKey, value: string | boolean) => void;
  onSave?: (card: SettingsCardKey) => void;
  onDiscard?: (card: SettingsCardKey) => void;
  onAction?: (action: SettingsAction) => void;
  availableActions?: readonly SettingsAction["kind"][];
  onColor?: (key: "primaryColor" | "secondaryColor" | "accentColor", value: string) => void;
  onLogo?: (file: File) => void;
  logoAccept?: string;
  resetCards?: readonly SettingsCardKey[];
  team?: ReactNode;
  organizationPanel?: ReactNode;
}
function SettingsTable({ data, label }: { data?: SettingsTableData; label: string }) {
  const { t } = useTranslation();
  return (
    <>
      <Table aria-label={label} className={data?.rows.length ? "min-w-[30rem]" : undefined}>
        <TableHeader>
          {(data?.columns ?? (["name", "state"] as ColumnKey[])).map((key, index) => (
            <TableHead key={key} id={key} isRowHeader={index === 0}>
              {t(($) => $.settings.columns[key])}
            </TableHead>
          ))}
        </TableHeader>
        <TableBody
          items={data?.rows ?? []}
          renderEmptyState={() => (
            <Empty>
              <EmptyDescription>
                {data ? t(($) => $.settings.empty) : t(($) => $.settings.unavailable)}
              </EmptyDescription>
            </Empty>
          )}
        >
          {(row) => (
            <TableRow id={row.id}>
              {row.cells.map((cell, index) => (
                <TableCell
                  key={index}
                  focusMode={data?.columns[index] === "action" ? "child" : "cell"}
                  className="py-6 whitespace-normal align-top"
                >
                  {cell ?? t(($) => $.settings.unknown)}
                </TableCell>
              ))}
            </TableRow>
          )}
        </TableBody>
      </Table>
      {data?.after}
    </>
  );
}

export function SettingsView({
  data,
  section,
  locked = false,
  onSection,
  onField,
  onSave,
  onDiscard,
  onAction,
  availableActions = [],
  onColor,
  onLogo,
  logoAccept,
  resetCards,
  team,
  organizationPanel,
  scope,
  onScope,
}: SettingsViewProps) {
  const { t } = useTranslation(),
    mobile = useIsMobile(),
    prefix = useId();
  const [localSection, setLocalSection] = useState<SettingsSection>("genel");
  const current = section ?? localSection;
  const canAction = (kind: SettingsAction["kind"]) =>
    Boolean(onAction && availableActions.includes(kind));
  const action = (kind: Exclude<SettingsAction["kind"], "reset">) => onAction?.({ kind });
  const footer = (key: SettingsCardKey) => {
    if (key === "ay-yayin")
      return (
        <CardFooter className="flex-wrap gap-2">
          <Button
            variant="ghost"
            type="button"
            isDisabled={locked || !canAction("copyLink")}
            onPress={() => action("copyLink")}
          >
            {t(($) => $.settings.copyLink)}
          </Button>
          <Button
            variant="outline"
            type="button"
            isDisabled={locked || !canAction("preview")}
            onPress={() => action("preview")}
          >
            {t(($) => $.settings.preview)}
          </Button>
        </CardFooter>
      );
    const state = data.forms?.[key];
    return (
      <CardFooter className="flex-wrap justify-between gap-3">
        <p role="status" className="text-xs text-muted-foreground">
          {state?.notice ??
            (state?.dirty
              ? t(($) => $.settings.dirty)
              : state?.read
                ? t(($) => $.settings.saved)
                : t(($) => $.settings.unread))}
        </p>
        <div className="flex flex-wrap gap-2">
          {(key === "ay-kural" || resetCards?.includes(key)) && (
            <Button
              variant="ghost"
              type="button"
              isDisabled={locked || !canAction("reset") || !resetCards?.includes(key)}
              onPress={() => onAction?.({ kind: "reset", card: key })}
            >
              {t(($) => $.settings.reset)}
            </Button>
          )}
          <Button
            variant="outline"
            type="button"
            isDisabled={locked || !onDiscard || !state?.dirty}
            onPress={() => onDiscard?.(key)}
          >
            {t(($) => $.settings.discard)}
          </Button>
          <Button
            type="submit"
            form={`${prefix}-${key}-form`}
            isDisabled={locked || state?.pending || !state?.writable || !state?.dirty || !onSave}
          >
            {t(($) => $.settings.save)}
          </Button>
        </div>
      </CardFooter>
    );
  };
  const booleanControl = (
    key: SettingsFieldKey,
    value: SettingsFieldValue | undefined,
    disabled: boolean,
    id: string,
    description?: string,
  ) => {
    if (!value || (value.value !== null && typeof value.value !== "boolean"))
      return <Badge variant="outline">{t(($) => $.settings.unread)}</Badge>;
    if (value.value === null)
      return (
        <ToggleGroup
          variant="segmented"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[]}
          aria-labelledby={`${id}-label`}
          isDisabled={disabled}
          onSelectionChange={(keys) => {
            const next = [...keys][0];
            if (next === "on" || next === "off") onField?.(key, next === "on");
          }}
        >
          <ToggleGroupItem id="on">{t(($) => $.settings.on)}</ToggleGroupItem>
          <ToggleGroupItem id="off">{t(($) => $.settings.off)}</ToggleGroupItem>
        </ToggleGroup>
      );
    return (
      <Switch
        name={key}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-hint` : undefined}
        isSelected={value.value}
        isDisabled={disabled}
        onChange={(next) => onField?.(key, next)}
      />
    );
  };
  const fields = (
    card: (typeof settingsLayout)[number]["cards"][number],
    filter: (key: SettingsFieldKey) => boolean = () => true,
  ) => (
    <FieldGroup
      className={cn(
        "grid grid-cols-1 gap-4",
        card.key === "ay-genel" ? "@xl:grid-cols-3" : "@xl:grid-cols-2",
      )}
    >
      {card.fields
        .filter(
          (field) => filter(field.key) && (field.kind !== "number" || data.fields?.[field.key]),
        )
        .map((field) => {
          const value = data.fields?.[field.key],
            id = `${prefix}-${field.key}`;
          const disabled =
            locked ||
            field.disabled ||
            !value ||
            (!field.readonly && (!onField || !value.writable));
          const sourceHint = !value
            ? t(($) => $.settings.unread)
            : value.inherited
              ? t(($) => $.settings.inheritedHint)
              : value.value === null
                ? t(($) => $.settings.unsetHint)
                : undefined;
          const description =
            [value?.description, sourceHint].filter(Boolean).join(" ") || undefined;
          return (
            <Field
              key={field.key}
              className={cn(
                "gap-1.5",
                field.kind === "switch" && "@xl:col-span-2",
                ["ay-ad", "ay-posta", "ay-py-cons", "ay-py-slug"].includes(field.key) &&
                  "@xl:col-span-2",
                ["ay-adres", "ay-q-tz"].includes(field.key) && "@xl:col-span-full",
              )}
              orientation={
                field.kind === "switch" && !(mobile && card.key === "bildirim-0")
                  ? "horizontal"
                  : "vertical"
              }
            >
              {field.kind === "switch" ? (
                <>
                  <FieldContent className="min-w-0 flex-1">
                    <FieldLabel id={`${id}-label`}>
                      {t(($) => $.settings.fields[field.key])}
                    </FieldLabel>
                    {description && (
                      <FieldDescription id={`${id}-hint`}>{description}</FieldDescription>
                    )}
                  </FieldContent>
                  {booleanControl(field.key, value, disabled, id, description)}
                </>
              ) : (
                <>
                  <FieldLabel htmlFor={id}>{t(($) => $.settings.fields[field.key])}</FieldLabel>
                  {field.kind === "select" ? (
                    <NativeSelect
                      id={id}
                      name={field.key}
                      className="w-full"
                      value={typeof value?.value === "string" ? value.value : ""}
                      disabled={disabled}
                      aria-describedby={description ? `${id}-hint` : undefined}
                      onChange={(event) => onField?.(field.key, event.target.value)}
                    >
                      <NativeSelectOption value="">
                        {t(($) => $.settings.unknown)}
                      </NativeSelectOption>
                      {value?.options?.map((option) => (
                        <NativeSelectOption key={option.id} value={option.id}>
                          {option.label}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  ) : field.key === "ay-adres" || field.key === "billing-address" ? (
                    <Textarea
                      id={id}
                      name={field.key}
                      rows={mobile ? 3 : 1}
                      className="min-h-9 rounded-md border border-input bg-transparent"
                      autoComplete={
                        field.key === "billing-address"
                          ? "billing street-address"
                          : "section-organization street-address"
                      }
                      maxLength={field.key === "billing-address" ? 1000 : undefined}
                      value={typeof value?.value === "string" ? value.value : ""}
                      disabled={disabled}
                      aria-describedby={description ? `${id}-hint` : undefined}
                      onChange={(event) => onField?.(field.key, event.target.value)}
                    />
                  ) : (
                    <Input
                      id={id}
                      name={field.key}
                      type={field.key === "ay-tel" ? "tel" : field.kind}
                      {...(field.kind === "number"
                        ? { min: 1, max: 2147483647, required: true }
                        : {})}
                      className={field.readonly ? "bg-muted" : undefined}
                      value={typeof value?.value === "string" ? value.value : ""}
                      readOnly={field.readonly}
                      disabled={disabled}
                      autoComplete={
                        field.key === "ay-tel"
                          ? "section-organization tel"
                          : field.key === "ay-posta"
                            ? "section-organization email"
                            : field.key === "billing-email"
                              ? "billing email"
                              : field.key === "billing-name"
                                ? "billing organization"
                                : "off"
                      }
                      maxLength={
                        field.key === "billing-email"
                          ? 320
                          : field.key === "billing-name"
                            ? 1000
                            : undefined
                      }
                      autoCapitalize={
                        field.kind === "email" || field.key === "ay-py-slug" ? "none" : undefined
                      }
                      spellCheck={
                        field.kind === "email" || field.key === "ay-py-slug" ? false : undefined
                      }
                      aria-describedby={description ? `${id}-hint` : undefined}
                      onChange={(event) => onField?.(field.key, event.target.value)}
                    />
                  )}
                  {description && (
                    <FieldDescription id={`${id}-hint`}>{description}</FieldDescription>
                  )}
                  {((field.key === "ay-ad" && canAction("renameOrganization")) ||
                    (field.key === "ay-sube" && canAction("renameCenter"))) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label={t(($) => $.settings.identity.editFor, {
                        name: t(($) => $.settings.fields[field.key]),
                      })}
                      onPress={() =>
                        action(field.key === "ay-ad" ? "renameOrganization" : "renameCenter")
                      }
                    >
                      {t(($) => $.settings.identity.edit)}
                    </Button>
                  )}
                </>
              )}
            </Field>
          );
        })}
    </FieldGroup>
  );
  const reminders = (card: (typeof settingsLayout)[number]["cards"][number]) => (
    <FieldGroup className="gap-6">
      <FieldSet className="gap-3">
        <FieldLegend className="sr-only">{t(($) => $.settings.cards[card.key].title)}</FieldLegend>
        {(
          [
            ["ay-h-ders", "ay-h-ders-n"],
            ["ay-h-paket", "ay-h-paket-n"],
            ["ay-h-vade", "ay-h-vade-n"],
            ["ay-h-etkinlik", "ay-h-etkinlik-n"],
          ] as const
        ).map(([toggle, timing]) => {
          const selected = data.fields?.[toggle],
            time = data.fields?.[timing],
            id = `${prefix}-${toggle}`;
          return (
            <Field key={toggle} orientation="horizontal" className="flex-wrap gap-3">
              <FieldContent className="min-w-[min(100%,12rem)] flex-1">
                <FieldLabel id={`${id}-label`}>{t(($) => $.settings.fields[toggle])}</FieldLabel>
                <FieldDescription>{selected?.description}</FieldDescription>
              </FieldContent>
              <NativeSelect
                name={timing}
                aria-label={t(($) => $.settings.fields[timing])}
                className="max-w-full w-36"
                value={typeof time?.value === "string" ? time.value : ""}
                disabled={locked || !time?.writable || !onField}
                onChange={(event) => onField?.(timing, event.target.value)}
              >
                <NativeSelectOption value="">{t(($) => $.settings.unknown)}</NativeSelectOption>
                {time?.options?.map((option) => (
                  <NativeSelectOption key={option.id} value={option.id}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {booleanControl(toggle, selected, locked || !selected?.writable || !onField, id)}
            </Field>
          );
        })}
      </FieldSet>
      <FieldSet className="gap-3">
        <FieldLegend>{t(($) => $.settings.channels)}</FieldLegend>
        {fields(card, (key) => key.startsWith("ay-c-"))}
      </FieldSet>
      <FieldSet className="gap-3">
        <FieldLegend>{t(($) => $.settings.quietHours)}</FieldLegend>
        {fields(card, (key) => key.startsWith("ay-q-"))}
      </FieldSet>
    </FieldGroup>
  );
  function brandColor(key: "primaryColor" | "secondaryColor" | "accentColor") {
    const value = data.brand?.colors.find((color) => color.key === key)?.value;
    return value && /^#[0-9a-fA-F]{6}$/.test(value) ? value : undefined;
  }
  const brand = (
    <FieldGroup className="grid gap-6 @xl:grid-cols-2">
      <FieldGroup className="gap-4">
        <FieldGroup className="grid grid-cols-1 gap-3 @sm:grid-cols-3">
          {(
            data.brand?.colors ??
            (["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => ({
              key,
              value: null,
              writable: false,
            }))
          ).map((color) => (
            <Field key={color.key} className="gap-1.5">
              <FieldLabel htmlFor={`${prefix}-${color.key}`}>
                {t(($) => $.settings[color.key])}
              </FieldLabel>
              <Input
                id={`${prefix}-${color.key}`}
                name={color.key}
                value={color.value ?? ""}
                placeholder="#RRGGBB"
                pattern="#[0-9a-fA-F]{6}"
                maxLength={7}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={locked || !color.writable || !onColor}
                onChange={(event) => onColor?.(color.key, event.target.value)}
              />
            </Field>
          ))}
        </FieldGroup>
        <FieldDescription>{t(($) => $.settings.colorHint)}</FieldDescription>
        <Field>
          <FieldLabel htmlFor={`${prefix}-logo`}>{t(($) => $.settings.upload)}</FieldLabel>
          <Input
            id={`${prefix}-logo`}
            name="logo"
            type="file"
            accept={logoAccept}
            ref={(element) => {
              element?.setCustomValidity(data.brand?.logoError ?? "");
            }}
            aria-invalid={!!data.brand?.logoError || undefined}
            aria-describedby={`${prefix}-logo-hint${data.brand?.logoError ? ` ${prefix}-logo-error` : ""}`}
            disabled={locked || !onLogo || !logoAccept}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onLogo?.(file);
            }}
          />
          <FieldDescription id={`${prefix}-logo-hint`}>
            {t(($) => $.settings.logoHint)}
          </FieldDescription>
          {data.brand?.logoError && (
            <FieldError id={`${prefix}-logo-error`} role="alert">
              {data.brand.logoError}
            </FieldError>
          )}
          <Button
            variant="outline"
            type="button"
            isDisabled={locked || !data.brand?.logo || !canAction("removeLogo")}
            onPress={() => action("removeLogo")}
          >
            {t(($) => $.settings.removeLogo)}
          </Button>
        </Field>
      </FieldGroup>
      <section
        className="flex min-w-0 flex-col gap-2 self-start"
        aria-label={t(($) => $.settings.brandPreview)}
      >
        <h3 className="text-sm font-medium">{t(($) => $.settings.brandPreview)}</h3>
        <Card className="gap-0 overflow-hidden py-0">
          <CardHeader
            className="flex flex-row items-center gap-3 bg-primary px-4 py-3"
            style={{ backgroundColor: brandColor("primaryColor") }}
          >
            <div className="flex min-w-0 items-center gap-3 rounded-md bg-background p-2 text-foreground">
              {data.brand?.logo?.blob ? (
                <BlobAvatar
                  blob={data.brand.logo.blob}
                  initials={data.brand.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((word) => Array.from(word)[0])
                    .join("")}
                  size="default"
                />
              ) : (
                <Avatar>
                  <AvatarImage src={data.brand?.logo?.src} alt={data.brand?.logo?.alt ?? ""} />
                  <AvatarFallback>
                    <Building2Icon />
                  </AvatarFallback>
                </Avatar>
              )}
              <CardTitle className="break-words text-sm font-medium">
                {data.brand?.name ?? t(($) => $.settings.unknown)}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-4 p-4">
            <div
              className="grid h-2 w-full grid-cols-3 overflow-hidden rounded-sm"
              aria-hidden="true"
            >
              {(["primaryColor", "secondaryColor", "accentColor"] as const).map((key) => (
                <span
                  key={key}
                  className={
                    key === "primaryColor"
                      ? "bg-primary"
                      : key === "secondaryColor"
                        ? "bg-secondary"
                        : "bg-accent"
                  }
                  style={{ backgroundColor: brandColor(key) }}
                />
              ))}
            </div>
            <CardDescription>{t(($) => $.settings.brandExampleDescription)}</CardDescription>
            <Badge className="rounded-md border-transparent bg-primary px-3 py-2 text-primary-foreground">
              {t(($) => $.settings.brandExampleAction)}
            </Badge>
          </CardContent>
        </Card>
      </section>
    </FieldGroup>
  );
  return (
    <div className="@container flex min-w-0 flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t(($) => $.settings.title)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t(($) => $.settings.description)}</p>
        {scope && (
          <Field className="mt-4 max-w-md">
            <FieldLabel htmlFor={`${prefix}-scope`}>{t(($) => $.settings.scopeLabel)}</FieldLabel>
            <NativeSelect
              id={`${prefix}-scope`}
              name="settings_scope"
              value={scope.selected}
              disabled={locked || !onScope}
              aria-describedby={`${prefix}-scope-hint`}
              onChange={(event) => {
                if (event.target.value === "organization" || event.target.value === "center")
                  onScope?.(event.target.value);
              }}
            >
              <NativeSelectOption value="organization" disabled={!scope.organizationAvailable}>
                {scope.organizationLabel}
              </NativeSelectOption>
              <NativeSelectOption value="center" disabled={!scope.centerAvailable}>
                {scope.centerLabel}
              </NativeSelectOption>
            </NativeSelect>
            <FieldDescription id={`${prefix}-scope-hint`}>
              {t(($) => $.settings.scopeHint)}
            </FieldDescription>
          </Field>
        )}
      </header>
      <Tabs
        selectedKey={current}
        orientation={mobile ? "horizontal" : "vertical"}
        keyboardActivation="manual"
        onSelectionChange={(key) => {
          if (locked) return;
          const next = key as SettingsSection;
          setLocalSection(next);
          onSection?.(next);
        }}
        className="min-w-0 gap-6"
      >
        <TabsList
          variant="sidebar"
          aria-label={t(($) => $.settings.sectionsLabel)}
          className={cn(
            "settings-section-tabs shrink-0 p-0!",
            mobile
              ? "h-auto! min-h-14 w-full max-w-full flex-row! flex-wrap justify-start"
              : "sticky top-4 w-44 self-start",
          )}
        >
          {settingsLayout.map((panel) => {
            const Icon = icons[panel.key];
            return (
              <TabsTrigger
                key={panel.key}
                id={panel.key}
                isDisabled={locked}
                className="relative min-h-9 shrink-0 data-selected:before:absolute data-selected:before:inset-y-1 data-selected:before:start-0 data-selected:before:border-s-2 data-selected:before:border-current"
              >
                <Icon />
                {t(($) => $.settings.tabs[panel.key])}
              </TabsTrigger>
            );
          })}
        </TabsList>
        <div className="min-w-0 flex-1">
          {settingsLayout.map((panel) => {
            if (panel.key === "ekip")
              return (
                <TabsContent key={panel.key} id={panel.key}>
                  {team}
                </TabsContent>
              );
            const content = (
              <div className="flex min-w-0 flex-col gap-4">
                {panel.cards.map((card) => {
                  if (card.key === "plan-billing" && !data.forms?.[card.key]?.read) return null;
                  const form =
                    panel.key !== "gecmis" &&
                    (card.fields.length > 0 || ["ay-marka", "ay-salon"].includes(card.key));
                  const table = ["politika", "salonlar", "sablon", "gecmis"].includes(panel.key);
                  const heading = `${prefix}-${card.key}-title`;
                  const content = (
                    <Card key={card.key} className="min-w-0 gap-4">
                      <CardHeader className="gap-1">
                        <CardTitle>
                          <h2 id={heading}>{t(($) => $.settings.cards[card.key].title)}</h2>
                        </CardTitle>
                        <CardDescription>
                          {t(($) => $.settings.cards[card.key].description)}
                        </CardDescription>
                        {panel.key === "yayin" && (
                          <CardAction>
                            <Button
                              variant="outline"
                              isDisabled={locked || !canAction("publicSettings")}
                              onPress={() => action("publicSettings")}
                            >
                              {t(($) => $.settings.publicEditor.title)}
                            </Button>
                          </CardAction>
                        )}
                        {panel.key === "salonlar" && (
                          <CardAction>
                            <Button
                              type="button"
                              isDisabled={locked || !canAction("room")}
                              onPress={() => action("room")}
                            >
                              <PlusIcon data-icon="inline-start" />
                              {t(($) => $.settings.addRoom)}
                            </Button>
                          </CardAction>
                        )}
                        {card.key === "plan-0" && (
                          <CardAction>
                            <Badge variant="secondary">
                              {data.plan?.name ?? t(($) => $.settings.unknown)}
                            </Badge>
                          </CardAction>
                        )}
                      </CardHeader>
                      {form ? (
                        <form
                          id={`${prefix}-${card.key}-form`}
                          method="post"
                          aria-labelledby={heading}
                          aria-busy={data.forms?.[card.key]?.pending || undefined}
                          onSubmit={(event) => {
                            event.preventDefault();
                            const state = data.forms?.[card.key];
                            if (!locked && state?.writable && state.dirty && !state.pending)
                              onSave?.(card.key);
                          }}
                        >
                          <CardContent>
                            {card.key === "ay-marka" ? (
                              brand
                            ) : card.key === "ay-hat" ? (
                              reminders(card)
                            ) : table ? (
                              <SettingsTable
                                data={data.tables?.[panel.key]}
                                label={t(($) => $.settings.cards[card.key].title)}
                              />
                            ) : (
                              fields(
                                card,
                                (key) => card.key !== "plan-billing" || Boolean(data.fields?.[key]),
                              )
                            )}
                            {card.key === "ay-genel" && (
                              <p className="mt-4 text-xs text-muted-foreground">
                                {t(($) => $.settings.timezoneHint)}
                              </p>
                            )}
                            {card.key === "ay-salon" && (
                              <p className="mt-4 text-xs text-muted-foreground">
                                {t(($) => $.settings.roomHint)}
                              </p>
                            )}
                            {card.key === "ay-hat" && (
                              <div className="mt-6 flex flex-col gap-3">
                                <h3 className="text-sm font-medium">
                                  {t(($) => $.settings.reminderPreview)}
                                </h3>
                                <SettingsTable
                                  label={t(($) => $.settings.reminderPreview)}
                                  data={
                                    data.reminderPreview
                                      ? {
                                          columns: ["when", "summary"],
                                          rows: data.reminderPreview.map((row) => ({
                                            id: row.id,
                                            cells: [row.lesson, row.delivery],
                                          })),
                                        }
                                      : undefined
                                  }
                                />
                                <p className="text-xs text-muted-foreground">
                                  {t(($) => $.settings.systemNotifications)}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </form>
                      ) : table ? (
                        <CardContent className="px-0">
                          {panel.key === "gecmis" && (
                            <search className="px-5 pb-4">{fields(card)}</search>
                          )}
                          <SettingsTable
                            data={data.tables?.[panel.key]}
                            label={t(($) => $.settings.cards[card.key].title)}
                          />
                        </CardContent>
                      ) : card.key === "plan-0" ? (
                        <CardContent className="flex flex-col gap-5">
                          {data.metrics?.map((metric) => (
                            <div key={metric.id} className="flex flex-col gap-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-medium">{metric.label}</p>
                                <p className="text-xs text-muted-foreground">
                                  {metric.value} /{" "}
                                  {metric.unlimited
                                    ? t(($) => $.settings.unlimited)
                                    : (metric.maximum ??
                                      metric.limitDescription ??
                                      t(($) => $.settings.unknown))}
                                </p>
                              </div>
                              {metric.maximum !== null &&
                                metric.maximum > 0 &&
                                !metric.unlimited && (
                                  <Progress
                                    aria-label={metric.label}
                                    value={Math.min(100, (metric.value / metric.maximum) * 100)}
                                  />
                                )}
                            </div>
                          )) ?? (
                            <Empty>
                              <EmptyDescription>
                                {t(($) => $.settings.unavailable)}
                              </EmptyDescription>
                            </Empty>
                          )}
                        </CardContent>
                      ) : card.key === "plan-1" ? (
                        <CardContent className="flex flex-col gap-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">
                                {data.plan?.paymentMethod ?? t(($) => $.settings.unknown)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {data.plan?.paymentDescription}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              isDisabled={locked || !canAction("payment")}
                              onPress={() => action("payment")}
                            >
                              <UploadIcon data-icon="inline-start" />
                              {t(($) => $.settings.reportPayment)}
                            </Button>
                          </div>
                        </CardContent>
                      ) : card.key === "plan-2" ? (
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            {data.plan?.pendingDescription ?? t(($) => $.settings.unknown)}
                          </p>
                        </CardContent>
                      ) : null}
                      {form && card.key !== "bildirim-0" && footer(card.key)}
                      {card.key === "plan-billing" && data.billingTax}
                      {card.key === "plan-1" && data.invoiceHistory}
                      {(card.key === "plan-0" || card.key === "plan-2") && (
                        <CardFooter className="flex-wrap justify-between gap-3">
                          <p className="text-xs text-muted-foreground">
                            {card.key === "plan-0"
                              ? (data.plan?.nextInvoice ?? t(($) => $.settings.unknown))
                              : (data.plan?.subscriptionState ?? t(($) => $.settings.unknown))}
                          </p>
                          {card.key === "plan-2" && (
                            <Button
                              type="button"
                              variant="outline"
                              isDisabled={locked || !canAction("cancelChange")}
                              onPress={() => action("cancelChange")}
                            >
                              {t(($) => $.settings.cancelChangeTitle)}
                            </Button>
                          )}
                          {card.key === "plan-0" && (
                            <Button
                              type="button"
                              variant="outline"
                              isDisabled={locked || !canAction("upgradePlan")}
                              onPress={() => action("upgradePlan")}
                            >
                              {t(($) => $.settings.upgradeQuoteTitle)}
                            </Button>
                          )}
                          {card.key === "plan-0" && (
                            <Button
                              type="button"
                              variant="outline"
                              isDisabled={locked || !canAction("changePeriod")}
                              onPress={() => action("changePeriod")}
                            >
                              {t(($) => $.settings.periodEditorTitle)}
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            isDisabled={
                              locked ||
                              !canAction(
                                card.key === "plan-0" ? "changePlan" : "cancelSubscription",
                              )
                            }
                            onPress={() =>
                              action(card.key === "plan-0" ? "changePlan" : "cancelSubscription")
                            }
                          >
                            {card.key === "plan-0"
                              ? t(($) => $.settings.changePlan)
                              : (data.plan?.renewalActionLabel ??
                                t(($) => $.settings.cancelSubscription))}
                          </Button>
                        </CardFooter>
                      )}
                    </Card>
                  );
                  return content;
                })}
                {panel.key === "sablon" && data.preparationManagement}
                {panel.key === "genel" && (
                  <Card className="min-w-0">
                    <CardHeader>
                      <CardTitle>
                        <h2>{t(($) => $.settings.disciplines)}</h2>
                      </CardTitle>
                      <CardDescription>
                        {t(($) => $.settings.disciplineDescription)}
                      </CardDescription>
                      <CardAction>
                        <Button
                          type="button"
                          variant="outline"
                          isDisabled={locked || !canAction("discipline")}
                          onPress={() => action("discipline")}
                        >
                          <PlusIcon data-icon="inline-start" />
                          {t(($) => $.settings.addDiscipline)}
                        </Button>
                      </CardAction>
                    </CardHeader>
                    <CardContent className="px-0">
                      <SettingsTable
                        data={data.tables?.disciplines}
                        label={t(($) => $.settings.disciplines)}
                      />
                    </CardContent>
                  </Card>
                )}
                {panel.key === "yayin" && (
                  <p className="text-xs text-muted-foreground">
                    {t(($) => $.settings.publicationHint)}
                  </p>
                )}
              </div>
            );
            return (
              <TabsContent key={panel.key} id={panel.key}>
                {panel.key === "organizasyon"
                  ? (organizationPanel ?? <p role="status">{t(($) => $.settings.unavailable)}</p>)
                  : content}
              </TabsContent>
            );
          })}
        </div>
      </Tabs>
    </div>
  );
}
