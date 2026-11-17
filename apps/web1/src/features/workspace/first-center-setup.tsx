import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import type { readWorkspace } from "./workspace";
import { readOrganizationSettingsCatalog } from "../settings/settings-reader";
import { useMemberCommand } from "../member-profile/use-member-command";
import {
  centerDraftSchema,
  centerCreateIntent,
  writeCenter,
  centerCreateReceipt,
  readCreatedCenter,
} from "./center-create";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "../../components/ui/sheet";
import { FieldGroup, Field, FieldLabel, FieldError } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { NativeSelect, NativeSelectOption } from "../../components/ui/native-select";
import { Button, LinkButton } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";

const zones = ["UTC", ...Intl.supportedValuesOf("timeZone")];
export function FirstCenterSetup({
  accountId,
  organizationId,
  workspace,
  onLockChange,
}: {
  accountId: string;
  organizationId?: string;
  workspace?: Awaited<ReturnType<typeof readWorkspace>>;
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient(),
    router = useRouter(),
    id = useId();
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState({ name: "", timezone: "" });
  const [errors, setErrors] = useState({ name: false, timezone: false });
  const [created, setCreated] = useState<Awaited<ReturnType<typeof readCreatedCenter>>["center"]>();
  const form = useRef<HTMLFormElement>(null);
  const org = workspace?.selected;
  const initial =
    !!org &&
    org.id === organizationId &&
    org.access_mode !== "closed" &&
    !workspace!.centers.length;
  const catalog = useQuery({
    queryKey: ["first-center-authority", accountId, organizationId],
    queryFn: () => readOrganizationSettingsCatalog({ accountId, orgId: organizationId! }),
    enabled: initial,
    retry: false,
  });
  const allowed =
    initial &&
    catalog.data?.state === "known" &&
    catalog.data.catalog.fields.some((row) => row.key === "address" && row.writable);
  useEffect(() => {
    const error = catalog.error;
    const code =
      error instanceof BackendError ? error.code : error instanceof Error ? error.message : "";
    if (["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED"].includes(code))
      void router.invalidate();
  }, [catalog.error, router]);
  const unavailable = initial && catalog.isError;
  const command = useMemberCommand({
    write: writeCenter,
    readReceipt: centerCreateReceipt,
    readResult: readCreatedCenter,
    onRefresh: async (result) => {
      setCreated(result.center);
      queries.setQueryData(["workspace", accountId, organizationId], result.workspace);
      await queries.invalidateQueries({ queryKey: ["workspace", accountId] });
    },
    onAccessLost: (error) => {
      const code =
        error instanceof BackendError ? error.code : error instanceof Error ? error.message : "";
      if (!["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_CHANGED"].includes(code)) return false;
      void router.invalidate();
      return true;
    },
  });
  const locked = command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  if (!allowed && !created && !locked && !unavailable) return null;
  function change(field: keyof typeof draft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    if (errors[field])
      setErrors((current) => ({
        ...current,
        [field]: !centerDraftSchema.shape[field].safeParse(value).success,
      }));
    if (["rejected", "stale"].includes(command.state)) command.reset();
  }
  function submit() {
    if (!allowed || locked || command.state === "saved" || !organizationId) return;
    const parsed = centerDraftSchema.safeParse(draft);
    if (!parsed.success) {
      const next = {
        name: !centerDraftSchema.shape.name.safeParse(draft.name).success,
        timezone: !centerDraftSchema.shape.timezone.safeParse(draft.timezone).success,
      };
      setErrors(next);
      (
        form.current?.elements.namedItem(next.name ? "name" : "timezone") as HTMLElement | null
      )?.focus();
      return;
    }
    void command.start(centerCreateIntent({ accountId, orgId: organizationId }, parsed.data));
  }
  const state = command.state;
  const notice = state === "ready" ? null : t(($) => $.centerSetup.states[state]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t(($) => $.centerSetup.title)}</h2>
        </CardTitle>
        <CardDescription>
          {created ? t(($) => $.centerSetup.savedHint) : t(($) => $.centerSetup.description)}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {unavailable ? (
          <Alert role="alert" variant="destructive">
            <AlertDescription>
              {t(($) => $.centerSetup.authorityUnavailable)}{" "}
              <Button
                variant="outline"
                isDisabled={catalog.isFetching}
                onPress={() => {
                  void catalog.refetch();
                }}
              >
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        ) : created ? (
          <LinkButton href={`/o/${organizationId}/c/${created.id}/settings`} variant="outline">
            {t(($) => $.centerSetup.settings)}
          </LinkButton>
        ) : (
          <Button onPress={() => setOpen(true)} isDisabled={locked}>
            {t(($) => $.centerSetup.action)}
          </Button>
        )}
        <Sheet
          isOpen={open}
          onOpenChange={(value) => {
            if (!locked) setOpen(value);
          }}
          showCloseButton={false}
        >
          <SheetHeader>
            <SheetTitle id={id + "-title"}>{t(($) => $.centerSetup.action)}</SheetTitle>
            <SheetDescription>{org?.name}</SheetDescription>
          </SheetHeader>
          <form
            id={id}
            ref={form}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-4"
            aria-labelledby={id + "-title"}
            method="post"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <FieldGroup>
              <Field data-invalid={errors.name || undefined}>
                <FieldLabel htmlFor={id + "-name"}>{t(($) => $.centerSetup.name)}</FieldLabel>
                <Input
                  id={id + "-name"}
                  name="name"
                  autoFocus
                  required
                  value={draft.name}
                  disabled={locked || command.state === "saved"}
                  aria-invalid={errors.name}
                  aria-describedby={errors.name ? id + "-name-error" : undefined}
                  onChange={(event) => change("name", event.target.value)}
                />
                {errors.name && (
                  <FieldError id={id + "-name-error"}>
                    {t(($) => $.centerSetup.nameRequired)}
                  </FieldError>
                )}
              </Field>
              <Field data-invalid={errors.timezone || undefined}>
                <FieldLabel htmlFor={id + "-zone"}>{t(($) => $.centerSetup.timezone)}</FieldLabel>
                <NativeSelect
                  id={id + "-zone"}
                  name="timezone"
                  required
                  value={draft.timezone}
                  disabled={locked || command.state === "saved"}
                  aria-invalid={errors.timezone}
                  aria-describedby={errors.timezone ? id + "-zone-error" : undefined}
                  onChange={(event) => change("timezone", event.target.value)}
                >
                  <NativeSelectOption value="">
                    {t(($) => $.centerSetup.chooseTimezone)}
                  </NativeSelectOption>
                  {zones.map((zone) => (
                    <NativeSelectOption key={zone} value={zone}>
                      {zone}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errors.timezone && (
                  <FieldError id={id + "-zone-error"}>
                    {t(($) => $.centerSetup.zoneRequired)}
                  </FieldError>
                )}
              </Field>
            </FieldGroup>
            {notice && (
              <Alert
                role="status"
                variant={command.state === "rejected" ? "destructive" : "default"}
              >
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
          </form>
          <SheetFooter>
            {["unknown", "pending"].includes(command.state) && (
              <Button
                variant="outline"
                onPress={() => {
                  void command.retry();
                }}
                isDisabled={command.busy}
              >
                {t(($) => $.finance.retrySame)}
              </Button>
            )}
            {["unknown", "pending", "saved-unread"].includes(command.state) && (
              <Button
                variant="outline"
                onPress={() => {
                  void command.readReceipt();
                }}
                isDisabled={command.busy}
              >
                {t(($) => $.finance.readResult)}
              </Button>
            )}
            <Button
              variant="outline"
              onPress={() => {
                command.reset();
                setOpen(false);
              }}
              isDisabled={locked}
            >
              {t(($) => $.memberProfile.close)}
            </Button>
            {["ready", "rejected", "stale"].includes(command.state) && (
              <Button type="submit" form={id} isDisabled={locked || !allowed}>
                {t(($) => $.centerSetup.action)}
              </Button>
            )}
          </SheetFooter>
        </Sheet>
      </CardContent>
    </Card>
  );
}
