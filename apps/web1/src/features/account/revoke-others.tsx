import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import {
  freshPasswordSession,
  prepareOthersIntent,
  revokeOthers,
  MfaRequiredError,
} from "./fresh-session";
import { BackendError } from "../../lib/backend";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Field, FieldGroup, FieldLabel, FieldError } from "../../components/ui/field";
import { Input } from "../../components/ui/input";
import { Alert, AlertDescription } from "../../components/ui/alert";

type Intent = Awaited<ReturnType<typeof prepareOthersIntent>>;
export function RevokeOthers({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queries = useQueryClient();
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const [authExpired, setAuthExpired] = useState(false);
  const intent = useRef<Intent | undefined>(undefined);
  async function prepare() {
    intent.current = await prepareOthersIntent();
    setReady(true);
    await onRefresh();
  }
  async function reconcileAuth(error: unknown) {
    if (error instanceof MfaRequiredError) {
      close();
      await router.navigate({ to: "/mfa" });
      queries.clear();
    } else {
      setFailed(true);
      // Recheck the protected route after an uncertain native authentication outcome.
      await router.invalidate();
      queries.clear();
    }
  }
  const form = useForm({
    defaultValues: { password: "" },
    validationLogic: revalidateLogic({ mode: "blur", modeAfterSubmission: "change" }),
    onSubmit: async ({ value }) => {
      setPending(true);
      setFailed(false);
      setAuthExpired(false);
      try {
        await freshPasswordSession(value.password);
        form.reset();
        await prepare();
      } catch (error) {
        form.reset();
        await reconcileAuth(error);
      } finally {
        setPending(false);
      }
    },
  });
  function close() {
    intent.current = undefined;
    form.reset();
    setOpen(false);
    setReady(false);
    setFailed(false);
    setAuthExpired(false);
  }
  async function prepareCurrent() {
    setPending(true);
    setFailed(false);
    setAuthExpired(false);
    try {
      await prepare();
    } catch (error) {
      await reconcileAuth(error);
    } finally {
      setPending(false);
    }
  }
  async function confirm() {
    if (!intent.current) return;
    setPending(true);
    setFailed(false);
    try {
      await revokeOthers(intent.current);
      close();
      await onRefresh();
    } catch (error) {
      if (
        error instanceof BackendError &&
        ["AUTH_REQUIRED", "SESSION_REVOKED"].includes(error.code)
      ) {
        intent.current = undefined;
        setReady(false);
        setAuthExpired(true);
        await router.invalidate();
        queries.clear();
      } else {
        setFailed(true);
      }
      await onRefresh();
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button variant="outline" size="sm" onPress={() => setOpen(true)}>
        {t(($) => $.sessions.closeOthers)}
      </Button>
      <Dialog
        isOpen={open}
        onOpenChange={(next) => {
          if (!next && !pending) close();
        }}
        isDismissable={!pending}
        isKeyboardDismissDisabled={pending}
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle>{t(($) => $.sessions.closeOthers)}</DialogTitle>
          <DialogDescription>
            {ready ? t(($) => $.sessions.othersConfirm) : t(($) => $.sessions.freshDescription)}
          </DialogDescription>
        </DialogHeader>
        {!ready && (
          <form
            id="fresh-password"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              void form.handleSubmit();
            }}
          >
            <FieldGroup className="gap-4">
              <form.Field
                name="password"
                validators={{
                  onDynamic: z.string().min(
                    1,
                    t(($) => $.auth.requiredPassword),
                  ),
                }}
              >
                {(field) => (
                  <Field
                    className="gap-1"
                    data-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                  >
                    <FieldLabel htmlFor="fresh-password-input">
                      {t(($) => $.auth.password)}
                    </FieldLabel>
                    <Input
                      id="fresh-password-input"
                      type="password"
                      autoComplete="current-password"
                      value={field.state.value}
                      onChange={(event) => field.handleChange(event.target.value)}
                      onBlur={field.handleBlur}
                      disabled={pending}
                      aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
                      aria-describedby={
                        field.state.meta.errors.length ? "fresh-password-error" : undefined
                      }
                    />
                    <FieldError
                      id="fresh-password-error"
                      errors={field.state.meta.isTouched ? field.state.meta.errors : []}
                    />
                  </Field>
                )}
              </form.Field>
              <p className="text-muted-foreground">
                {t(($) => $.sessions.googleFreshHelp)}{" "}
                <a href="/login" className="underline">
                  {t(($) => $.auth.backLogin)}
                </a>
              </p>
              <Button
                variant="outline"
                isDisabled={pending}
                onPress={() => {
                  void prepareCurrent();
                }}
              >
                {t(($) => $.sessions.justSignedIn)}
              </Button>
            </FieldGroup>
          </form>
        )}
        {authExpired && (
          <Alert>
            <AlertDescription>{t(($) => $.sessions.freshExpired)}</AlertDescription>
          </Alert>
        )}
        {failed && (
          <Alert variant="destructive">
            <AlertDescription>
              {ready ? t(($) => $.sessions.othersError) : t(($) => $.sessions.freshError)}
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" isDisabled={pending} onPress={close}>
            {t(($) => $.security.cancel)}
          </Button>
          {ready ? (
            <Button
              isDisabled={pending}
              onPress={() => {
                void confirm();
              }}
            >
              {t(($) => $.sessions.confirmOthers)}
            </Button>
          ) : (
            <Button type="submit" form="fresh-password" isDisabled={pending}>
              {t(($) => $.sessions.continue)}
            </Button>
          )}
        </DialogFooter>
      </Dialog>
    </>
  );
}
