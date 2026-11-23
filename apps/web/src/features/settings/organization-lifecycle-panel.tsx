import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import { BackendError } from "../../lib/backend";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@ftksaas/ui/components/card";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import { FieldGroup, Field, FieldLabel, FieldDescription } from "@ftksaas/ui/components/field";
import { Input } from "@ftksaas/ui/components/input";
import { Textarea } from "@ftksaas/ui/components/textarea";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { SettingsReviewDialog } from "./settings-review-dialog";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import { MfaRequiredError } from "../account/fresh-session";
import {
  prepareOrganizationLifecycle,
  organizationDeletionProof,
  writeOrganizationLifecycle,
  organizationLifecycleReceipt,
  readOrganizationLifecycleResult,
  organizationDeletionReceipt,
  saveOrganizationDeletionReceipt,
  clearOrganizationDeletionReceipt,
  recoverOrganizationDeletion,
  readOrganizationPrivacyJob,
  lifecycleImpactKeys,
  type OrganizationLifecyclePreview,
  type OrganizationLifecycleIntent,
  type OrganizationLifecycleResult,
} from "./organization-lifecycle";
export function OrganizationLifecyclePanel({
  scope,
  organizationLabel,
  locked: outerLocked,
  onLockChange,
  onSaved,
  onAccessLost,
}: {
  scope: ClientScope;
  organizationLabel: string;
  locked: boolean;
  onLockChange: (value: boolean) => void;
  onSaved: () => Promise<void>;
  onAccessLost: (error: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    id = useId();
  const [mode, setMode] = useState<"close" | "delete" | "resume">(),
    [reason, setReason] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [password, setPassword] = useState(""),
    [preparing, setPreparing] = useState(false),
    [reading, setReading] = useState(false),
    [failed, setFailed] = useState(false),
    [mfa, setMfa] = useState(false),
    [accepted, setAccepted] = useState(false),
    [expired, setExpired] = useState(false);
  const [review, setReview] = useState<{
      intent: OrganizationLifecycleIntent;
      source?: OrganizationLifecyclePreview;
    }>(),
    [result, setResult] = useState<OrganizationLifecycleResult>();
  const [receipt, setReceipt] = useState(() => organizationDeletionReceipt(scope));
  const mounted = useRef(true),
    preparingRef = useRef(false);
  // A per-command denial is not proof that the readable tenant scope was revoked.
  const lost = (cause: unknown) =>
    cause instanceof BackendError && cause.code === "FORBIDDEN" ? false : onAccessLost(cause);
  const command = useMemberCommand({
    write: writeOrganizationLifecycle,
    readReceipt: organizationLifecycleReceipt,
    readResult: readOrganizationLifecycleResult,
    onAccessLost: lost,
    onRefresh: async (value, assertCurrent) => {
      if (value.kind === "delete") {
        const current = organizationDeletionReceipt(scope);
        if (!current) throw Error("ORGANIZATION_RECOVERY_UNAVAILABLE");
        const next = { ...current, jobId: value.job.id };
        saveOrganizationDeletionReceipt(scope, next);
        if (mounted.current) setReceipt(next);
      }
      await onSaved();
      assertCurrent();
      if (mounted.current) {
        setResult(value);
        setReview(undefined);
        setMode(undefined);
        setPassword("");
      }
    },
  });
  const busy = preparing || reading || command.busy,
    locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    const expires = review?.source?.preview.expires_at;
    if (!expires) return;
    const timer = window.setTimeout(
      () => setExpired(true),
      Math.max(0, Math.min(2147483647, Date.parse(expires) - Date.now())),
    );
    return () => window.clearTimeout(timer);
  }, [review]);
  async function readStatus(jobId: string) {
    if (reading || command.busy) return;
    setReading(true);
    setFailed(false);
    try {
      const job = await readOrganizationPrivacyJob(scope, jobId);
      if (mounted.current) setResult({ kind: "delete", job });
    } catch (cause) {
      if (mounted.current && !lost(cause)) setFailed(true);
    } finally {
      if (mounted.current) setReading(false);
    }
  }
  function open(next: "close" | "delete" | "resume") {
    if (outerLocked || busy || command.locked) return;
    command.reset();
    setReview(undefined);
    setMode(next);
    setReason("");
    setConfirmation("");
    setPassword("");
    setFailed(false);
    setMfa(false);
    setExpired(false);
    setAccepted(false);
  }
  function close() {
    if (locked || busy) return;
    setMode(undefined);
    setReview(undefined);
    setPassword("");
    setConfirmation("");
    command.reset();
  }
  async function prepare() {
    if (!mode || preparingRef.current || busy || command.locked) return;
    const deletion = mode !== "close";
    if (deletion && confirmation.trim().toLocaleUpperCase("tr") !== "SİL") {
      setFailed(true);
      return;
    }
    if (mode !== "resume" && !reason.trim()) {
      setFailed(true);
      return;
    }
    preparingRef.current = true;
    setPreparing(true);
    setFailed(false);
    setMfa(false);
    try {
      const proof = deletion ? await organizationDeletionProof(scope, password) : undefined;
      const prepared =
        mode === "resume"
          ? {
              intent: recoverOrganizationDeletion(
                scope,
                organizationDeletionReceipt(scope)!,
                proof!,
              ),
            }
          : await prepareOrganizationLifecycle(scope, mode, reason, proof);
      if (mounted.current) {
        command.reset();
        setAccepted(false);
        setExpired("preview" in prepared && Date.parse(prepared.preview.expires_at) <= Date.now());
        setReview({
          intent: prepared.intent,
          ...("preview" in prepared ? { source: prepared } : {}),
        });
      }
    } catch (cause) {
      if (mounted.current) {
        if (cause instanceof MfaRequiredError) setMfa(true);
        else if (!lost(cause)) setFailed(true);
      }
    } finally {
      preparingRef.current = false;
      if (mounted.current) {
        setPassword("");
        setPreparing(false);
      }
    }
  }
  function reload() {
    if (command.locked || busy) return;
    if (
      review?.intent.operation === "organization_delete_apply_v1" &&
      ["stale", "rejected"].includes(command.state) &&
      !command.unavailable
    ) {
      clearOrganizationDeletionReceipt(scope);
      setReceipt(undefined);
    }
    command.reset();
    setReview(undefined);
    setAccepted(false);
    setExpired(false);
  }
  const deletion = mode !== "close",
    title =
      mode === "close"
        ? t(($) => $.settings.organizationLifecycle.close)
        : t(($) => $.settings.organizationLifecycle.delete);
  const unknownDeletion =
    review?.intent.operation === "organization_delete_apply_v1" &&
    ["unknown", "pending"].includes(command.state);
  const notice = unknownDeletion ? (
    <Alert variant="destructive">
      <AlertDescription>
        <p role="status">{t(($) => $.settings.organizationLifecycle.unknown)}</p>
        <Button variant="outline" isDisabled={busy} onPress={() => void command.retry()}>
          {t(($) => $.studio.retrySameRequest)}
        </Button>
      </AlertDescription>
    </Alert>
  ) : (
    <EventCommandNotice command={command} onReload={reload} />
  );
  const impact = review?.source?.preview.lifecycle_impact;
  const rows = [
    {
      id: "organization",
      title: t(($) => $.settings.organizationLifecycle.title),
      detail: organizationLabel,
    },
    {
      id: "reason",
      title: t(($) => $.settings.organizationLifecycle.reason),
      detail: review?.intent.reason ?? "",
    },
    ...(review?.intent.operation === "organization_delete_apply_v1"
      ? [
          {
            id: "scope",
            title: t(($) => $.settings.organizationLifecycle.allDataTitle),
            detail: t(($) => $.settings.organizationLifecycle.allData),
          },
        ]
      : []),
    ...(impact
      ? lifecycleImpactKeys.map((key) => ({
          id: key,
          title: t(($) => $.accountDeletion.impact[key]),
          detail: impact[key].toLocaleString("tr-TR"),
        }))
      : []),
  ];
  const privacy = result?.kind === "delete" ? result.job.privacy : undefined;
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t(($) => $.settings.organizationLifecycle.title)}</h2>
          </CardTitle>
          <CardDescription>
            {t(($) => $.settings.organizationLifecycle.description)}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p>{t(($) => $.settings.organizationLifecycle.ownerOnly)}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              isDisabled={outerLocked || busy || !!receipt || result?.kind === "close"}
              onPress={() => open("close")}
            >
              {t(($) => $.settings.organizationLifecycle.closePreview)}
            </Button>
            <Button
              variant="destructive"
              isDisabled={outerLocked || busy || !!receipt}
              onPress={() => open("delete")}
            >
              {t(($) => $.settings.organizationLifecycle.deletePreview)}
            </Button>
          </div>
          {result?.kind === "close" && (
            <Alert>
              <AlertDescription>
                <p role="status">{t(($) => $.settings.organizationLifecycle.closed)}</p>
              </AlertDescription>
            </Alert>
          )}
          {receipt && !result && (
            <Alert>
              <AlertDescription>
                {t(($) => $.settings.organizationLifecycle.pending)}
                <Button
                  variant="outline"
                  isDisabled={outerLocked || busy}
                  onPress={() => (receipt.jobId ? void readStatus(receipt.jobId) : open("resume"))}
                >
                  {receipt.jobId
                    ? t(($) => $.accountDeletion.refreshStatus)
                    : t(($) => $.settings.organizationLifecycle.resume)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {result?.kind === "delete" && (
            <Alert>
              <AlertDescription>
                <p role="status">{t(($) => $.accountDeletion.jobStates[result.job.state])}</p>
                {privacy ? (
                  <>
                    <p>{t(($) => $.accountDeletion.privacyStates[privacy.request_state])}</p>
                    <p>
                      {t(($) => $.accountDeletion.pendingScopes)}:{" "}
                      {privacy.pending_scopes
                        .map((key) => t(($) => $.accountDeletion.scopes[key]))
                        .join(" · ")}
                    </p>
                  </>
                ) : (
                  <p>{t(($) => $.accountDeletion.noPrivacyProof)}</p>
                )}
                <p>{t(($) => $.accountDeletion.physicalErasure)}</p>
                <Button
                  variant="outline"
                  isDisabled={outerLocked || busy}
                  onPress={() => void readStatus(result.job.id)}
                >
                  {t(($) => $.accountDeletion.refreshStatus)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {failed && !mode && (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.settings.organizationLifecycle.failed)}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
      {mode && !review && (
        <Sheet
          isOpen
          showCloseButton={false}
          onOpenChange={(value) => {
            if (!value) close();
          }}
          isDismissable={!locked}
          isKeyboardDismissDisabled={locked}
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {mode === "resume"
                ? t(($) => $.settings.organizationLifecycle.resumeHint)
                : t(($) => $.settings.organizationLifecycle.previewHint)}
            </SheetDescription>
          </SheetHeader>
          <form
            id={`${id}-form`}
            onSubmit={(event) => {
              event.preventDefault();
              void prepare();
            }}
            className="min-h-0 flex-1 overflow-y-auto p-5"
          >
            <FieldGroup>
              {preparing && (
                <p role="status">{t(($) => $.settings.organizationLifecycle.reading)}</p>
              )}
              {deletion && <p>{t(($) => $.settings.organizationLifecycle.allData)}</p>}
              {mode !== "resume" && (
                <Field>
                  <FieldLabel htmlFor={`${id}-reason`}>
                    {t(($) => $.settings.organizationLifecycle.reason)}
                  </FieldLabel>
                  <Textarea
                    autoFocus
                    id={`${id}-reason`}
                    required
                    maxLength={1000}
                    value={reason}
                    disabled={busy}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </Field>
              )}
              {deletion && (
                <>
                  <Field>
                    <FieldLabel htmlFor={`${id}-confirmation`}>
                      {t(($) => $.accountDeletion.confirmLabel)}
                    </FieldLabel>
                    <Input
                      autoFocus={mode === "resume"}
                      id={`${id}-confirmation`}
                      required
                      value={confirmation}
                      disabled={busy}
                      autoComplete="off"
                      onChange={(event) => setConfirmation(event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`${id}-password`}>{t(($) => $.auth.password)}</FieldLabel>
                    <Input
                      id={`${id}-password`}
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      disabled={busy}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                    <FieldDescription>{t(($) => $.accountDeletion.freshHelp)}</FieldDescription>
                  </Field>
                </>
              )}
              {failed && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t(($) => $.settings.organizationLifecycle.failed)}
                  </AlertDescription>
                </Alert>
              )}
              {mfa && (
                <Alert>
                  <AlertDescription>
                    {t(($) => $.accountDeletion.openMfa)}
                    <Button variant="outline" onPress={() => void router.navigate({ to: "/mfa" })}>
                      {t(($) => $.accountDeletion.openMfa)}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </FieldGroup>
          </form>
          <SheetFooter>
            <Button variant="outline" isDisabled={busy} onPress={close}>
              {t(($) => $.settings.discard)}
            </Button>
            <Button type="submit" form={`${id}-form`} isDisabled={busy}>
              {t(($) => $.settings.organizationLifecycle.review)}
            </Button>
          </SheetFooter>
        </Sheet>
      )}
      {review && (
        <SettingsReviewDialog
          open
          title={title}
          description={
            mode === "resume"
              ? t(($) => $.settings.organizationLifecycle.resumeHint)
              : t(($) => $.settings.organizationLifecycle.previewHint)
          }
          rows={rows}
          blockers={review.source?.preview.blockers.map((row, index) => ({
            id: `${row.code}:${index}`,
            text:
              row.code === "OWNER_TRANSFER_REQUIRED"
                ? t(($) => $.accountDeletion.ownerBlock)
                : t(($) => $.accountDeletion.blocked),
          }))}
          accepted={accepted}
          onAccepted={setAccepted}
          locked={locked}
          onClose={close}
          onApply={
            !command.unavailable &&
            command.state === "ready" &&
            !expired &&
            !review.source?.preview.blockers.length
              ? () => {
                  if (!accepted || busy) return;
                  if (review.source && Date.parse(review.source.preview.expires_at) <= Date.now()) {
                    setExpired(true);
                    return;
                  }
                  if (review.intent.operation === "organization_delete_apply_v1") {
                    try {
                      saveOrganizationDeletionReceipt(scope, {
                        key: review.intent.request.operation_key,
                        preview: review.intent.request.preview,
                        reason: review.intent.reason,
                      });
                    } catch {
                      setFailed(true);
                      return;
                    }
                  }
                  void command.start(review.intent);
                }
              : undefined
          }
          recoveryActions={
            <>
              {expired && (
                <Alert variant="destructive">
                  <AlertDescription>{t(($) => $.reports.previewUnavailable)}</AlertDescription>
                </Alert>
              )}
              {failed && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t(($) => $.settings.organizationLifecycle.failed)}
                  </AlertDescription>
                </Alert>
              )}
              {notice}
            </>
          }
        />
      )}
    </>
  );
}
