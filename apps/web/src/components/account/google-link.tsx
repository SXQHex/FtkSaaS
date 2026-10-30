"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Script from "next/script";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { browserClient } from "../../lib/supabase/client";
import { accountCall, freshAccountProof } from "../../lib/account";
import { ReauthFields } from "./session-manager";

type GoogleIdentity = {
  accounts: {
    id: {
      initialize(options: {
        client_id: string;
        nonce: string;
        auto_select: false;
        callback: (result: { credential: string }) => void;
      }): void;
      renderButton(
        element: HTMLElement,
        options: { type: "standard"; theme: "outline"; size: "large"; text: "continue_with" },
      ): void;
      cancel(): void;
    };
  };
};
export function GoogleLink({ actorId }: { actorId: string }) {
  const t = useTranslations("account");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [loaded, setLoaded] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [done, setDone] = useState(false);
  const proof = useRef<string | null>(null);
  const button = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  useEffect(() => {
    if (!clientId || !loaded || !authorized) return;
    let active = true;
    const google = (window as Window & { google?: GoogleIdentity }).google;
    async function initialize() {
      if (!google) return;
      const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join("");
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(nonce));
      if (!active) return;
      const hashedNonce = Array.from(new Uint8Array(hash), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join("");
      google.accounts.id.initialize({
        client_id: clientId!,
        nonce: hashedNonce,
        auto_select: false,
        callback: (result) => {
          if (!active || !proof.current || lock.current) return;
          lock.current = true;
          setBusy(true);
          setError(false);
          void (async () => {
            const current = await accountCall("account_get_v1", {});
            if (!active || current.id !== actorId) throw new Error("AUTH_REQUIRED");
            await accountCall("account_google_link_prepare_v1", {
              reauth: proof.current!,
              google_id_token: result.credential,
            });
            if (!active) return;
            const linked = await browserClient().auth.linkIdentity({
              provider: "google",
              token: result.credential,
              nonce,
            });
            if (linked.error) throw linked.error;
            if (active) setDone(true);
          })()
            .catch(() => {
              if (active) setError(true);
            })
            .finally(() => {
              proof.current = null;
              lock.current = false;
              if (active) {
                setBusy(false);
                setAuthorized(false);
              }
            });
        },
      });
      if (button.current) {
        button.current.replaceChildren();
        google.accounts.id.renderButton(button.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
        });
      }
    }
    void initialize().catch(() => {
      if (active) setError(true);
    });
    return () => {
      active = false;
      proof.current = null;
      google?.accounts.id.cancel();
    };
  }, [actorId, authorized, clientId, loaded]);
  async function authorize(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      proof.current = await freshAccountProof(
        actorId,
        String(data.get("password")),
        String(data.get("code")),
      );
      form.reset();
      setAuthorized(true);
    } catch {
      setError(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section aria-labelledby="google-heading" className="space-y-5">
      <h2 id="google-heading" className="text-xl font-semibold">
        {t("googleLink")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("googleHint")}</p>
      {!clientId ? (
        <p>{t("googleNotConfigured")}</p>
      ) : (
        <>
          <Script
            src="https://accounts.google.com/gsi/client"
            strategy="afterInteractive"
            onReady={() => setLoaded(true)}
            onError={() => setError(true)}
          />
          {!done && !authorized && (
            <form onSubmit={authorize} className="space-y-4">
              <ReauthFields disabled={busy} />
              <Button disabled={busy || !loaded}>{t("prepareGoogle")}</Button>
            </form>
          )}
          {authorized && <div ref={button} />}
        </>
      )}
      {error && <p role="alert">{t("providerFailed")}</p>}
      {done && (
        <output className="block" aria-live="polite">
          {t("googleLinked")}
        </output>
      )}
    </section>
  );
}
