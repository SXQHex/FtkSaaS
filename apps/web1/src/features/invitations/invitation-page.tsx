import { useLoaderData, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "../auth/auth-layout";
import { Button, LinkButton } from "../../components/ui/button";
import { Alert, AlertDescription } from "../../components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "../../components/ui/card";
import { Field, FieldLabel, FieldDescription, FieldGroup } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import type { AccountView } from "../../lib/api-contracts/generated";
import { inspectInvitation } from "./invitation";
import { useInvitationAcceptance } from "./use-invitation-acceptance";

export function InvitationPage() {
  const { account, invitation } = useLoaderData({ from: "/invite" });
  return (
    <InvitationContent key={account?.id ?? "anonymous"} account={account} invitation={invitation} />
  );
}

function InvitationContent({
  account,
  invitation,
}: {
  account: AccountView | null;
  invitation: ReturnType<typeof inspectInvitation>;
}) {
  const { t } = useTranslation();
  const { busy, phase, notice, organizations, differentAccount, authenticate, act } =
    useInvitationAcceptance(account, invitation);
  return (
    <AuthLayout>
      <Card
        className="gap-4 overflow-visible border-0 bg-transparent py-0 shadow-none [--card-spacing:0px]"
        aria-busy={busy}
      >
        <CardHeader className="gap-1">
          <CardTitle>
            <h1>{t(($) => $.invitation.title)}</h1>
          </CardTitle>
          <CardDescription>{t(($) => $.invitation.description)}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {invitation?.conflictingLink && (
            <Alert>
              <AlertDescription>{t(($) => $.invitation.conflictingLink)}</AlertDescription>
            </Alert>
          )}
          {!invitation ? (
            <Alert>
              <AlertDescription>{t(($) => $.invitation.missing)}</AlertDescription>
            </Alert>
          ) : !account ? (
            <div className="flex flex-col gap-2">
              <Button isDisabled={busy} onPress={() => void authenticate("/login")}>
                {t(($) => $.invitation.signin)}
              </Button>
              <Button
                variant="outline"
                isDisabled={busy}
                onPress={() => void authenticate("/signup")}
              >
                {t(($) => $.invitation.signup)}
              </Button>
            </div>
          ) : (
            <>
              <FieldGroup className="gap-4">
                <Field>
                  <FieldLabel htmlFor="invite-email">{t(($) => $.invitation.email)}</FieldLabel>
                  <Input
                    id="invite-email"
                    type="email"
                    value={account.identity?.email ?? ""}
                    readOnly
                    aria-describedby="invite-email-hint"
                  />
                  <FieldDescription id="invite-email-hint">
                    {t(($) => $.invitation.emailHint)}
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel htmlFor="invite-name">{t(($) => $.invitation.name)}</FieldLabel>
                  <Input id="invite-name" value={account.display_name} readOnly />
                </Field>
              </FieldGroup>
              {differentAccount ? (
                <Alert>
                  <AlertDescription>{t(($) => $.invitation.accountChanged)}</AlertDescription>
                </Alert>
              ) : phase === "done" ? (
                <>
                  <Alert role="status">
                    <AlertDescription>{t(($) => $.invitation.accepted)}</AlertDescription>
                  </Alert>
                  {organizations.length > 0 && (
                    <ul className="flex flex-col gap-2">
                      {organizations.map((org, index) => (
                        <li key={index}>
                          {org.name}
                          {org.centers.length > 0 && (
                            <ul>
                              {org.centers.map((center, i) => (
                                <li key={i}>{center}</li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <LinkButton href="/account">{t(($) => $.invitation.account)}</LinkButton>
                </>
              ) : !account.identity?.email_verified_at ? (
                <LinkButton href="/verify-email">{t(($) => $.invitation.verify)}</LinkButton>
              ) : (
                phase !== "final" && (
                  <Button isDisabled={busy} onPress={() => void act()}>
                    {phase === "accept"
                      ? t(($) => $.invitation.accept)
                      : phase === "read"
                        ? t(($) => $.invitation.read)
                        : phase === "replay"
                          ? t(($) => $.invitation.replay)
                          : t(($) => $.invitation.check)}
                  </Button>
                )
              )}
              {phase !== "done" && (
                <Button
                  variant="outline"
                  isDisabled={busy}
                  onPress={() => void authenticate("/login", true)}
                >
                  {t(($) => $.invitation.switch)}
                </Button>
              )}
            </>
          )}
          {notice && (
            <Alert role="alert">
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
        </CardContent>
        {!account && (
          <CardFooter>
            <LinkButton variant="link" href="/login">
              {t(($) => $.auth.backLogin)}
            </LinkButton>
          </CardFooter>
        )}
      </Card>
    </AuthLayout>
  );
}

export function InvitationErrorPage({ error }: ErrorComponentProps) {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <AuthLayout>
      <h1>{t(($) => $.invitation.title)}</h1>
      <Alert>
        <AlertDescription>
          {error instanceof Error && error.message === "INVITE_STORAGE_INVALID"
            ? t(($) => $.invitation.storageError)
            : t(($) => $.invitation.loadError)}
        </AlertDescription>
      </Alert>
      <Button onPress={() => void router.invalidate()}>{t(($) => $.invitation.retry)}</Button>
    </AuthLayout>
  );
}
