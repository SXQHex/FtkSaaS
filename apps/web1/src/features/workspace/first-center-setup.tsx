import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackendError } from "../../lib/backend";
import { workspaceRoles, type readWorkspace } from "./workspace";
import type { ClientScope } from "../../lib/scoped-backend";
import { eligibleDisciplines, readStudioRooms } from "../studio/studio";
import { readDisciplineCatalog } from "../settings/discipline-reader";
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
import { Progress, ProgressLabel } from "../../components/ui/progress";
import { Skeleton } from "../../components/ui/skeleton";

const zones = ["UTC", ...Intl.supportedValuesOf("timeZone")];
const steps = ["studio", "resources", "review"] as const;
type SetupStep = (typeof steps)[number];

function SetupLoading() {
  const { t } = useTranslation();
  return (
    <Card aria-busy="true">
      <p role="status" className="sr-only">
        {t(($) => $.centerSetup.loading)}
      </p>
      <CardContent aria-hidden="true" className="grid gap-3">
        <Skeleton className="h-5 w-44 max-w-full" />
        <Skeleton className="h-9 w-36 max-w-full" />
      </CardContent>
    </Card>
  );
}

function NextCenterSetup({ scope }: { scope: ClientScope }) {
  const { t } = useTranslation();
  const resources = useQuery({
    queryKey: ["center-setup-resources", scope],
    queryFn: async () => {
      const [rooms, disciplines] = await Promise.all([
        readStudioRooms(scope),
        readDisciplineCatalog(scope, "center"),
      ]);
      return {
        roomMissing: !rooms.some((room) => room.active),
        disciplineMissing: eligibleDisciplines(disciplines).length === 0,
      };
    },
    retry: false,
  });
  if (resources.isPending) return <SetupLoading />;
  const base = `/o/${encodeURIComponent(scope.orgId)}/c/${encodeURIComponent(scope.centerId)}/settings`;
  if (!resources.isError && !resources.data.roomMissing && !resources.data.disciplineMissing)
    return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>{t(($) => $.centerSetup.steps.resources)}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        {resources.isError ? (
          <Alert>
            <AlertDescription>{t(($) => $.centerSetup.resourceReadError)}</AlertDescription>
            <Button
              variant="outline"
              onPress={() => void resources.refetch()}
              isDisabled={resources.isFetching}
            >
              {t(($) => $.auth.retry)}
            </Button>
          </Alert>
        ) : (
          <>
            {resources.data.roomMissing && (
              <LinkButton variant="outline" href={`${base}?section=salonlar`}>
                {t(($) => $.centerSetup.room)}
              </LinkButton>
            )}
            {resources.data.disciplineMissing && (
              <LinkButton variant="outline" href={`${base}?section=genel`}>
                {t(($) => $.centerSetup.discipline)}
              </LinkButton>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
export function FirstCenterSetup({
  accountId,
  organizationId,
  centerId,
  workspace,
  onLockChange,
}: {
  accountId: string;
  organizationId?: string;
  centerId?: string;
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
  const [step, setStep] = useState<SetupStep>("studio");
  const [created, setCreated] = useState<Awaited<ReturnType<typeof readCreatedCenter>>["center"]>();
  const form = useRef<HTMLFormElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const entry = useRef<HTMLButtonElement>(null);
  const org = workspace?.selected;
  const activeCenter = workspace?.centers.find(
    (center) => center.id === centerId && center.state === "active" && center.accessible,
  );
  const resourceScope =
    org &&
    org.id === organizationId &&
    org.access_mode === "normal" &&
    activeCenter &&
    workspaceRoles(workspace, activeCenter.id).includes("center_manager")
      ? { accountId, orgId: org.id, centerId: activeCenter.id }
      : undefined;
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
  useEffect(() => {
    if (step !== "studio") stepHeading.current?.focus();
  }, [step]);
  if (initial && catalog.isPending && !locked) return <SetupLoading />;
  if (!allowed && !created && !locked && !unavailable)
    return resourceScope ? <NextCenterSetup scope={resourceScope} /> : null;
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
    if (step === "resources") {
      setStep("review");
      return;
    }
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
    if (step === "studio") {
      setStep("resources");
      return;
    }
    void command.start(centerCreateIntent({ accountId, orgId: organizationId }, parsed.data));
  }
  function closeSetup() {
    if (locked) return;
    command.reset();
    setOpen(false);
    setStep("studio");
    setDraft({ name: "", timezone: "" });
    setErrors({ name: false, timezone: false });
    entry.current?.focus();
  }
  const state = command.state;
  const notice = state === "ready" ? null : t(($) => $.centerSetup.states[state]);
  const stepNumber = steps.indexOf(step) + 1;
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
          <Button ref={entry} onPress={() => setOpen(true)} isDisabled={locked}>
            {t(($) => $.centerSetup.action)}
          </Button>
        )}
        <Sheet
          isOpen={open}
          isDismissable={!locked}
          isKeyboardDismissDisabled={locked}
          onOpenChange={(value) => {
            if (!value) closeSetup();
          }}
          showCloseButton={false}
          className="w-full sm:max-w-lg"
        >
          <SheetHeader>
            <SheetTitle id={id + "-title"}>{t(($) => $.centerSetup.action)}</SheetTitle>
            <SheetDescription>{org?.name}</SheetDescription>
            <Progress value={stepNumber} minValue={0} maxValue={steps.length}>
              <ProgressLabel>
                {t(($) => $.centerSetup.step, { step: stepNumber, total: steps.length })}
              </ProgressLabel>
            </Progress>
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
            <h3 ref={stepHeading} tabIndex={-1} className="text-lg font-semibold">
              {t(($) => $.centerSetup.steps[step])}
            </h3>
            {step === "studio" && (
              <FieldGroup>
                <Field data-invalid={errors.name || undefined}>
                  <FieldLabel htmlFor={id + "-name"}>{t(($) => $.centerSetup.name)}</FieldLabel>
                  <Input
                    id={id + "-name"}
                    name="name"
                    autoFocus
                    autoComplete="organization"
                    enterKeyHint="next"
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
            )}
            {step === "resources" && (
              <div className="space-y-3">
                <p>{t(($) => $.centerSetup.resourcesHint)}</p>
                <dl className="space-y-3">
                  <div>
                    <dt className="font-medium">{t(($) => $.centerSetup.room)}</dt>
                    <dd className="text-muted-foreground">{t(($) => $.centerSetup.roomHint)}</dd>
                  </div>
                  <div>
                    <dt className="font-medium">{t(($) => $.centerSetup.discipline)}</dt>
                    <dd className="text-muted-foreground">
                      {t(($) => $.centerSetup.disciplineHint)}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
            {step === "review" && (
              <dl className="grid gap-3">
                <div>
                  <dt className="text-muted-foreground">{t(($) => $.centerSetup.name)}</dt>
                  <dd className="font-medium wrap-anywhere">{draft.name.trim()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t(($) => $.centerSetup.timezone)}</dt>
                  <dd className="font-medium wrap-anywhere">{draft.timezone}</dd>
                </div>
              </dl>
            )}
            {notice && (
              <Alert
                role="status"
                variant={command.state === "rejected" ? "destructive" : "default"}
              >
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
          </form>
          <SheetFooter className="flex-wrap">
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
            {step !== "studio" && !created && !locked && (
              <Button
                variant="outline"
                onPress={() => setStep(step === "review" ? "resources" : "studio")}
              >
                {t(($) => $.centerSetup.back)}
              </Button>
            )}
            <Button variant="ghost" onPress={closeSetup} isDisabled={locked}>
              {created ? t(($) => $.memberProfile.close) : t(($) => $.centerSetup.later)}
            </Button>
            {["ready", "rejected", "stale"].includes(command.state) && (
              <Button type="submit" form={id} isDisabled={locked || !allowed}>
                {step === "review"
                  ? t(($) => $.centerSetup.action)
                  : t(($) => $.centerSetup.continue)}
              </Button>
            )}
          </SheetFooter>
        </Sheet>
      </CardContent>
    </Card>
  );
}
