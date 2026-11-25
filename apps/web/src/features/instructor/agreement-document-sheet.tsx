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
import {
  capturePrivateReadback,
  privateQueryRevision,
  readIntoCurrentQuery,
} from "../../lib/cache-invalidation";
import { PrivateSessionRevision } from "../auth/private-session-revision";
import { useMemberCommand } from "../member-profile/use-member-command";
import { EventCommandNotice } from "../events/event-command-notice";
import {
  readAgreementDocument,
  ownServerAcceptance,
  prepareScopedAgreementAcceptance,
  type AgreementAcceptanceIntent,
  readAgreementAcceptanceReceipt,
  readAgreementAcceptanceResult,
  type AgreementDocumentBinding,
} from "./agreement-document";

export function AgreementDocumentSheet({
  binding,
  scopeReady,
  onClose,
  onLockChange,
  onAccessLost,
}: {
  binding: AgreementDocumentBinding;
  scopeReady: boolean;
  onClose: () => void;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    id = useId();
  const queries = useQueryClient();
  const sessionRevision = useContext(PrivateSessionRevision);
  const queryRevision = privateQueryRevision(queries);
  const checkbox = useRef<HTMLInputElement>(null);
  const prepared = useRef<Awaited<ReturnType<typeof prepareScopedAgreementAcceptance>> | undefined>(
    undefined,
  );
  const [commandRevision, setCommandRevision] = useState<number>();
  const [reviewedDocument, setReviewedDocument] = useState<{ revision: number; id: string }>(),
    [preparing, setPreparing] = useState(false),
    [validation, setValidation] = useState<{ revision: number; kind: "review" | "source" }>();
  const error =
    scopeReady && validation?.revision === sessionRevision ? validation.kind : undefined;
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
    enabled: scopeReady,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (scopeReady && query.error) onAccessLost(query.error);
  }, [scopeReady, query.error, onAccessLost]);
  function assertDocumentScope() {
    if (!scopeReady || queryRevision !== privateQueryRevision(queries))
      throw new Error("PRIVATE_QUERY_CHANGED");
  }
  const command = useMemberCommand({
    write: async (intent: AgreementAcceptanceIntent) => {
      assertDocumentScope();
      if (prepared.current?.intent.key !== intent.key) throw new Error("PRIVATE_QUERY_CHANGED");
      try {
        return await prepared.current.write();
      } catch (cause) {
        if (cause instanceof Error && cause.message === "ACCOUNT_CHANGED")
          throw new Error("PRIVATE_QUERY_CHANGED");
        throw cause;
      }
    },
    readReceipt: async (intent) => {
      assertDocumentScope();
      return readAgreementAcceptanceReceipt(intent);
    },
    readResult: async (intent, receiptId) => {
      assertDocumentScope();
      return readIntoCurrentQuery(queries, queryKey, () =>
        readAgreementAcceptanceResult(intent, receiptId),
      );
    },
    onAccessLost,
  });
  // Only receipt recovery survives a handoff. The user can dismiss it if
  // the old request has no readable receipt.
  const carriedCommand = commandRevision !== undefined && commandRevision !== sessionRevision;
  const locked = preparing || (carriedCommand ? command.busy : command.locked);
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  const view =
    scopeReady && query.isSuccess && query.fetchStatus === "idle" ? query.data : undefined;
  const document = view?.rendered_document;
  const reviewed =
    !!document &&
    reviewedDocument?.revision === sessionRevision &&
    reviewedDocument.id === document.id;
  const accepted = view ? ownServerAcceptance(view, binding.scope.accountId) : false;
  const disabled = locked || command.state !== "ready" || !document || accepted;
  async function accept() {
    if (disabled || !view || queryRevision !== privateQueryRevision(queries)) return;
    if (!reviewed) {
      setValidation({ revision: sessionRevision, kind: "review" });
      checkbox.current?.focus();
      return;
    }
    const assertCurrent = capturePrivateReadback(queries);
    setPreparing(true);
    setValidation(undefined);
    try {
      const next = await prepareScopedAgreementAcceptance(binding, view, reviewed);
      assertCurrent();
      prepared.current = next;
      setCommandRevision(sessionRevision);
      await command.start(next.intent);
    } catch (cause) {
      try {
        assertCurrent();
      } catch {
        return;
      }
      if (
        !(cause instanceof Error && cause.message === "ACCOUNT_CHANGED") &&
        !onAccessLost(cause)
      ) {
        setValidation({ revision: sessionRevision, kind: "source" });
        setReviewedDocument(undefined);
      }
    } finally {
      setPreparing(false);
    }
  }
  async function reload() {
    if (locked || !scopeReady || queryRevision !== privateQueryRevision(queries)) return;
    setReviewedDocument(undefined);
    setValidation(undefined);
    if (!command.locked) {
      prepared.current = undefined;
      setCommandRevision(undefined);
      command.reset();
    }
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
          {!view && (!scopeReady || !query.isError) && (
            <p role="status">{t(($) => $.memberDocuments.loading)}</p>
          )}
          {scopeReady && query.isError && (
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
                  setValidation(undefined);
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
          {scopeReady &&
            (commandRevision === sessionRevision || view || query.isError) &&
            (command.state !== "saved" || accepted) && (
              <EventCommandNotice
                command={command}
                retryAvailable={commandRevision === sessionRevision}
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
        {scopeReady && (query.isError || error === "source") && (
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
