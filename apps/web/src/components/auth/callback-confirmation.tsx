"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { safeReturnPath } from "../../lib/config";

// Supabase Auth verify.go: singleConfirmationAccepted. This fragment is only a
// display hint, never evidence of a session or a completed email change.
const singleConfirmationAccepted =
  "Confirmation link accepted. Please proceed to confirm link sent to the other email";

export function CallbackConfirmation({ returnTo = "/" }: { returnTo?: string }) {
  const t = useTranslations("auth");
  const common = useTranslations("common");
  const [state, setState] = useState<"loading" | "pending" | "error">("loading");
  const inspected = useRef(false);
  useEffect(() => {
    if (inspected.current) return;
    inspected.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const failed = ["error", "error_code", "error_description"].some((key) => fragment.has(key));
    setState(
      !failed && fragment.get("message") === singleConfirmationAccepted ? "pending" : "error",
    );
    // Do not retain provider details in the address bar or browser history.
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search,
    );
  }, []);
  const next = safeReturnPath(returnTo);
  const login = next === "/" ? "/login" : `/login?next=${encodeURIComponent(next)}`;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("confirmationTitle")}</h1>
      {state === "loading" && <output className="block">{common("loading")}</output>}
      {state === "pending" && (
        <>
          <output className="block">{t("emailChangeContinue")}</output>
          <Button asChild className="w-full">
            <Link href="/account">{common("accountSecurity")}</Link>
          </Button>
        </>
      )}
      {state === "error" && (
        <>
          <p role="alert">{t("confirmationError")}</p>
          <Button asChild className="w-full">
            <Link href={login}>{common("back")}</Link>
          </Button>
        </>
      )}
    </div>
  );
}
