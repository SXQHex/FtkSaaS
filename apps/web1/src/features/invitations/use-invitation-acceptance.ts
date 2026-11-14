import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getSupabaseClient } from "../../lib/supabase";
import { BackendError } from "../../lib/backend";
import type { AccountView } from "../../lib/api-contracts/generated";
import {
  acceptInvitation,
  createAcceptanceIntent,
  inspectInvitation,
  readAcceptanceStatus,
  readAcceptedContext,
  requestInvitationAuth,
} from "./invitation";

export function useInvitationAcceptance(
  account: AccountView | null,
  invitation: ReturnType<typeof inspectInvitation>,
) {
  const { t } = useTranslation();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [phase, setPhase] = useState<"accept" | "check" | "replay" | "read" | "done" | "final">(
    invitation?.acknowledged
      ? "read"
      : invitation?.finalized
        ? "final"
        : invitation?.intent
          ? "check"
          : "accept",
  );
  const [notice, setNotice] = useState(invitation?.finalized ? t(($) => $.invitation.final) : "");
  const [organizations, setOrganizations] = useState<
    Awaited<ReturnType<typeof readAcceptedContext>>
  >([]);
  const differentAccount = !!invitation?.intent && invitation.intent.accountId !== account?.id;
  async function authenticate(path: "/login" | "/signup", signout = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      requestInvitationAuth();
      if (signout) {
        const { error } = await getSupabaseClient().auth.signOut({ scope: "local" });
        if (error) throw error;
      }
      window.location.assign(path);
    } catch {
      setNotice(t(($) => $.invitation.storageError));
      lock.current = false;
      setBusy(false);
    }
  }
  function hasIntent() {
    try {
      return !!inspectInvitation()?.intent;
    } catch {
      return true;
    }
  }
  async function act() {
    if (lock.current || !account) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    setUnavailable(false);
    let reading = phase === "read";
    try {
      const intent = createAcceptanceIntent(account.id);
      if (phase === "check") {
        const status = await readAcceptanceStatus(intent);
        if (status.status !== "succeeded") {
          setPhase(status.status === "in_progress" ? "check" : "final");
          setNotice(
            status.status === "in_progress"
              ? t(($) => $.invitation.pending)
              : status.status === "result_expired"
                ? t(($) => $.invitation.expiredResult)
                : t(($) => $.invitation.final),
          );
          return;
        }
      } else if (!reading) {
        setPhase("check");
        await acceptInvitation(intent);
      }
      reading = true;
      setPhase("read");
      setOrganizations(await readAcceptedContext(intent));
      setPhase("done");
    } catch (error) {
      if (reading) {
        setPhase("read");
        setNotice(t(($) => $.invitation.readError));
      } else if (phase === "check" && error instanceof BackendError && error.code === "NOT_FOUND") {
        setPhase("replay");
        setNotice(t(($) => $.invitation.unknown));
      } else if (!hasIntent()) {
        setPhase("accept");
        setUnavailable(error instanceof BackendError && error.code === "INVITATION_UNAVAILABLE");
        setNotice(
          error instanceof BackendError && error.code === "INVITATION_UNAVAILABLE"
            ? t(($) => $.invitation.unavailable)
            : error instanceof BackendError && error.code === "ACCOUNT_LINK_CONFLICT"
              ? t(($) => $.invitation.conflict)
              : t(($) => $.invitation.denied),
        );
      } else {
        setPhase("check");
        setNotice(t(($) => $.invitation.unknown));
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, phase, notice, unavailable, organizations, differentAccount, authenticate, act };
}
