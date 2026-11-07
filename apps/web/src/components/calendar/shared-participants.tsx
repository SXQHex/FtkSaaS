"use client";
import { useCallback, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { SharedLessonParticipant, SettingsMediaAsset } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { accountCall } from "../../lib/account";
import { useRemote } from "../../lib/use-remote";
import { FlowError } from "../bookings/flow-controls";
export function SharedParticipants({
  orgId,
  sessionId,
  participants,
}: {
  orgId: string;
  sessionId: string;
  participants: SharedLessonParticipant[];
}) {
  const t = useTranslations("personalCalendar"),
    [open, setOpen] = useState(false);
  return (
    <section className="min-w-0 space-y-3 border-t pt-4" aria-label={t("participants")}>
      <Button
        className="h-auto min-h-11 max-w-full whitespace-normal"
        variant="outline"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t("participants")}
      </Button>
      {open && (
        <>
          <p className="text-sm text-muted-foreground">{t("participantsHint")}</p>
          <ul className="space-y-3">
            {participants.map((p, i) => (
              <li
                key={p.person_id}
                className="flex flex-wrap items-center gap-3 rounded-md border p-3"
              >
                {p.photo && (
                  <ParticipantPhoto
                    key={`${orgId}:${sessionId}:${p.person_id}:${p.photo.id}`}
                    orgId={orgId}
                    sessionId={sessionId}
                    personId={p.person_id}
                    asset={p.photo}
                  />
                )}
                <div className="min-w-0 space-y-1 break-words">
                  <p>{p.display_name ?? t("participant", { number: i + 1 })}</p>
                  {p.email && (
                    <p>
                      <a className="underline" href={`mailto:${encodeURIComponent(p.email)}`}>
                        {p.email}
                      </a>
                    </p>
                  )}
                  {p.phone && (
                    <p>
                      <a className="underline" href={`tel:${encodeURIComponent(p.phone)}`}>
                        {p.phone}
                      </a>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {!participants.length && <p>{t("emptyParticipants")}</p>}
        </>
      )}
    </section>
  );
}
function ParticipantPhoto({
  orgId,
  sessionId,
  personId,
  asset,
}: {
  orgId: string;
  sessionId: string;
  personId: string;
  asset: SettingsMediaAsset;
}) {
  const t = useTranslations("personalCalendar");
  const load = useCallback(async () => {
    const r = await accountCall("media_get_v1", {
      scope: "lesson_participant",
      org_id: orgId,
      session_id: sessionId,
      person_id: personId,
      asset_id: asset.id,
    });
    if (
      r.asset.id !== asset.id ||
      r.asset.mime !== asset.mime ||
      r.asset.checksum !== asset.checksum ||
      r.asset.bytes !== asset.bytes ||
      asset.bytes > 1048576
    )
      throw Error("INTEGRITY_VIOLATION");
    const bytes = Uint8Array.from(atob(r.data_base64), (c) => c.charCodeAt(0));
    if (bytes.length !== asset.bytes) throw Error("INTEGRITY_VIOLATION");
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    if (hash !== asset.checksum) throw Error("INTEGRITY_VIOLATION");
    return `data:${asset.mime};base64,${r.data_base64}`;
  }, [orgId, sessionId, personId, asset.id, asset.mime, asset.bytes, asset.checksum]);
  const result = useRemote(load, JSON.stringify([orgId, sessionId, personId, asset]));
  return result?.data ? (
    <Image
      unoptimized
      width={48}
      height={48}
      src={result.data}
      alt={t("photo")}
      className="size-12 rounded-full object-cover"
    />
  ) : result?.error ? (
    <FlowError code={result.error} />
  ) : (
    <output>{t("loading")}</output>
  );
}
