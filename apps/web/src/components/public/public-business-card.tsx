"use client";
import Image from "next/image";
import { useTranslations, useFormatter } from "next-intl";
import type { PublicBusinessProfile } from "@ftksaas/api-contracts";
export function PublicBusinessCard({ profile }: { profile: PublicBusinessProfile }) {
  const t = useTranslations("publicSchedule"),
    f = useFormatter();
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4" aria-label={t("businessProfile")}>
      {profile.logo && (
        <Image
          unoptimized
          src={`data:${profile.logo.asset.mime};base64,${profile.logo.data_base64}`}
          alt={profile.name ?? t("businessProfile")}
          width={96}
          height={96}
          className="size-24 object-contain"
        />
      )}
      {profile.name && <h2 className="text-lg font-semibold">{profile.name}</h2>}
      {profile.description && <p className="whitespace-pre-wrap">{profile.description}</p>}
      {profile.address && <p>{profile.address}</p>}
      {profile.contact && (
        <>
          <p>{profile.contact.phone}</p>
          {profile.contact.email && <p>{profile.contact.email}</p>}
        </>
      )}
      {profile.hours && (
        <ul>
          {profile.hours.map((h, i) => (
            <li key={i}>
              {h.weekdays
                .map((d) =>
                  f.dateTime(new Date(Date.UTC(2026, 10, 2 + d - 1)), {
                    weekday: "long",
                    timeZone: "UTC",
                  }),
                )
                .join(", ")}{" "}
              · {h.local_start}–{h.local_end} · {h.timezone}
            </li>
          ))}
        </ul>
      )}
      {profile.timezone && <p>{profile.timezone}</p>}
    </section>
  );
}
