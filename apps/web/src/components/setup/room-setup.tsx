"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { ManagementStateView } from "@ftksaas/api-contracts";
import { Button } from "@ftksaas/ui/components/button";
import { getRooms, setupError, type SetupScope } from "../../lib/studio-setup";
import { errorKey } from "./setup-command";
import { RoomCreate } from "./source-forms";
import { AvailabilityEditor } from "./availability-editor";

export function RoomSetup({ scope, onChanged }: { scope: SetupScope; onChanged: () => void }) {
  const t = useTranslations("setup");
  const [rooms, setRooms] = useState<ManagementStateView[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    void getRooms(scope.orgId, scope.centerId!)
      .then((rows) => {
        if (active) {
          setRooms(rows);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) {
          setRooms(null);
          setError(errorKey(setupError(cause)));
        }
      });
    return () => {
      active = false;
    };
  }, [scope.orgId, scope.centerId, retry]);
  function refresh() {
    setRooms(null);
    setError("");
    setRetry((n) => n + 1);
  }
  function saved() {
    refresh();
    onChanged();
  }
  return (
    <section className="space-y-4" aria-label={t("roomTitle")}>
      <h3 className="text-lg font-semibold">{t("roomTitle")}</h3>
      <Button variant="outline" onClick={refresh}>
        {t("refresh")}
      </Button>
      {error && <p role="alert">{t(error)}</p>}
      {!rooms && !error && <output aria-live="polite">{t("loading")}</output>}
      {rooms && (
        <>
          {rooms.length === 0 && <p>{t("noRooms")}</p>}
          {rooms.map((room) => (
            <details
              key={`${room.entity?.id}:${room.versions.map((v) => v.version).join(":")}`}
              className="space-y-4 rounded-lg border p-4"
            >
              <summary className="cursor-pointer font-medium">
                {room.current?.operation === "room_save_v1"
                  ? room.current.values.name
                  : t("unreadableRoom")}
              </summary>
              <RoomCreate scope={scope} room={room} onSaved={saved} />
              {room.entity && (
                <AvailabilityEditor scope={scope} resource={{ kind: "room", id: room.entity.id }} />
              )}
            </details>
          ))}
          <details className="space-y-4 rounded-lg border p-4">
            <summary className="cursor-pointer font-medium">{t("createRoom")}</summary>
            <RoomCreate scope={scope} onSaved={saved} />
          </details>
        </>
      )}
    </section>
  );
}
