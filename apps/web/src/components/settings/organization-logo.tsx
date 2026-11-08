"use client";
import Image from "next/image";
import { useCallback, useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { v7 } from "uuid";
import { Button } from "@ftksaas/ui/components/button";
import { Input } from "@ftksaas/ui/components/input";
import { type SetupScope, type SetupCommand } from "../../lib/studio-setup";
import { imageUpload, accountCall } from "../../lib/account";
import { mediaAssetId } from "../../lib/settings-media";
import { useRemote } from "../../lib/use-remote";
import { SetupFeedback, useSetupCommand } from "../setup/setup-command";
import { ConfirmWrite, FlowError, flowError } from "../bookings/flow-controls";
export function OrganizationLogo({
  scope,
  version,
  asset,
  onSaved,
}: {
  scope: SetupScope;
  version: number;
  asset: unknown;
  onSaved: () => void;
}) {
  const t = useTranslations("settingsEditor"),
    id = mediaAssetId(asset),
    live = useRef(true),
    [review, setReview] = useState<SetupCommand | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [previewImage, setPreviewImage] = useState<Awaited<ReturnType<typeof imageUpload>> | null>(
      null,
    );
  const command = useSetupCommand(scope, "settings-media:organization", onSaved);
  const load = useCallback(async () => {
      if (!id) return null;
      const p = await accountCall("media_get_v1", {
        scope: "organization",
        org_id: scope.orgId,
        asset_id: id,
      });
      if (p.asset.id !== id) throw Error("invalidSettings");
      return p;
    }, [scope, id]),
    result = useRemote(load, JSON.stringify([scope, id]));
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const disabled = busy || command.busy || !!command.pending;
  function prepare(image: Awaited<ReturnType<typeof imageUpload>> | null) {
    setPreviewImage(image);
    setReview({
      operation: "settings_update_v1",
      input: {
        scope: "organization",
        org_id: scope.orgId,
        operation_key: v7(),
        expected_version: version,
        patch: {},
        logo_image: image,
        reason: t("logo"),
      },
    });
  }
  return (
    <section className="space-y-3 border-t pt-4" aria-label={t("logo")}>
      <h4>{t("logo")}</h4>
      <SetupFeedback command={command} />
      {error && <FlowError code={error} />}
      {result?.error && <FlowError code={result.error} />}
      {result?.data && (
        <Image
          unoptimized
          alt={t("logo")}
          width={96}
          height={96}
          className="size-24 object-contain"
          src={`data:${result.data.asset.mime};base64,${result.data.data_base64}`}
        />
      )}
      <label className="block">
        {t("uploadLogo")}
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={disabled}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            setReview(null);
            if (!file || disabled) return;
            setBusy(true);
            setError("");
            try {
              const image = await imageUpload(file);
              if (live.current) prepare(image);
            } catch (e) {
              if (live.current) setError(flowError(e));
            } finally {
              if (live.current) setBusy(false);
            }
          }}
        />
      </label>
      <Button variant="outline" disabled={disabled || !id} onClick={() => prepare(null)}>
        {t("removeLogo")}
      </Button>
      {review && !command.pending && (
        <ConfirmWrite command={review} controller={command} onBack={() => setReview(null)}>
          <p>{t("logoHint")}</p>
          {previewImage && (
            <Image
              unoptimized
              width={96}
              height={96}
              alt={t("logo")}
              className="size-24 object-contain"
              src={`data:${previewImage.mime};base64,${previewImage.data_base64}`}
            />
          )}
        </ConfirmWrite>
      )}
    </section>
  );
}
