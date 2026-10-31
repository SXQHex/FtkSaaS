"use client";
import { useEffect, useRef, useState } from "react";
import type { UserIdentity } from "@supabase/supabase-js";
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
  const [error, setError] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    void browserClient()
      .auth.getUserIdentities()
      .then((result) => {
        if (!active) return;
        if (result.error) setError(true);
        setIdentities(result.error ? null : result.data.identities);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [actorId, retry]);
  async function link() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      await rememberAuthReturn("/account");
      const result = await browserClient().auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${appOrigin()}/auth/callback` },
      });
      if (result.error) throw result.error;
    } catch {
      setError(true);
      setBusy(false);
      lock.current = false;
    }
  }
  async function unlink(identity: UserIdentity) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    try {
      const auth = browserClient().auth;
      const result = await auth.unlinkIdentity(identity);
      if (result.error) throw result.error;
      const refreshed = await auth.refreshSession();
      if (refreshed.error) throw refreshed.error;
      onSaved?.();
    } catch {
      setError(true);
    } finally {
      setRetry((value) => value + 1);
      setBusy(false);
      lock.current = false;
    }
  }
  return (
    <section aria-labelledby="google-heading" className="space-y-5">
      <h2 id="google-heading" className="text-xl font-semibold">
        {t("googleLink")}
      </h2>
      {error && <p role="alert">{t("providerFailed")}</p>}
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
      <Button
        type="button"
        variant="outline"
        disabled={busy || !identities}
        onClick={() => void link()}
      >
        {t("linkGoogle")}
      </Button>
      {error && (
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            setError(false);
            setRetry((value) => value + 1);
          }}
        >
          {t("refresh")}
        </Button>
      )}
    </section>
  );
}
