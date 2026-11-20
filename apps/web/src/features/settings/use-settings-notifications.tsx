import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SettingsDocumentSource } from "./settings-document";
import type { SettingsViewData } from "./settings-view";
import { TemplateSheet } from "./template-sheet";
import { Button } from "@ftksaas/ui/components/button";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
export function useSettingsNotifications(
  source: SettingsDocumentSource | undefined,
  visible: boolean,
  locked: boolean,
) {
  const { t } = useTranslation();
  const [channel, setChannel] = useState<"in_app" | "email" | "push">();
  const delivery = source?.catalog.notification_delivery;
  const fields: NonNullable<SettingsViewData["fields"]> = delivery
    ? {
        "ay-c-app": { value: delivery.channels.in_app, writable: false },
        "ay-c-mail": { value: delivery.channels.email, writable: false },
        "ay-c-sms": { value: false, writable: false },
        "ay-c-wa": { value: false, writable: false },
      }
    : {};
  const table: NonNullable<SettingsViewData["tables"]>["sablon"] = delivery
    ? {
        columns: ["template", "kind", "state", "action"],
        rows: (["in_app", "email", "push"] as const).map((key) => ({
          id: key,
          cells: [
            t(($) => $.settings.notificationNative.systemContent),
            t(($) => $.settings.notificationNative.channels[key]),
            delivery.channels[key]
              ? t(($) => $.settings.notificationNative.available)
              : t(($) => $.settings.notificationNative.unavailable),
            <Button
              key="detail"
              variant="outline"
              size="sm"
              isDisabled={locked}
              onPress={() => setChannel(key)}
            >
              {t(($) => $.settings.notificationNative.details)}
            </Button>,
          ],
        })),
      }
    : undefined;
  return {
    fields,
    table,
    notice: visible ? (
      <Alert>
        <AlertDescription>{t(($) => $.settings.notificationNative.boundary)}</AlertDescription>
      </Alert>
    ) : null,
    dialog:
      channel && source ? (
        <TemplateSheet
          open
          title={t(($) => $.settings.notificationNative.channels[channel])}
          description={t(($) => $.settings.notificationNative.platformContent)}
          draft={{ subject: "", body: "" }}
          variables={null}
          preview={null}
          writable={false}
          locked={locked}
          stateLabel={
            delivery?.channels[channel]
              ? t(($) => $.settings.notificationNative.available)
              : t(($) => $.settings.notificationNative.unavailable)
          }
          notice={t(($) => $.settings.notificationNative.platformContent)}
          onClose={() => setChannel(undefined)}
        />
      ) : null,
  };
}
