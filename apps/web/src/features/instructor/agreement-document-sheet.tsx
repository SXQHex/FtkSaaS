import { useContext, useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Sheet,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@ftksaas/ui/components/sheet";
import { Field, FieldGroup, FieldLabel, FieldError } from "@ftksaas/ui/components/field";
import { Checkbox } from "@ftksaas/ui/components/checkbox";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { readIntoCurrentQuery } from "../../lib/cache-invalidation";
import { PrivateSessionRevision } from "../auth/private-session-revision";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import {
  readAgreementDocument,
  ownServerAcceptance,
  prepareAgreementAcceptance,
  acceptAgreementDocument,
  readAgreementAcceptanceReceipt,
  readAgreementAcceptanceResult,
  type AgreementDocumentBinding,
} from "./agreement-document";

export function AgreementDocumentSheet({
  binding,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  binding: AgreementDocumentBinding;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    id = useId();
  const queries = useQueryClient();
  const sessionRevision = useContext(PrivateSessionRevision);
  const checkbox = useRef<HTMLInputElement>(null);
  const [reviewedDocument, setReviewedDocument] = useState<{ revision: number; id: string }>(),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState<"review" | "source">();
  const queryKey = [
    "instructor-agreement-document",
    binding.scope.accountId,
    binding.scope.orgId,
    binding.scope.centerId,
    binding.agreement.id,
    binding.agreement.version,
    sessionRevision,
  ];
  const query = useQuery({
    queryKey,
    queryFn: (readContext) => readAgreementDocument(binding, readContext),
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  const command = useMemberCommand({
    write: acceptAgreementDocument,
    readReceipt: readAgreementAcceptanceReceipt,
    readResult: (intent, receiptId) =>
      readIntoCurrentQuery(queries, queryKey, () =>
        readAgreementAcceptanceResult(intent, receiptId),
      ),
    onAccessLost,
  });
  const locked = preparing || command.locked;
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const view = query.isSuccess && query.fetchStatus === "idle" ? query.data : undefined;
  const document = view?.rendered_document;
  const reviewed =
    !!document &&
    reviewedDocument?.revision === sessionRevision &&
    reviewedDocument.id === document.id;
  const accepted = view ? ownServerAcceptance(view, binding.scope.accountId) : false;
  const disabled = locked || command.state !== "ready" || !document || accepted;
  async function accept() {
    if (disabled || !view) return;
    if (!reviewed) {
      setError("review");
      checkbox.current?.focus();
      return;
    }
    setPreparing(true);
    setError(undefined);
    try {
      await command.start(await prepareAgreementAcceptance(binding, view, reviewed));
    } catch (cause) {
      if (!onAccessLost(cause)) {
        setError("source");
        setReviewedDocument(undefined);
      }
    } finally {
      setPreparing(false);
    }
  }
  async function reload() {
    if (locked) return;
    setReviewedDocument(undefined);
    setError(undefined);
    command.reset();
    await query.refetch();
  }
  return (
    <Sheet
      isOpen
      showCloseButton={false}
      isDismissable={!locked}
      isKeyboardDismissDisabled={locked}
      onOpenChange={(open) => {
        if (!open && !locked) onClose();
      }}
    >
      <SheetHeader>
        <SheetTitle id={id + "-title"}>{t(($) => $.agreementDocument.title)}</SheetTitle>
        <SheetDescription>{t(($) => $.agreementDocument.description)}</SheetDescription>
      </SheetHeader>
      <form
        id={id}
        method="post"
        aria-labelledby={id + "-title"}
        noValidate
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-6 py-4"
        onSubmit={(event) => {
          event.preventDefault();
          void accept();
        }}
      >
        <FieldGroup>
          {!view && !query.isError && <p role="status">{t(($) => $.memberDocuments.loading)}</p>}
          {query.isError && (
            <Alert role="alert" variant="destructive">
              <AlertDescription>{t(($) => $.agreementDocument.unavailable)}</AlertDescription>
            </Alert>
          )}
          {view?.document_error && (
            <Alert role="alert">
              <AlertDescription>{t(($) => $.agreementDocument.noSource)}</AlertDescription>
            </Alert>
          )}
          {document && (
            <article
              aria-label={document.content.name}
              lang={document.content.language}
              className="flex min-w-0 flex-col gap-3"
            >
              <h3 className="font-semibold">{document.content.name}</h3>
              <p className="whitespace-pre-wrap wrap-anywhere">{document.content.text}</p>
            </article>
          )}
          {accepted && <p role="status">{t(($) => $.agreementDocument.accepted)}</p>}
          {view?.acceptance && !accepted && (
            <p role="status">{t(($) => $.agreementDocument.historical)}</p>
          )}
          {document && !accepted && (
            <Field orientation="horizontal" data-invalid={error === "review" || undefined}>
              <Checkbox
                inputRef={checkbox}
                id={id + "-review"}
                aria-labelledby={id + "-label"}
                aria-describedby={error === "review" ? id + "-error" : undefined}
                isSelected={reviewed}
                isDisabled={disabled}
                isInvalid={error === "review"}
                validationBehavior="aria"
                onChange={(value) => {
                  setReviewedDocument(
                    value ? { revision: sessionRevision, id: document.id } : undefined,
                  );
                  setError(undefined);
                }}
              />
              <FieldLabel id={id + "-label"} htmlFor={id + "-review"}>
                {t(($) => $.agreementDocument.review)}
              </FieldLabel>
            </Field>
          )}
          {error && (
            <FieldError role="alert" id={id + "-error"}>
              {error === "review"
                ? t(($) => $.agreementDocument.reviewRequired)
                : t(($) => $.agreementDocument.changed)}
            </FieldError>
          )}
          {(command.state !== "saved" || accepted) && (
            <EventCommandNotice
              command={command}
              onReload={() => {
                void reload();
              }}
            />
          )}
        </FieldGroup>
      </form>
      <SheetFooter>
        <Button type="button" variant="outline" isDisabled={locked} onPress={onClose}>
          {t(($) => $.memberDocuments.close)}
        </Button>
        {(query.isError || error === "source") && (
          <Button
            type="button"
            variant="outline"
            isDisabled={locked}
            onPress={() => {
              void reload();
            }}
          >
            {t(($) => $.memberDocuments.retry)}
          </Button>
        )}
        {document && !accepted && (
          <Button type="submit" form={id} isDisabled={disabled}>
            {t(($) => $.agreementDocument.accept)}
          </Button>
        )}
      </SheetFooter>
    </Sheet>
  );
}
