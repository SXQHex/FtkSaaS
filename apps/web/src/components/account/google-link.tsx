"use client";
import { useEffect, useRef, useState } from "react";
import { isAuthApiError, type UserIdentity } from "@supabase/supabase-js";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { browserClient } from "../../lib/supabase/client";
import { rememberAuthReturn } from "../../lib/auth-return";
import { appOrigin } from "../../lib/config";

export function GoogleLink({ actorId, onSaved }: { actorId: string; onSaved?: () => void }) {
  const t = useTranslations("account");
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"" | "providerFailed" | "lastIdentity">("");
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void browserClient()
      .auth.getUserIdentities()
      .then((result) => {
        if (!active) return;
        if (result.error) setError("providerFailed");
        setIdentities(result.error ? null : result.data.identities);
      })
      .catch(() => {
        if (active) {
          setIdentities(null);
          setError("providerFailed");
        }
      });
    return () => {
      active = false;
    };
  }, [actorId, retry]);
  function reloadIdentities() {
    setIdentities(null);
    setRetry((value) => value + 1);
  }
  async function link() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await rememberAuthReturn("/account");
      const result = await browserClient().auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${appOrigin()}/auth/callback` },
      });
      if (result.error) throw result.error;
    } catch {
      setError("providerFailed");
      setBusy(false);
      lock.current = false;
    }
  }
  async function unlink(identity: UserIdentity) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const auth = browserClient().auth;
      const result = await auth.unlinkIdentity(identity);
      if (result.error) throw result.error;
      const refreshed = await auth.refreshSession();
      if (refreshed.error) throw refreshed.error;
      onSaved?.();
    } catch (cause) {
      setError(
        isAuthApiError(cause) && cause.code === "single_identity_not_deletable"
          ? "lastIdentity"
          : "providerFailed",
      );
    } finally {
      reloadIdentities();
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <section aria-labelledby="google-heading" className="space-y-5">
      <h2 id="google-heading" className="text-xl font-semibold">
        {t("googleLink")}
      </h2>
      {error && <p role="alert">{t(error)}</p>}
      {identities
        ?.filter((identity) => identity.provider === "google")
        .map((identity) => (
          <div key={identity.identity_id} className="flex flex-wrap items-center gap-3">
            <p className="wrap-anywhere">
              {String(identity.identity_data?.email ?? t("googleLinked"))}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => void unlink(identity)}
            >
              {t("unlinkGoogle")}
            </Button>
          </div>
        ))}
      {identities && !identities.some((identity) => identity.provider === "google") && (
        <Button type="button" variant="outline" disabled={busy} onClick={() => void link()}>
          {t("linkGoogle")}
        </Button>
      )}
      {error && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setError("");
            reloadIdentities();
          }}
        >
          {t("refresh")}
        </Button>
      )}
    </section>
  );
}
