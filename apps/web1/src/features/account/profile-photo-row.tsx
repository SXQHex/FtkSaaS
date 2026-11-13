import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { SettingsMediaAsset } from "../../lib/api-contracts/generated";
import { Avatar, AvatarFallback, AvatarImage } from "../../components/ui/avatar";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { FieldDescription, FieldError } from "../../components/ui/field";
import { preparePhoto, readPhoto, type PhotoDraft } from "./profile-photo";

export function BlobAvatar({ blob, initials }: { blob?: Blob; initials: string }) {
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    if (!blob || !element) return;
    const url = URL.createObjectURL(blob);
    element.src = url;
    return () => {
      element.removeAttribute("src");
      URL.revokeObjectURL(url);
    };
  }, [blob]);
  return (
    <Avatar size="photo">
      {blob && <AvatarImage ref={image} alt="" />}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}
function CurrentPhoto({
  accountId,
  asset,
  initials,
}: {
  accountId: string;
  asset: SettingsMediaAsset;
  initials: string;
}) {
  const { t } = useTranslation();
  const photo = useQuery({
    queryKey: ["account-photo", accountId, asset.id],
    queryFn: () => readPhoto(asset),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return (
    <>
      <BlobAvatar
        key={asset.id}
        blob={photo.isError ? undefined : photo.data}
        initials={initials}
      />
      {photo.isError && (
        <FieldError role="alert">
          {t(($) => $.photo.readError)}{" "}
          <Button
            variant="outline"
            size="sm"
            onPress={() => {
              void photo.refetch();
            }}
          >
            {t(($) => $.auth.retry)}
          </Button>
        </FieldError>
      )}
    </>
  );
}
export function ProfilePhotoRow({
  accountId,
  asset,
  name,
  draft,
  onChange,
  disabled,
  onBusy,
}: {
  accountId: string;
  asset?: SettingsMediaAsset | null;
  name: string;
  draft: PhotoDraft;
  onChange: (draft: PhotoDraft) => void;
  disabled: boolean;
  onBusy: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("");
  async function select(file: File) {
    onBusy(true);
    setError("");
    try {
      onChange({ upload: await preparePhoto(file), file });
    } catch (reason) {
      setError(
        reason instanceof Error && reason.message === "PHOTO_SIZE"
          ? t(($) => $.photo.sizeError)
          : reason instanceof Error && reason.message === "PHOTO_TYPE"
            ? t(($) => $.photo.typeError)
            : t(($) => $.photo.fileError),
      );
    } finally {
      onBusy(false);
    }
  }
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b pb-4">
      {draft === undefined && asset ? (
        <CurrentPhoto accountId={accountId} asset={asset} initials={initials} />
      ) : (
        <BlobAvatar
          key={draft?.upload.checksum ?? "empty"}
          blob={draft?.file}
          initials={initials}
        />
      )}
      <Input
        ref={input}
        type="file"
        className="hidden"
        accept="image/png,image/jpeg,image/webp"
        aria-label={t(($) => $.photo.upload)}
        aria-describedby="profile-photo-hint"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void select(file);
        }}
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          isDisabled={disabled}
          onPress={() => input.current?.click()}
        >
          {t(($) => $.photo.upload)}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          isDisabled={disabled || !(draft || (draft === undefined && asset))}
          onPress={() => {
            setError("");
            onChange(asset ? null : undefined);
          }}
        >
          {t(($) => $.photo.remove)}
        </Button>
      </div>
      <FieldDescription variant="hint" id="profile-photo-hint">
        {t(($) => $.photo.hint)}
      </FieldDescription>
      {error && <FieldError role="alert">{error}</FieldError>}
    </div>
  );
}
