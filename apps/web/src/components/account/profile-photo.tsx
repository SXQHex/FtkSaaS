"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AccountView, SettingsImageUpload } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { accountCall } from "../../lib/account";

export function ProfilePhoto({
  photo,
  committedPhoto,
  refreshing,
  disabled,
  onSelect,
  onRemove,
  children,
}: {
  photo: AccountView["photo"];
  committedPhoto: SettingsImageUpload | null | undefined;
  refreshing: boolean;
  disabled: boolean;
  onSelect: (file: File) => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("account");
  const input = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<{ id: string; src: string } | null>(null);
  const [failedId, setFailedId] = useState("");
  const [retry, setRetry] = useState(0);
  const assetId = photo?.id;
  useEffect(() => {
    if (!assetId) return;
    let active = true;
    void accountCall("media_get_v1", { scope: "user", asset_id: assetId })
      .then((result) => {
        if (active) {
          setLoaded({ id: assetId, src: `data:${result.asset.mime};base64,${result.data_base64}` });
          setFailedId("");
        }
      })
      .catch(() => {
        if (active) setFailedId(assetId);
      });
    return () => {
      active = false;
    };
  }, [assetId, retry]);
  const savedSrc =
    committedPhoto && `data:${committedPhoto.mime};base64,${committedPhoto.data_base64}`;
  const src =
    refreshing && committedPhoto !== undefined
      ? savedSrc
      : assetId && (loaded?.id === assetId ? loaded.src : savedSrc);
  const hasPhoto = refreshing && committedPhoto !== undefined ? !!committedPhoto : !!assetId;
  const readFailed = !refreshing && !!assetId && failedId === assetId;
  return (
    <div className="space-y-3">
      <div className="relative w-fit">
        <Image
          unoptimized
          src={src || "/images/default-profile.svg"}
          alt={t("photo")}
          width={96}
          height={96}
          className="size-24 rounded-full object-cover"
        />
        <input
          ref={input}
          type="file"
          className="hidden"
          aria-label={t("editPhoto")}
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) onSelect(file);
          }}
        />
        <div className="absolute -bottom-1 -right-2 flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="rounded-full"
            aria-label={t("editPhoto")}
            title={t("editPhoto")}
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            <Pencil aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="rounded-full"
            aria-label={t("removePhoto")}
            title={t("removePhoto")}
            disabled={disabled || !hasPhoto}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      {children}
      {readFailed && (
        <div className="space-y-2">
          <p role="alert" className="text-xs text-destructive">
            {t("photoReadFailed")}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setRetry((n) => n + 1)}>
            {t("retryPhoto")}
          </Button>
        </div>
      )}
    </div>
  );
}
