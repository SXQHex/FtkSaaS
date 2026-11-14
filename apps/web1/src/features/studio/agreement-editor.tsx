import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { XIcon } from "lucide-react";
import { BackendError } from "../../lib/backend";
import type { AgreementVersionView, ProductView } from "../../lib/api-contracts/generated";
import type { StudioScope } from "./studio";
import type { StudioViewData } from "./studio-view";
import {
  agreementDraft,
  agreementIntent,
  publishAgreement,
  readAgreementProducts,
  type AgreementDraft,
  type AgreementIntent,
} from "./agreement";
import { readStudioAgreements } from "./studio-reads";
import { AgreementTermsFields } from "./agreement-terms-fields";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose,
  SheetFooter,
} from "../../components/ui/sheet";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { NativeSelect } from "../../components/ui/native-select";
import { Checkbox } from "../../components/ui/checkbox";
import { Button } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Skeleton } from "../../components/ui/skeleton";

type Notice =
  | "loading"
  | "ready"
  | "read-error"
  | "invalid"
  | "approval-required"
  | "unknown"
  | "conflict"
  | "rejected"
  | "saved-unread";
export function StudioAgreementEditor({
  scope,
  selectedId,
  personId,
  data,
  onRefresh,
  onClose,
  onLockChange,
}: {
  scope: StudioScope;
  selectedId?: string;
  personId?: string;
  data: StudioViewData;
  onRefresh: () => Promise<void>;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<AgreementDraft>();
  const [base, setBase] = useState<AgreementVersionView>();
  const [history, setHistory] = useState<AgreementVersionView[]>([]);
  const [historyPerson, setHistoryPerson] = useState("");
  const [products, setProducts] = useState<ProductView[]>([]);
  const [productsBusy, setProductsBusy] = useState(false);
  const [productsError, setProductsError] = useState(false);
  const [notice, setNotice] = useState<Notice>("loading");
  const [busy, setBusy] = useState(false);
  const [mutating, setMutating] = useState(false);
  const pending = useRef<AgreementIntent | undefined>(undefined);
  const acknowledged = useRef<string | undefined>(undefined);
  const lock = useRef(false);
  const productsLock = useRef(false);
  const mounted = useRef(true);
  const summary = useRef<HTMLDivElement>(null);
  const preventClose = mutating || notice === "unknown" || notice === "saved-unread";
  const superseded = Boolean(base && history.some((item) => item.supersedes_id === base.id));
  const editable =
    !busy && !superseded && ["ready", "invalid", "approval-required"].includes(notice);
  const { accountId, orgId, centerId } = scope;
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    let active = true;
    async function start() {
      const versions = personId
        ? await readStudioAgreements({ accountId, orgId, centerId }, personId)
        : [];
      const selected = selectedId ? versions.find((item) => item.id === selectedId) : undefined;
      if (selectedId && !selected) throw new Error("STUDIO_UNAVAILABLE");
      const next = await agreementDraft(selected);
      if (active && mounted.current) {
        setBase(selected);
        setHistory(versions);
        setHistoryPerson(personId ?? "");
        setDraft(next);
        setNotice("ready");
      }
    }
    void start().catch(() => {
      if (active && mounted.current) setNotice("read-error");
    });
    return () => {
      active = false;
    };
  }, [accountId, orgId, centerId, personId, selectedId]);
  useEffect(() => {
    onLockChange(preventClose);
    return () => onLockChange(false);
  }, [preventClose, onLockChange]);
  useBlocker({
    shouldBlockFn: () => Boolean(pending.current),
    enableBeforeUnload: preventClose,
    disabled: !preventClose,
  });
  function close() {
    if (preventClose || pending.current || acknowledged.current) return;
    mounted.current = false;
    onClose();
  }
  function change(patch: Partial<AgreementDraft>) {
    if (editable)
      setDraft((current) =>
        current
          ? {
              ...current,
              ...patch,
              accepted: "accepted" in patch ? Boolean(patch.accepted) : false,
            }
          : current,
      );
  }
  async function choosePredecessor(id: string) {
    if (lock.current || preventClose) return;
    const selected = id ? history.find((item) => item.id === id) : undefined;
    if (id && (!selected || history.some((item) => item.supersedes_id === id))) return;
    lock.current = true;
    setBusy(true);
    try {
      const next = await agreementDraft(selected);
      if (mounted.current) {
        setBase(selected);
        setDraft({ ...next, personId: selected?.person_id ?? historyPerson });
        setNotice("ready");
        requestAnimationFrame(() => summary.current?.focus());
      }
    } catch {
      if (mounted.current) setNotice("read-error");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function loadHistory(reset = false) {
    if (lock.current || preventClose) return;
    const target = draft?.personId || personId;
    lock.current = true;
    setBusy(true);
    try {
      const versions = target ? await readStudioAgreements(scope, target) : [];
      const currentBase = base
        ? versions.find((item) => item.id === base.id)
        : !draft && selectedId
          ? versions.find((item) => item.id === selectedId)
          : undefined;
      if ((base || (!draft && selectedId)) && !currentBase) throw new Error("STUDIO_UNAVAILABLE");
      const next = reset || !draft ? await agreementDraft(currentBase) : undefined;
      await onRefresh();
      if (!mounted.current) return;
      setHistory(versions);
      setHistoryPerson(target ?? "");
      setBase(currentBase);
      if (next) setDraft({ ...next, personId: currentBase?.person_id ?? target ?? "" });
      setNotice("ready");
    } catch {
      if (mounted.current) setNotice("read-error");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function loadProducts() {
    if (productsLock.current || !editable) return;
    productsLock.current = true;
    setProductsBusy(true);
    setProductsError(false);
    try {
      const items = await readAgreementProducts(scope);
      if (mounted.current) setProducts(items);
    } catch {
      if (mounted.current) setProductsError(true);
    } finally {
      productsLock.current = false;
      if (mounted.current) setProductsBusy(false);
    }
  }
  async function finishRead() {
    const current = pending.current;
    if (!current || !acknowledged.current) return;
    const [versions] = await Promise.all([
      readStudioAgreements(scope, current.payload.person_id),
      onRefresh(),
    ]);
    if (
      !versions.some(
        (item) =>
          item.id === acknowledged.current &&
          item.discipline_id === current.payload.discipline_id &&
          item.format === current.payload.format,
      )
    )
      throw new Error("STUDIO_UNAVAILABLE");
    if (mounted.current) {
      pending.current = undefined;
      acknowledged.current = undefined;
      onClose();
    }
  }
  async function write(newDraft?: AgreementDraft) {
    if (lock.current || acknowledged.current) return;
    lock.current = true;
    setBusy(true);
    try {
      if (newDraft) {
        if (!editable) return;
        try {
          pending.current = await agreementIntent(scope, newDraft, base);
        } catch (error) {
          if (mounted.current) {
            setNotice(
              error instanceof Error && error.message === "AGREEMENT_APPROVAL_REQUIRED"
                ? "approval-required"
                : "invalid",
            );
            requestAnimationFrame(() => summary.current?.focus());
          }
          return;
        }
      }
      if (!pending.current || !mounted.current) return;
      setMutating(true);
      acknowledged.current = await publishAgreement(pending.current);
      if (mounted.current) setNotice("saved-unread");
      await finishRead();
    } catch (error) {
      if (!mounted.current) return;
      if (acknowledged.current) setNotice("saved-unread");
      else if (
        (error instanceof BackendError &&
          error.code !== "TRANSPORT_ERROR" &&
          (!error.retryable || error.code === "VERSION_CONFLICT")) ||
        (error instanceof Error && ["AUTH_REQUIRED", "ACCOUNT_CHANGED"].includes(error.message))
      ) {
        pending.current = undefined;
        setNotice(
          error instanceof BackendError && error.code === "VERSION_CONFLICT"
            ? "conflict"
            : "rejected",
        );
      } else setNotice("unknown");
    } finally {
      lock.current = false;
      if (mounted.current) {
        setBusy(false);
        setMutating(false);
      }
    }
  }
  async function retryRead() {
    if (!acknowledged.current) {
      await loadHistory(true);
      return;
    }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await finishRead();
    } catch {
      if (mounted.current) setNotice("saved-unread");
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const message =
    notice === "loading"
      ? t(($) => $.studio.loading)
      : notice === "read-error"
        ? t(($) => $.studio.resourceReadError)
        : notice === "invalid"
          ? t(($) => $.studio.agreementInvalid)
          : notice === "approval-required"
            ? t(($) => $.studio.agreementApprovalRequired)
            : notice === "unknown"
              ? t(($) => $.studio.resourceUnknown)
              : notice === "conflict"
                ? t(($) => $.studio.agreementConflict)
                : notice === "rejected"
                  ? t(($) => $.studio.agreementRejected)
                  : notice === "saved-unread"
                    ? t(($) => $.studio.agreementSavedUnread)
                    : superseded
                      ? t(($) => $.studio.agreementSuperseded)
                      : t(($) => $.studio.agreementSourceReady);
  const knownHistory = Boolean(draft?.personId) && draft?.personId === historyPerson;
  return (
    <Sheet
      isOpen
      showCloseButton={false}
      isDismissable={!preventClose}
      isKeyboardDismissDisabled={preventClose}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <SheetHeader className="relative pr-14">
        <SheetTitle>{t(($) => $.studio.prepareAgreement)}</SheetTitle>
        <SheetDescription>{t(($) => $.studio.agreementSheetDescription)}</SheetDescription>
        <SheetClose
          className="absolute top-4 right-4"
          variant="ghost"
          size="icon-sm"
          aria-label={t(($) => $.studio.close)}
          isDisabled={preventClose}
        >
          <XIcon />
        </SheetClose>
      </SheetHeader>
      <form
        id="studio-agreement"
        className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
        aria-label={t(($) => $.studio.prepareAgreement)}
        aria-busy={busy}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (draft && editable && event.currentTarget.reportValidity()) void write(draft);
        }}
      >
        <FieldGroup className="gap-4">
          <Alert
            ref={summary}
            tabIndex={-1}
            role="status"
            variant={
              [
                "invalid",
                "approval-required",
                "unknown",
                "conflict",
                "rejected",
                "read-error",
              ].includes(notice)
                ? "destructive"
                : "default"
            }
          >
            <AlertDescription className="flex flex-col items-start gap-3">
              {message}
              {notice === "unknown" ? (
                <Button
                  variant="outline"
                  isDisabled={busy}
                  onPress={() => {
                    void write();
                  }}
                >
                  {t(($) => $.studio.retrySameRequest)}
                </Button>
              ) : (
                ["read-error", "conflict", "rejected", "saved-unread"].includes(notice) && (
                  <Button
                    variant="outline"
                    isDisabled={busy}
                    onPress={() => {
                      void retryRead();
                    }}
                  >
                    {notice === "conflict" || notice === "rejected"
                      ? t(($) => $.studio.loadLatest)
                      : t(($) => $.studio.retryRead)}
                  </Button>
                )
              )}
            </AlertDescription>
          </Alert>
          {!draft && notice === "loading" && <Skeleton className="h-44 w-full" />}
          {draft && (
            <>
              <p className="text-xs text-muted-foreground">
                {t(($) => $.studio.agreementRequiredFields)}
              </p>
              <Field className="gap-1.5">
                <FieldLabel htmlFor="agreement-person">{t(($) => $.studio.instructor)}</FieldLabel>
                <NativeSelect
                  id="agreement-person"
                  name="personId"
                  className="w-full"
                  value={draft.personId}
                  disabled={!editable || Boolean(base)}
                  required
                  onChange={(event) => change({ personId: event.target.value })}
                >
                  <option value="">{t(($) => $.studio.chooseInstructor)}</option>
                  {base && !data.instructors.some((item) => item.id === base.person_id) && (
                    <option value={base.person_id}>{t(($) => $.studio.unavailableResource)}</option>
                  )}
                  {data.instructors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Button
                variant="outline"
                isDisabled={
                  busy ||
                  preventClose ||
                  !draft.personId ||
                  !["ready", "invalid", "approval-required"].includes(notice)
                }
                onPress={() => {
                  void loadHistory();
                }}
              >
                {t(($) => $.studio.loadAgreementVersions)}
              </Button>
              {knownHistory && (
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="agreement-predecessor">
                    {t(($) => $.studio.agreementPredecessor)}
                  </FieldLabel>
                  <NativeSelect
                    id="agreement-predecessor"
                    name="predecessor"
                    className="w-full"
                    value={base?.id ?? ""}
                    disabled={
                      busy ||
                      preventClose ||
                      !["ready", "invalid", "approval-required"].includes(notice)
                    }
                    onChange={(event) => {
                      void choosePredecessor(event.target.value);
                    }}
                  >
                    <option value="">{t(($) => $.studio.newAgreementChain)}</option>
                    {history.map((item) => (
                      <option
                        key={item.id}
                        value={item.id}
                        disabled={history.some((next) => next.supersedes_id === item.id)}
                      >
                        {t(($) => $.studio.agreementVersionChoice, {
                          version: item.version,
                          discipline:
                            data.disciplines.find(
                              (discipline) => discipline.id === item.discipline_id,
                            )?.name ?? t(($) => $.studio.unavailableDiscipline),
                          format:
                            item.format === "group"
                              ? t(($) => $.studio.groupLesson)
                              : t(($) => $.studio.privateLesson),
                        })}
                      </option>
                    ))}
                  </NativeSelect>
                  <FieldDescription variant="hint">
                    {t(($) => $.studio.predecessorResetsDraft)}
                  </FieldDescription>
                </Field>
              )}
              <FieldSet disabled={!editable} className="gap-4">
                <FieldLegend className="sr-only">{t(($) => $.studio.agreementTerms)}</FieldLegend>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="agreement-discipline">
                    {t(($) => $.studio.discipline)}
                  </FieldLabel>
                  <NativeSelect
                    id="agreement-discipline"
                    name="disciplineId"
                    className="w-full"
                    required
                    value={draft.disciplineId}
                    disabled={Boolean(base)}
                    onChange={(event) => change({ disciplineId: event.target.value })}
                  >
                    <option value="">{t(($) => $.studio.chooseDiscipline)}</option>
                    {base && !data.disciplines.some((item) => item.id === base.discipline_id) && (
                      <option value={base.discipline_id}>
                        {t(($) => $.studio.unavailableDiscipline)}
                      </option>
                    )}
                    {data.disciplines.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="agreement-format">
                    {t(($) => $.studio.lessonFormat)}
                  </FieldLabel>
                  <NativeSelect
                    id="agreement-format"
                    name="format"
                    className="w-full"
                    required
                    disabled={Boolean(base)}
                    value={draft.format}
                    onChange={(event) => change({ format: event.target.value })}
                  >
                    <option value="">{t(($) => $.studio.choose)}</option>
                    <option value="group">{t(($) => $.studio.groupLesson)}</option>
                    <option value="private">{t(($) => $.studio.privateLesson)}</option>
                  </NativeSelect>
                </Field>
                <AgreementTermsFields
                  value={draft.terms}
                  onChange={(terms) => change({ terms })}
                  disabled={!editable}
                  products={products}
                  loadingProducts={productsBusy}
                  productsError={productsError}
                  onLoadProducts={() => {
                    void loadProducts();
                  }}
                />
                <FieldGroup className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-4">
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="agreement-from">
                      {t(($) => $.studio.effectiveDate)}
                    </FieldLabel>
                    <Input
                      id="agreement-from"
                      name="from"
                      type="datetime-local"
                      step="1"
                      value={draft.from}
                      onChange={(event) => change({ from: event.target.value })}
                      required
                      aria-describedby="agreement-utc-hint"
                    />
                  </Field>
                  <Field className="gap-1.5">
                    <FieldLabel htmlFor="agreement-until">
                      {t(($) => $.studio.validUntilUtc)}
                    </FieldLabel>
                    <Input
                      id="agreement-until"
                      name="until"
                      type="datetime-local"
                      step="1"
                      value={draft.until}
                      onChange={(event) => change({ until: event.target.value })}
                      required
                      aria-describedby="agreement-utc-hint"
                    />
                  </Field>
                </FieldGroup>
                <FieldDescription id="agreement-utc-hint" variant="hint">
                  {t(($) => $.studio.utcValidity)}
                </FieldDescription>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="agreement-reason">
                    {t(($) => $.studio.publishReason)}
                  </FieldLabel>
                  <Textarea
                    id="agreement-reason"
                    name="reason"
                    required
                    value={draft.reason}
                    onChange={(event) => change({ reason: event.target.value })}
                  />
                </Field>
                <Field orientation="horizontal" data-invalid={notice === "approval-required"}>
                  <Checkbox
                    name="accepted"
                    isSelected={draft.accepted}
                    onChange={(accepted) => change({ accepted })}
                    isDisabled={!editable}
                    isRequired
                    isInvalid={notice === "approval-required"}
                    aria-labelledby="agreement-approval-label"
                    aria-describedby="agreement-impact-description"
                  />
                  <div>
                    <FieldLabel id="agreement-approval-label">
                      {t(($) => $.studio.impactAccepted)}
                    </FieldLabel>
                    <FieldDescription id="agreement-impact-description" variant="hint">
                      {t(($) => $.studio.agreementPublishImpact)}
                    </FieldDescription>
                  </div>
                </Field>
              </FieldSet>
            </>
          )}
        </FieldGroup>
      </form>
      <SheetFooter className="flex-wrap">
        <Button variant="outline" isDisabled={preventClose} onPress={close}>
          {t(($) => $.studio.cancel)}
        </Button>
        <Button type="submit" form="studio-agreement" isDisabled={!draft || !editable}>
          {t(($) => $.studio.publishVersion)}
        </Button>
      </SheetFooter>
    </Sheet>
  );
}
