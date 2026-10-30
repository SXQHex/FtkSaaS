"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { Preferences } from "../preferences";
import { accountError, accountProfile } from "../../lib/account";
import { browserClient } from "../../lib/supabase/client";
import { ProfileForm } from "./profile-form";
import { IdentityForm } from "./identity-form";
import { SessionManager } from "./session-manager";
import { MfaManager } from "./mfa-manager";
import { GoogleLink } from "./google-link";
import { AccountDelete } from "./account-delete";

export function AccountWorkspace({ authUserId }: { authUserId: string }) {
  const t = useTranslations("account");
  const common = useTranslations("common");
  const router = useRouter();
  const [profile, setProfile] = useState<Awaited<ReturnType<typeof accountProfile>> | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const { data } = browserClient().auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || (session && session.user.id !== authUserId)) {
        active = false;
        setProfile(null);
        router.replace("/login?next=/account");
        router.refresh();
      }
    });
    void accountProfile()
      .then((result) => {
        if (active) {
          setProfile(result);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) {
          setProfile(null);
          setError(accountError(cause));
        }
      });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [retry, router, authUserId]);
  const saved = () => setRetry((n) => n + 1);
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto min-h-svh max-w-3xl space-y-8 px-5 py-8 outline-none sm:px-8"
    >
      <header className="flex flex-wrap items-center justify-between gap-5">
        <Link href="/" className="text-sm underline underline-offset-4">
          {t("back")}
        </Link>
        <Preferences />
      </header>
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
      </div>
      {error && (
        <div className="space-y-3">
          <p role="alert">{t(error)}</p>
          <Button type="button" variant="outline" onClick={saved}>
            {common("retry")}
          </Button>
        </div>
      )}
      {!profile && !error && (
        <output className="block" aria-live="polite">
          {t("loading")}
        </output>
      )}
      {profile && (
        <div key={profile.account.id} className="space-y-10 divide-y [&>section]:pb-8">
          <ProfileForm
            key={`profile:${profile.version}`}
            account={profile.account}
            version={profile.version}
            onSaved={saved}
          />
          <IdentityForm account={profile.account} onSaved={saved} />
          <SessionManager actorId={profile.account.id} />
          <MfaManager actorId={profile.account.id} />
          <GoogleLink actorId={profile.account.id} />
          <AccountDelete actorId={profile.account.id} nativeUserId={authUserId} />
        </div>
      )}
    </main>
  );
}
