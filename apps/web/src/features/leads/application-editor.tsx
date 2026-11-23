import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useBlocker, useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { ClientScope } from "../../lib/scoped-backend";
import type { PersonSummary } from "@ftksaas/api-contracts";
import { BackendError } from "../../lib/backend";
import { readIntoCurrentQuery } from "../../lib/cache-invalidation";
import { readPerson } from "../people/people";
import { invalidatePeoplePages } from "../people/people-query";
import { useMemberCommand } from "../member-profile/use-member-command";
import { readApplicationsPage } from "./leads-read";
import {
  applicationReviewIntent,
  writeLeadIntent,
  readLeadReceipt,
  readLeadResult,
} from "./leads-command";
import { ApplicationReviewSheet } from "./application-review-sheet";
import { LeadPersonPicker } from "./lead-person-picker";
import { LeadCommandNotice } from "./lead-command-notice";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import {
  ItemGroup,
  Item,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@ftksaas/ui/components/item";
export function ApplicationEditor({
  scope,
  id,
  canReview,
  onClose,
  onSaved,
  onLockChange,
}: {
  scope: ClientScope;
  id: string;
  canReview: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onLockChange: (locked: boolean) => void;
}) {
  const { t } = useTranslation(),
    router = useRouter(),
    queries = useQueryClient(),
    [action, setAction] = useState<"match_existing" | "create_candidate" | "close">(
      "match_existing",
    ),
    [reviewed, setReviewed] = useState(false),
    [person, setPerson] = useState<PersonSummary | null>(null),
    [preparing, setPreparing] = useState(false),
    [error, setError] = useState("");
  const executing = useRef(false),
    errorRef = useRef<HTMLDivElement>(null);
  const key = ["lead-application", scope.accountId, scope.orgId, scope.centerId, id];
  const query = useQuery({
    queryKey: key,
    queryFn: (context) => readApplicationsPage(scope, undefined, id, undefined, context),
    retry: false,
  });
  const before = !query.isError && query.data?.items.length === 1 ? query.data.items[0] : undefined;
  const command = useMemberCommand({
    write: writeLeadIntent,
    readReceipt: readLeadReceipt,
    readResult: (intent: Parameters<typeof readLeadResult>[0], primary) =>
      readIntoCurrentQuery(
        queries,
        key,
        async () => {
          const result = await readLeadResult(intent, primary);
          if (result.kind !== "application") throw Error("APPLICATION_RESULT_MISMATCH");
          return result;
        },
        (result) => result.page,
      ),
    onRefresh: async (result, assertCurrent) => {
      if (result.kind === "application" && result.createdCandidate)
        await invalidatePeoplePages(queries, scope);
      assertCurrent();
      await onSaved();
    },
    onAccessLost: (error) => {
      const lost =
        (error instanceof Error && ["ACCOUNT_CHANGED", "AUTH_REQUIRED"].includes(error.message)) ||
        (error instanceof BackendError &&
          ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code));
      if (lost) void router.invalidate();
      return lost;
    },
  });
  const locked = preparing || command.locked;
  useBlocker({
    shouldBlockFn: () => executing.current,
    enableBeforeUnload: preparing,
    disabled: !preparing,
  });
  useEffect(() => {
    onLockChange(locked);
    return () => onLockChange(false);
  }, [locked, onLockChange]);
  function fail(message: string) {
    setError(message);
    requestAnimationFrame(() => errorRef.current?.focus());
  }
  async function submit() {
    if (executing.current || !before || !canReview || !reviewed || command.state !== "ready")
      return;
    executing.current = true;
    setPreparing(true);
    setError("");
    try {
      if (action === "match_existing" && !person) {
        fail(t(($) => $.leads.personRequired));
        return;
      }
      await command.start(
        await applicationReviewIntent(scope, before, action, person?.id, reviewed),
      );
    } catch (error) {
      setReviewed(false);
      fail(
        t(($) =>
          error instanceof BackendError && error.code === "VERSION_CONFLICT"
            ? $.leads.sourceChanged
            : $.leads.validationFailed,
        ),
      );
    } finally {
      executing.current = false;
      setPreparing(false);
    }
  }
  const intake = before?.values.contact_intake ?? before?.values.intake;
  return (
    <ApplicationReviewSheet
      name={intake?.display_name ?? before?.values.contact ?? t(($) => $.leads.applicant)}
      action={action}
      onAction={(value) => {
        if (value !== "assign_center") {
          setAction(value);
          setReviewed(false);
        }
      }}
      centers={[]}
      center=""
      onCenter={() => setReviewed(false)}
      reviewed={reviewed}
      onReviewed={setReviewed}
      disabled={locked}
      readOnly={!canReview || command.state !== "ready" || before?.state !== "pending"}
      onClose={() => {
        if (!locked) onClose();
      }}
      onSubmit={before && canReview && command.state === "ready" ? () => void submit() : undefined}
      content={
        <div className="flex flex-col gap-3">
          {query.isPending && <p role="status">{t(($) => $.leads.loading)}</p>}
          {(query.isError || (!query.isPending && !before)) && (
            <Alert variant="destructive">
              <AlertDescription>
                {t(($) => $.leads.applicationReadFailed)}{" "}
                <Button variant="outline" isDisabled={locked} onPress={() => void query.refetch()}>
                  {t(($) => $.auth.retry)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {!canReview && <p>{t(($) => $.leads.notAllowed)}</p>}
          {intake && (
            <ItemGroup>
              <Item role="listitem" size="xs">
                <ItemContent>
                  <ItemTitle>{intake.display_name}</ItemTitle>
                  <ItemDescription>
                    {[intake.phone, intake.email, intake.interest, intake.message]
                      .filter(Boolean)
                      .join(" · ")}
                  </ItemDescription>
                </ItemContent>
              </Item>
              <Item role="listitem" size="xs">
                <ItemContent>
                  <ItemTitle>{t(($) => $.leads.consent)}</ItemTitle>
                  <ItemDescription>
                    {t(($) => $.leads.consentCount, { value: intake.consents.length })}
                  </ItemDescription>
                </ItemContent>
              </Item>
            </ItemGroup>
          )}
          <h3 className="font-medium">{t(($) => $.leads.matches)}</h3>
          {before?.values.phone_matches_truncated && <p>{t(($) => $.leads.matchesTruncated)}</p>}
          <ItemGroup>
            {before?.values.phone_matches?.map((match) => (
              <Item key={match.person_id} role="listitem" size="xs">
                <ItemContent>
                  <ItemTitle>{match.display_name}</ItemTitle>
                </ItemContent>
                <ItemActions>
                  <Button
                    variant="outline"
                    size="sm"
                    isDisabled={locked || !canReview || command.state !== "ready"}
                    onPress={() => {
                      setPreparing(true);
                      void readPerson(scope, match.person_id)
                        .then(setPerson)
                        .catch(() => fail(t(($) => $.leads.peopleReadFailed)))
                        .finally(() => setPreparing(false));
                    }}
                  >
                    {t(($) => $.leads.choose)}
                  </Button>
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
          {!before?.values.phone_matches?.length && (
            <p className="text-sm text-muted-foreground">{t(($) => $.leads.noMatches)}</p>
          )}
        </div>
      }
      personPicker={
        <LeadPersonPicker
          scope={scope}
          selected={person}
          onSelect={(value) => {
            setPerson(value);
            setReviewed(false);
          }}
          disabled={locked || !canReview || command.state !== "ready"}
        />
      }
      recovery={
        <>
          {error && (
            <Alert variant="destructive" tabIndex={-1} ref={errorRef}>
              <AlertDescription>
                {error}{" "}
                <Button
                  variant="outline"
                  size="sm"
                  isDisabled={locked}
                  onPress={() => {
                    setPreparing(true);
                    void query
                      .refetch()
                      .then((result) => {
                        if (!result.isError) {
                          command.reset();
                          setReviewed(false);
                          setError("");
                        }
                      })
                      .finally(() => setPreparing(false));
                  }}
                >
                  {t(($) => $.leads.reload)}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <LeadCommandNotice
            command={command}
            onReload={() => {
              setPreparing(true);
              void query
                .refetch()
                .then((result) => {
                  if (!result.isError) {
                    command.reset();
                    setReviewed(false);
                    setError("");
                  }
                })
                .finally(() => setPreparing(false));
            }}
          />
        </>
      }
    />
  );
}
