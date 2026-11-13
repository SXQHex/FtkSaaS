import { useState } from "react";
import { useLoaderData, useNavigate, useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "../../components/ui/card";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { getSupabaseClient } from "../../lib/supabase";

// First read-only consumer for E01; E10's editable profile/security slices remain open.
export function AccountPage() {
  const account = useLoaderData({ from: "/account" });
  const { t } = useTranslation();
  const navigate = useNavigate();
  const router = useRouter();
  const queries = useQueryClient();
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    setFailed(false);
    const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
    if (error) {
      setFailed(true);
      setPending(false);
      return;
    }
    queries.clear();
    await navigate({ to: "/login", replace: true });
    await router.invalidate();
  }
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t(($) => $.auth.account)}</h1>
          <p className="text-muted-foreground">{t(($) => $.auth.accountDescription)}</p>
        </div>
        <Button
          variant="outline"
          isDisabled={pending}
          onPress={() => {
            void signOut();
          }}
        >
          {t(($) => $.auth.signout)}
        </Button>
      </header>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
        </Alert>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{account.display_name}</CardTitle>
          <CardDescription>
            {t(($) => $.auth.welcome, { name: account.display_name })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Field>
            <FieldLabel htmlFor="display-name">{t(($) => $.auth.displayName)}</FieldLabel>
            <Input id="display-name" readOnly value={account.display_name} />
          </Field>
        </CardContent>
      </Card>
    </main>
  );
}

export function AccountErrorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <main className="mx-auto flex max-w-sm flex-col gap-4 p-6">
      <Alert variant="destructive">
        <AlertDescription>{t(($) => $.auth.readError)}</AlertDescription>
      </Alert>
      <Button
        onPress={() => {
          void router.invalidate();
        }}
      >
        {t(($) => $.auth.retry)}
      </Button>
    </main>
  );
}
