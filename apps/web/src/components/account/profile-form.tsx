"use client";
import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import type { AccountView, SettingsImageUpload } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { Label } from "@ftksaas/ui/components/label";
import { accountCall, imageUpload } from "../../lib/account";
import { CommandFeedback, useAccountCommand } from "./account-command";

export function ProfileForm({
  account,
  version,
  onSaved,
}: {
  account: AccountView;
  version: number;
  onSaved: () => void;
}) {
  const t = useTranslations("account");
  const command = useAccountCommand(account.id, "profile", onSaved);
  const [photo, setPhoto] = useState<SettingsImageUpload | null | undefined>();
  const [image, setImage] = useState("");
  const [imageError, setImageError] = useState(false);
  const [reading, setReading] = useState(false);
  useEffect(() => {
    let active = true;
    if (account.photo)
      void accountCall("media_get_v1", { scope: "user", asset_id: account.photo.id })
        .then((result) => {
          if (active) setImage(`data:${result.asset.mime};base64,${result.data_base64}`);
        })
        .catch(() => {
          if (active) setImageError(true);
        });
    return () => {
      active = false;
    };
  }, [account.photo]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
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
              unverified_phone: String(data.get("unverified_phone")).trim() || null,
            }
          : {}),
        ...(photo !== undefined ? { photo } : {}),
      },
    });
  }
  return (
    <section aria-labelledby="profile-heading" className="space-y-5">
      <h2 id="profile-heading" className="text-xl font-semibold">
        {t("profile")}
      </h2>
      <p className="text-sm text-muted-foreground">{t("profileHint")}</p>
      {image && (
        <Image
          unoptimized
          src={image}
          alt={t("photo")}
          width={80}
          height={80}
          className="size-20 rounded-full object-cover"
        />
      )}
      {imageError && <p role="alert">{t("imageInvalid")}</p>}
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={command.busy || !!command.pending || reading} className="space-y-5">
          {(["display_name", "given_name", "family_name", "unverified_phone"] as const)
            .filter((name) => name === "display_name" || !!account.identity)
            .map((name) => (
              <div key={name} className="space-y-2">
                <Label htmlFor={name}>{t(name)}</Label>
                <Input
                  id={name}
                  name={name}
                  defaultValue={
                    name === "display_name"
                      ? account.display_name
                      : (account.identity?.[name] ?? "")
                  }
                  required={name === "display_name"}
                  maxLength={name === "unverified_phone" ? 16 : 100}
                  pattern={name === "unverified_phone" ? "\\+[1-9][0-9]{7,14}" : undefined}
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
          <div className="space-y-2">
            <Label htmlFor="photo">{t("photo")}</Label>
            <Input
              id="photo"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setReading(true);
                setImageError(false);
                try {
                  setPhoto(await imageUpload(file));
                } catch {
                  setImageError(true);
                  setPhoto(undefined);
                } finally {
                  setReading(false);
                }
              }}
            />
            <p className="text-xs text-muted-foreground">{t("photoHint")}</p>
            {photo !== undefined && (
              <output className="block" aria-live="polite">
                {t(photo === null ? "photoRemoval" : "photoSelected")}
              </output>
            )}
            <Button type="button" variant="outline" onClick={() => setPhoto(null)}>
              {t("removePhoto")}
            </Button>
          </div>
          <Button type="submit">{t("saveProfile")}</Button>
        </fieldset>
      </form>
      <CommandFeedback command={command} />
    </section>
  );
}
