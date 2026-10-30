"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { accountCall, accountError } from "../../lib/account";
import { browserClient } from "../../lib/supabase/client";
import { Preferences } from "../preferences";

export function InvitationAccept({ nativeUserId }: { nativeUserId: string }) {
  const t = useTranslations("account");
  const [account, setAccount] = useState<{ id: string; display_name: string } | null>(null);
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let active = true;
    const { data } = browserClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== nativeUserId)) {
        active = false;
        setAccount(null);
        setToken("");
      }
    });
    // Fragments are never sent to the server. Consume immediately, keeping secrets out of history.
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const value = hash.get("token");
    if (value) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    void accountCall("account_get_v1", {})
      .then((result) => {
        if (active) {
          setAccount(result);
          if (value) setToken(value);
        }
      })
      .catch((cause) => {
        if (active) setMessage(accountError(cause));
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [nativeUserId]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !account || accepted) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token.trim()));
      const fingerprint = Array.from(new Uint8Array(hash), (n) =>
        n.toString(16).padStart(2, "0"),
      ).join("");
      const storageKey = `ftksaas:invitation:${account.id}:${fingerprint}`;
      let key = sessionStorage.getItem(storageKey);
      if (
        key &&
        !/^[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key)
      )
        throw new Error("storageFailed");
      if (!key) {
        key = v7();
        sessionStorage.setItem(storageKey, key);
      }
      await accountCall("account_access_accept_v1", { operation_key: key, token: token.trim() });
      setAccepted(true);
      setToken("");
      setMessage("invitationAccepted");
      // Retain the key/fingerprint only; a reload must never create a new attempt for this token.
    } catch (cause) {
      setMessage(accountError(cause));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-h-svh max-w-xl space-y-6 px-5 py-8 outline-none"
    >
      <header className="flex flex-wrap justify-between gap-5">
        <Link href="/account" className="underline">
          {t("title")}
        </Link>
        <Preferences />
      </header>
      <h1 className="text-3xl font-semibold">{t("acceptInvitation")}</h1>
      <p className="text-muted-foreground">{t("invitationHint")}</p>
      {account ? (
        <p>{t("acceptingAs", { name: account.display_name })}</p>
      ) : (
        <output className="block" aria-live="polite">
          {t("loading")}
        </output>
      )}
      {message && <p role={accepted ? "status" : "alert"}>{t(message)}</p>}
      {!accepted && (
        <form onSubmit={submit} className="space-y-4">
          <Label htmlFor="invitation-token">{t("invitationToken")}</Label>
          <Input
            id="invitation-token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
            type="password"
            required
            disabled={busy || !account}
          />
          <Button disabled={busy || !account}>{t("confirmInvitation")}</Button>
        </form>
      )}
      {accepted && (
        <Button asChild>
          <Link href="/">{t("back")}</Link>
        </Button>
      )}
      <p className="text-sm">
        <Link href="/login?next=/invite" className="underline">
          {t("differentAccount")}
        </Link>
      </p>
    </main>
  );
}
