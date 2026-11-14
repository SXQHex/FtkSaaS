import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { Field, FieldLabel, FieldDescription, FieldError } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { freshPasswordSession, MfaRequiredError } from "./fresh-session";
import { deletionContext } from "./deletion";
import { getSupabaseClient } from "../../lib/supabase";

export function DeletionConfirmation({
  confirm,
  onPending,
}: {
  confirm: () => Promise<void>;
  onPending: (pending: boolean) => void;
}) {
  const { t } = useTranslation();
  const [invalid, setInvalid] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const router = useRouter();
  const queries = useQueryClient();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const confirmation = values.get("confirmation");
    if (typeof confirmation !== "string" || confirmation.trim().toLocaleUpperCase("tr") !== "SİL") {
      setInvalid(true);
      form.querySelector<HTMLInputElement>("#delete-confirm")?.focus();
      return;
    }
    busy.current = true;
    setPending(true);
    onPending(true);
    setFailed(false);
    let actor: string | undefined;
    let proof: string | undefined;
    async function stillCurrent() {
      if (!mounted.current || !actor) return false;
      const { data, error } = await getSupabaseClient().auth.getSession();
      return (
        !error &&
        mounted.current &&
        data.session?.user.id === actor &&
        (!proof || data.session.access_token === proof)
      );
    }
    try {
      const initial = await getSupabaseClient().auth.getSession();
      if (initial.error) throw initial.error;
      actor = initial.data.session?.user.id;
      if (!actor) throw new Error("AUTH_REQUIRED");
      const password = values.get("password");
      if (typeof password === "string" && password) await freshPasswordSession(password);
      const current = await getSupabaseClient().auth.getSession();
      if (current.error) throw current.error;
      if (current.data.session?.user.id !== actor) throw new Error("ACCOUNT_CHANGED");
      proof = current.data.session.access_token;
      form.reset();
      await confirm();
      // The server revokes sessions. Never sign out a potentially different SDK actor on a late ACK.
      if (await stillCurrent()) window.location.assign("/account/deletion");
    } catch (error) {
      form.reset();
      if (!(await stillCurrent())) return;
      if ((await deletionContext()).owned) window.location.assign("/account/deletion");
      else if (error instanceof MfaRequiredError) {
        queries.clear();
        await router.navigate({ to: "/mfa" });
        await router.invalidate();
      } else {
        setFailed(true);
        await router.invalidate();
        queries.clear();
      }
    } finally {
      busy.current = false;
      if (mounted.current) {
        setPending(false);
        onPending(false);
      }
    }
  }
  return (
    <form
      id="delete-confirmation"
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
    >
      <Field data-invalid={invalid} className="gap-1">
        <FieldLabel htmlFor="delete-confirm">{t(($) => $.accountDeletion.confirmLabel)}</FieldLabel>
        <Input
          id="delete-confirm"
          name="confirmation"
          required
          autoComplete="off"
          disabled={pending}
          aria-invalid={invalid}
          aria-describedby={invalid ? "delete-confirm-error" : undefined}
          onChange={() => setInvalid(false)}
        />
        {invalid && (
          <FieldError id="delete-confirm-error">
            {t(($) => $.accountDeletion.confirmError)}
          </FieldError>
        )}
      </Field>
      <Field className="gap-1">
        <FieldLabel htmlFor="delete-password">{t(($) => $.auth.password)}</FieldLabel>
        <FieldDescription id="delete-password-hint">
          {t(($) => $.accountDeletion.freshHelp)}
        </FieldDescription>
        <Input
          id="delete-password"
          name="password"
          type="password"
          autoComplete="current-password"
          disabled={pending}
          aria-describedby="delete-password-hint"
        />
      </Field>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>{t(($) => $.accountDeletion.confirmFailed)}</AlertDescription>
        </Alert>
      )}
      <p className="text-muted-foreground">{t(($) => $.accountDeletion.revokesSessions)}</p>
      <Button type="submit" variant="destructive" isDisabled={pending}>
        {pending ? t(($) => $.auth.pending) : t(($) => $.accountDeletion.submit)}
      </Button>
    </form>
  );
}
