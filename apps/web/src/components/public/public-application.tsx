"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { v7, validate } from "uuid";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import type { PublicCalendarItem } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Field, button } from "../crm/fields";
import { FlowError, flowError } from "../bookings/flow-controls";
type Pending = { publication_id: string; contact: string; client_request_key: string };
function recover(key: string, publicationId: string): Pending | "invalid" | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return Object.keys(p).length === 3 &&
      p.publication_id === publicationId &&
      typeof p.contact === "string" &&
      !!p.contact.trim() &&
      validate(p.client_request_key)
      ? p
      : "invalid";
  } catch {
    return "invalid";
  }
}
export function PublicApplication({
  publication,
  siteKey,
}: {
  publication: PublicCalendarItem;
  siteKey: string;
}) {
  const t = useTranslations("publicSchedule"),
    key = `ftksaas:public-application:${publication.publication_id}`,
    [pending, setPending] = useState(() => recover(key, publication.publication_id)),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [accepted, setAccepted] = useState(false),
    widget = useRef<TurnstileInstance>(null),
    lock = useRef(false);
  async function send(p: Pending) {
    if (lock.current || !token) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      sessionStorage.setItem(key, JSON.stringify(p));
      setPending(p);
      const response = await fetch("/api/public/application", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...p, bot_proof: token }),
        cache: "no-store",
      });
      const out = await response.json();
      if (out.ok && out.data?.accepted === true) {
        sessionStorage.removeItem(key);
        setPending(null);
        setAccepted(true);
      } else {
        if (
          out.ok === false &&
          out.error?.code === "VALIDATION_FAILED" &&
          out.error?.retryable === false
        ) {
          sessionStorage.removeItem(key);
          setPending(null);
        }
        throw Error(out.error?.code ?? "TEMPORARY_FAILURE");
      }
    } catch (e) {
      setError(flowError(e));
    } finally {
      setToken("");
      widget.current?.reset();
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4 rounded-lg border p-4" aria-label={t("apply")}>
      <h2 className="text-lg font-semibold">{publication.title}</h2>
      <p>{t("applicationHint")}</p>
      {accepted ? (
        <output>{t("accepted")}</output>
      ) : pending === "invalid" ? (
        <p role="alert">{t("invalidPending")}</p>
      ) : (
        <>
          {error && <FlowError code={error} />}
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const p = pending ?? {
                publication_id: publication.publication_id,
                contact: String(new FormData(e.currentTarget).get("contact")).trim(),
                client_request_key: v7(),
              };
              void send(p);
            }}
          >
            <fieldset disabled={busy || !!pending}>
              <Field
                name="contact"
                type="email"
                label={t("contact")}
                value={pending?.contact}
                required
              />
            </fieldset>
            {pending && <p>{t("pending")}</p>}
            <Turnstile
              ref={widget}
              siteKey={siteKey}
              options={{ action: "public_application", size: "flexible" }}
              onSuccess={setToken}
              onError={() => {
                setToken("");
                setError("SERVICE_UNAVAILABLE");
              }}
              onExpire={() => setToken("")}
            />
            <Button className={button} disabled={busy || !token}>
              {t(pending ? "retry" : "submit")}
            </Button>
          </form>
        </>
      )}
    </section>
  );
}
