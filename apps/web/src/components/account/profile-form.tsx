"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { AccountView, SettingsImageUpload } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { AccountField } from "./account-field";
import { normalizePhone } from "../../lib/phone";
import { imageUpload } from "../../lib/account";
import { CommandFeedback, useAccountCommand } from "./account-command";
import { ProfilePhoto } from "./profile-photo";

const fields = ["display_name", "given_name", "family_name", "unverified_phone"] as const;
function profileValues(account: AccountView) {
  return {
    display_name: account.display_name,
    given_name: account.identity?.given_name ?? "",
    family_name: account.identity?.family_name ?? "",
    unverified_phone: account.identity?.unverified_phone ?? "",
  };
}

export function ProfileForm({
  account,
  version,
  readRevision,
  onSaved,
}: {
  account: AccountView;
  version: number;
  readRevision: number;
  onSaved: () => number;
}) {
  const t = useTranslations("account");
  const [values, setValues] = useState(() => profileValues(account));
  const baseline = useRef(values);
  useEffect(() => {
    const incoming = profileValues(account);
    const previous = baseline.current;
    baseline.current = incoming;
    setValues((current) => {
      let next = current;
      for (const name of fields)
        if (current[name] === previous[name] && current[name] !== incoming[name])
          next = { ...next, [name]: incoming[name] };
      return next;
    });
  }, [account]);
  const [committed, setCommitted] = useState<{
    readRevision: number;
    photo: SettingsImageUpload | null | undefined;
  } | null>(null);
  const command = useAccountCommand(account.id, "profile", (completed) => {
    if (completed.operation !== "account_profile_update_v1") return;
    const input = completed.input;
    setCommitted({ readRevision: onSaved(), photo: input.photo });
    if (input.photo === undefined) {
      setValues((previous) => ({
        display_name: input.display_name,
        given_name: input.given_name === undefined ? previous.given_name : (input.given_name ?? ""),
        family_name:
          input.family_name === undefined ? previous.family_name : (input.family_name ?? ""),
        unverified_phone:
          input.unverified_phone === undefined
            ? previous.unverified_phone
            : (input.unverified_phone ?? ""),
      }));
    }
  });
  const [photoAction, setPhotoAction] = useState<"upload" | "remove" | null>(() => {
    const pending = command.pending;
    if (
      !pending ||
      pending === "invalid" ||
      pending.command.operation !== "account_profile_update_v1"
    )
      return null;
    const photo = pending.command.input.photo;
    return photo === undefined ? null : photo === null ? "remove" : "upload";
  });
  const [imageError, setImageError] = useState(false);
  const [reading, setReading] = useState(false);
  const readingLock = useRef(false);
  const [phoneError, setPhoneError] = useState("");
  // Wait for a successful re-read, including replays that keep the same version.
  const refreshing = !!committed && readRevision < committed.readRevision;
  const disabled = command.busy || !!command.pending || reading || refreshing;
  async function savePhoto(file: File | null) {
    if (disabled || readingLock.current) return;
    readingLock.current = true;
    setReading(true);
    setImageError(false);
    setPhotoAction(file ? "upload" : "remove");
    let photo: SettingsImageUpload | null;
    try {
      photo = file ? await imageUpload(file) : null;
    } catch {
      setImageError(true);
      setReading(false);
      readingLock.current = false;
      return;
    }
    await command.run({
      operation: "account_profile_update_v1",
      input: {
        operation_key: v7(),
        expected_version: version,
        display_name: account.display_name,
        photo,
      },
    });
    setReading(false);
    readingLock.current = false;
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || readingLock.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const input = String(data.get("unverified_phone") ?? "").trim();
    const phone = input ? normalizePhone(input) : null;
    if (account.identity && phone === undefined) {
      setPhoneError(t("fieldPhone"));
      form.querySelector<HTMLInputElement>('[name="unverified_phone"]')?.focus();
      return;
    }
    setPhoneError("");
    setImageError(false);
    setPhotoAction(null);
    await command.run({
      operation: "account_profile_update_v1",
      input: {
        operation_key: v7(),
        expected_version: version,
        display_name: String(data.get("display_name")).trim(),
        ...(account.identity
          ? {
              given_name: String(data.get("given_name")).trim() || null,
              family_name: String(data.get("family_name")).trim() || null,
              unverified_phone: phone,
            }
          : {}),
      },
    });
  }
  return (
    <section aria-labelledby="profile-heading" className="space-y-5">
      <h2 id="profile-heading" className="text-xl font-semibold">
        {t("profile")}
      </h2>
      <ProfilePhoto
        photo={account.photo}
        committedPhoto={committed?.photo}
        refreshing={refreshing}
        disabled={disabled}
        onSelect={(file) => void savePhoto(file)}
        onRemove={() => void savePhoto(null)}
      >
        {photoAction && (reading || command.busy) ? (
          <output className="block text-sm" aria-live="polite">
            {t(photoAction === "remove" ? "photoRemoving" : "photoUploading")}
          </output>
        ) : imageError ? (
          <p role="alert" className="text-xs text-destructive">
            {t("imageInvalid")}
          </p>
        ) : photoAction ? (
          <CommandFeedback
            command={command}
            successMessage={photoAction === "remove" ? "photoRemoved" : "photoSaved"}
          />
        ) : null}
      </ProfilePhoto>
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={disabled} className="space-y-5">
          {fields
            .filter((name) => name === "display_name" || !!account.identity)
            .map((name) => (
              <div key={name} className="space-y-2">
                <AccountField
                  label={t(name)}
                  id={name}
                  name={name}
                  value={values[name]}
                  placeholder={name === "unverified_phone" ? "05xx xxx xx xx" : t(name)}
                  type={name === "unverified_phone" ? "tel" : "text"}
                  error={name === "unverified_phone" ? phoneError : undefined}
                  onChange={(event) => {
                    setValues({ ...values, [name]: event.currentTarget.value });
                    if (name === "unverified_phone") setPhoneError("");
                  }}
                  required={name === "display_name"}
                  maxLength={name === "unverified_phone" ? undefined : 100}
                  autoComplete={
                    name === "given_name"
                      ? "given-name"
                      : name === "family_name"
                        ? "family-name"
                        : name === "unverified_phone"
                          ? "tel"
                          : "nickname"
                  }
                />
              </div>
            ))}
          <Button type="submit">{t("saveProfile")}</Button>
        </fieldset>
      </form>
      {!photoAction && <CommandFeedback command={command} />}
    </section>
  );
}
