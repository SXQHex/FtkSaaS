import { useEffect, useId, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Field, FieldError, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { BackendError } from "../../lib/backend";
import { EventCommandNotice } from "../events/event-command-notice";
import { useMemberCommand } from "../member-profile/use-member-command";
import { SettingsReviewDialog } from "../settings/settings-review-dialog";
import {
  openStudioSetup,
  readOwnStudioSetup,
  readStudioSetupReceipt,
  readStudioSetupResult,
  studioSetupIntent,
  studioSetupName,
} from "./studio-setup-request";

export function StudioSetupRequestCard({
  accountId,
  eligible,
  onLockChange,
  onOrganizationReady,
}: {
  accountId: string;
  eligible: boolean;
  onLockChange: (locked: boolean) => void;
  onOrganizationReady: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const queries = useQueryClient();
  const router = useRouter();
  const fieldId = useId(),
    headingId = useId();
  const field = useRef<HTMLInputElement>(null);
  const refreshing = useRef(false);
  const [checking, setChecking] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState(false);
  const [intent, setIntent] = useState<ReturnType<typeof studioSetupIntent>>();
  const [accepted, setAccepted] = useState(false);
  const queryKey = ["studio-setup-own", accountId];
  const query = useQuery({
    queryKey,
    queryFn: () => readOwnStudioSetup(accountId),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const command = useMemberCommand({
    write: openStudioSetup,
    readReceipt: readStudioSetupReceipt,
    readResult: readStudioSetupResult,
    onRefresh: async (result) => {
      queries.setQueryData(queryKey, result);
    },
    onAccessLost: (cause) => {
      const code =
        cause instanceof BackendError
          ? cause.code
          : cause instanceof Error
            ? cause.message
            : undefined;
      if (code !== "AUTH_REQUIRED" && code !== "SESSION_REVOKED" && code !== "ACCOUNT_CHANGED")
        return false;
      void router.invalidate();
      return true;
    },
  });
  useEffect(() => {
    onLockChange(command.locked);
    return () => onLockChange(false);
  }, [command.locked, onLockChange]);
  async function refresh() {
    if (refreshing.current || command.locked) return;
    refreshing.current = true;
    setChecking(true);
    setError(false);
    try {
      const result = await query.refetch({ throwOnError: true });
      const organization = result.data?.current?.organization_id;
      if (organization) await onOrganizationReady(organization);
    } catch {
      setError(true);
    } finally {
      refreshing.current = false;
      setChecking(false);
    }
  }
  const closeReview = () => {
    if (command.locked) return;
    command.reset();
    setAccepted(false);
    setIntent(undefined);
  };
  const data = !query.isError ? query.data : undefined;
  const current = data?.current;
  const locked = checking || command.locked;
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2 id={headingId}>{t(($) => $.studioSetup.title)}</h2>
        </CardTitle>
        <CardDescription>{t(($) => $.studioSetup.description)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {query.isPending ? (
          <p role="status">{t(($) => $.studioSetup.loading)}</p>
        ) : (
          <>
            {(error || query.isError) && (
              <Alert variant="destructive">
                <AlertDescription>{t(($) => $.studioSetup.readError)}</AlertDescription>
              </Alert>
            )}
            {current && (
              <div role="status" className="space-y-1">
                <p className="font-medium wrap-anywhere">{current.name}</p>
                <p className="text-muted-foreground">
                  {t(($) =>
                    current.state === "pending" ? $.studioSetup.pending : $.studioSetup.fulfilled,
                  )}
                </p>
              </div>
            )}
            {(current || query.isError) && (
              <Button
                variant="outline"
                isDisabled={locked || query.isFetching}
                onPress={() => void refresh()}
              >
                {t(($) => $.studioSetup.refresh)}
              </Button>
            )}
            {data && !current && eligible && !command.unavailable && (
              <form
                method="post"
                noValidate
                aria-labelledby={headingId}
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (locked || query.isFetching || intent) return;
                  const name = studioSetupName.safeParse(field.current?.value);
                  if (!name.success) {
                    setInvalid(true);
                    field.current?.focus();
                    return;
                  }
                  setIntent(studioSetupIntent(accountId, name.data, data));
                }}
              >
                <Field className="max-w-lg">
                  <FieldLabel htmlFor={fieldId}>{t(($) => $.studioSetup.name)}</FieldLabel>
                  <Input
                    id={fieldId}
                    ref={field}
                    required
                    maxLength={200}
                    autoComplete="organization"
                    aria-invalid={invalid}
                    aria-describedby={invalid ? fieldId + "-error" : undefined}
                    disabled={locked}
                    onChange={() => setInvalid(false)}
                  />
                  {invalid && (
                    <FieldError id={fieldId + "-error"}>
                      {t(($) => $.studioSetup.nameError)}
                    </FieldError>
                  )}
                </Field>
                <Button type="submit" isDisabled={locked || query.isFetching}>
                  {t(($) => $.studioSetup.review)}
                </Button>
              </form>
            )}
          </>
        )}
      </CardContent>
      {intent && (
        <SettingsReviewDialog
          open
          title={t(($) => $.studioSetup.review)}
          description={t(($) => $.studioSetup.description)}
          rows={[{ id: "name", title: t(($) => $.studioSetup.name), detail: intent.name }]}
          accepted={accepted}
          onAccepted={setAccepted}
          locked={command.locked}
          onClose={closeReview}
          onApply={
            eligible && command.state === "ready" && !current && !query.isError
              ? () => void command.start(intent)
              : undefined
          }
          applyLabel={t(($) => $.studioSetup.submit)}
          recoveryActions={
            <EventCommandNotice
              command={command}
              onReload={() => {
                closeReview();
                if (command.state !== "saved") void refresh();
              }}
            />
          }
        />
      )}
    </Card>
  );
}
