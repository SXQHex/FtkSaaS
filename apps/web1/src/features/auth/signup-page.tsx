import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { registerAccount } from "./signup";
import { loginWithGoogle } from "./auth";
import { SignupForm } from "../../components/signup-form";
import { useTranslation } from "react-i18next";
import { AuthPitch } from "./auth-layout";
import { Alert, AlertDescription } from "../../components/ui/alert";
import { GalleryVerticalEndIcon } from "lucide-react";

export function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const locked = useRef(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  function input(form: HTMLFormElement, id: string) {
    const element = form.elements.namedItem(id);
    if (!(element instanceof HTMLInputElement)) throw new Error("SIGNUP_FIELD_MISSING");
    return element;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current) return;
    const form = event.currentTarget;
    const name = input(form, "name"),
      email = input(form, "email"),
      password = input(form, "password"),
      confirmation = input(form, "confirm-password");
    if (!name.value.trim()) {
      name.setCustomValidity(t(($) => $.auth.signupRequiredName));
      name.reportValidity();
      return;
    }
    if (
      password.value.length < 8 ||
      !/[A-Z]/.test(password.value) ||
      !/[a-z]/.test(password.value) ||
      !/[0-9]/.test(password.value)
    ) {
      password.setCustomValidity(t(($) => $.auth.signupPasswordRules));
      password.reportValidity();
      return;
    }
    if (password.value !== confirmation.value) {
      confirmation.setCustomValidity(t(($) => $.auth.signupPasswordMismatch));
      confirmation.reportValidity();
      return;
    }
    locked.current = true;
    setPending(true);
    setFailure(null);
    try {
      const to = await registerAccount({
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
      });
      await navigate({ to });
    } catch (error) {
      const weak =
        error && typeof error === "object" && "code" in error && error.code === "weak_password";
      setFailure(
        error instanceof Error && error.message === "ACCOUNT_EXISTS"
          ? t(($) => $.auth.signupExisting)
          : weak
            ? t(($) => $.auth.signupWeakPassword)
            : t(($) => $.auth.signupError),
      );
    } finally {
      locked.current = false;
      setPending(false);
    }
  }
  async function google(event: MouseEvent<HTMLFormElement>) {
    const target = event.target instanceof Element ? event.target.closest("button") : null;
    if (target?.type !== "button") return;
    event.preventDefault();
    if (locked.current) return;
    locked.current = true;
    setPending(true);
    setFailure(null);
    try {
      await loginWithGoogle();
    } catch {
      setFailure(t(($) => $.auth.loginError));
    } finally {
      locked.current = false;
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <GalleryVerticalEndIcon className="size-4" />
            </div>
            {t(($) => $.auth.signupBrand)}
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <SignupForm
              aria-busy={pending}
              onSubmit={(event) => {
                void submit(event);
              }}
              onClickCapture={(event) => {
                void google(event);
              }}
              onInput={(event) => {
                for (const element of Array.from(event.currentTarget.elements))
                  if (element instanceof HTMLInputElement) element.setCustomValidity("");
              }}
            />
            {failure && (
              <Alert className="mt-4" variant="destructive">
                <AlertDescription>{failure}</AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </div>
      <div className="hidden lg:grid">
        <AuthPitch />
      </div>
    </main>
  );
}
