"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { AccountField } from "./account-field";
import { browserClient } from "../../lib/supabase/client";

type Factor = { id: string; status: "verified" | "unverified"; friendly_name?: string };
type Enrollment = { id: string; secret: string; uri: string; qr_code: string };
export function MfaManager({ actorId, onSaved }: { actorId: string; onSaved?: () => void }) {
  const t = useTranslations("account");
  const [factors, setFactors] = useState<Factor[] | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void browserClient()
      .auth.mfa.listFactors()
      .then((result) => {
        if (!active) return;
        if (result.error) {
          setError(true);
          setFactors(null);
        } else {
          setFactors(result.data.totp);
        }
      })
      .catch(() => {
        if (active) {
          setError(true);
          setFactors(null);
        }
      });
    return () => {
      active = false;
    };
  }, [actorId, retry]);
  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    setNotice("");
    try {
      await task();
      onSaved?.();
    } catch {
      setError(true);
    } finally {
      setRetry((n) => n + 1);
      lock.current = false;
      setBusy(false);
    }
  }
  function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void run(async () => {
      const auth = browserClient().auth;
      const verified = await auth.mfa.challengeAndVerify({
        factorId: removing!,
        code: String(data.get("code")),
      });
      if (verified.error) throw verified.error;
      const removed = await auth.mfa.unenroll({ factorId: removing! });
      if (removed.error) throw removed.error;
      form.reset();
      const refreshed = await auth.refreshSession();
      if (refreshed.error) throw refreshed.error;
      setRemoving(null);
      setNotice("factorRemoved");
    });
  }
  return (
    <section aria-labelledby="mfa-heading" className="space-y-5">
      <h2 id="mfa-heading" className="text-xl font-semibold">
        {t("mfa")}
      </h2>
      {error && <p role="alert">{t("providerFailed")}</p>}
      {notice && (
        <output className="block" aria-live="polite">
          {t(notice)}
        </output>
      )}
      {!factors && !error && (
        <output className="block" aria-live="polite">
          {t("loading")}
        </output>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => {
          setError(false);
          setRetry((n) => n + 1);
        }}
      >
        {t("refresh")}
      </Button>
      <ul className="divide-y">
        {factors?.map((factor) => (
          <li key={factor.id} className="space-y-3 py-4">
            <p>
              {factor.friendly_name || t("authenticator")} — {t(factor.status)}
            </p>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (factor.status === "verified") setRemoving(factor.id);
                else
                  void run(async () => {
                    const result = await browserClient().auth.mfa.unenroll({ factorId: factor.id });
                    if (result.error) throw result.error;
                    if (enrollment?.id === factor.id) setEnrollment(null);
                  });
              }}
            >
              {t(factor.status === "verified" ? "removeFactor" : "cancelEnrollment")}
            </Button>
          </li>
        ))}
      </ul>
      {!enrollment && (
        <Button
          type="button"
          disabled={busy || !factors}
          onClick={() =>
            void run(async () => {
              const result = await browserClient().auth.mfa.enroll({
                factorType: "totp",
                friendlyName: "FtkSaaS",
              });
              if (result.error) throw result.error;
              setEnrollment({ id: result.data.id, ...result.data.totp });
            })
          }
        >
          {t("enroll")}
        </Button>
      )}
      {enrollment && (
        <div className="space-y-4 rounded-lg border p-4 wrap-anywhere">
          <p>{t("enrollmentHint")}</p>
          <p className="select-all font-mono text-sm">{enrollment.secret}</p>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              const code = String(new FormData(form).get("code"));
              void run(async () => {
                const result = await browserClient().auth.mfa.challengeAndVerify({
                  factorId: enrollment.id,
                  code,
                });
                if (result.error) throw result.error;
                form.reset();
                setEnrollment(null);
                setNotice("factorEnabled");
              });
            }}
          >
            <AccountField
              label={t("totpCode")}
              id="enrollment-code"
              placeholder="123456"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              disabled={busy}
            />
            <Button disabled={busy}>{t("verifyEnrollment")}</Button>
          </form>
        </div>
      )}
      {removing && (
        <form onSubmit={remove} className="space-y-4 rounded-lg border p-4">
          <AccountField
            id="remove-factor-code"
            name="code"
            label={t("totpCode")}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            required
            disabled={busy}
          />
          <div className="flex flex-wrap gap-3">
            <Button variant="destructive" disabled={busy}>
              {t("confirmRemoveFactor")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setRemoving(null)}
            >
              {t("cancel")}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
