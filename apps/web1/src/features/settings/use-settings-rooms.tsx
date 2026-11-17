import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { readStudioResources } from "../studio/studio";
import { StudioResourceEditor } from "../studio/resource-editor";
import type { ClientScope } from "../../lib/scoped-backend";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Alert, AlertDescription } from "../../components/ui/alert";
import type { SettingsTableData } from "./settings-view";

/** Reuse the accepted room writer and its conflict/unknown/ACK recovery. */
export function useSettingsRooms({
  scope,
  enabled,
  readOnly,
  locked,
  onLockChange,
  onAccessLost,
}: {
  scope: ClientScope;
  enabled: boolean;
  readOnly: boolean;
  locked: boolean;
  onLockChange: (value: boolean) => void;
  onAccessLost: (cause: unknown) => boolean;
}) {
  const { t } = useTranslation(),
    queries = useQueryClient();
  const [selection, setSelection] = useState<{ id?: string }>();
  const query = useQuery({
    queryKey: ["settings-rooms", scope.accountId, scope.orgId, scope.centerId],
    queryFn: () => readStudioResources(scope),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  useEffect(() => {
    if (query.error) onAccessLost(query.error);
  }, [query.error, onAccessLost]);
  const source = enabled && !query.isError && !query.isFetching ? query.data : undefined;
  const canWrite = !!source && !readOnly;
  const table: SettingsTableData | undefined = source
    ? {
        columns: ["room", "capacity", "futureOperations", "active", "action"],
        rows: source.rooms.map((room) => ({
          id: room.id,
          cells: [
            room.name,
            room.capacity ?? t(($) => $.settings.unknown),
            room.effects?.count ?? t(($) => $.settings.unknown),
            <Badge key="state" variant={room.active ? "secondary" : "outline"}>
              {room.active ? t(($) => $.settings.on) : t(($) => $.settings.off)}
            </Badge>,
            <Button
              key="edit"
              variant="outline"
              size="sm"
              isDisabled={locked || !canWrite}
              onPress={() => setSelection({ id: room.id })}
            >
              {t(($) => $.settings.disciplineStatus.edit)}
            </Button>,
          ],
        })),
      }
    : undefined;
  async function refresh() {
    const result = await query.refetch();
    if (result.error) throw result.error;
    if (!result.data) throw Error("STUDIO_UNAVAILABLE");
    await queries.invalidateQueries(
      { queryKey: ["studio", scope.accountId, scope.orgId] },
      { throwOnError: true },
    );
    return result.data;
  }
  return {
    table,
    canCreate: canWrite,
    create: () => {
      if (canWrite && !locked) setSelection({});
    },
    notice:
      enabled && query.isError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>
            {t(($) => $.studio.resourceReadError)}{" "}
            <Button
              variant="outline"
              isDisabled={locked || query.isFetching}
              onPress={() => {
                void query.refetch();
              }}
            >
              {t(($) => $.auth.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null,
    editor:
      enabled && selection && query.data && (!readOnly || locked) ? (
        <StudioResourceEditor
          key={`${scope.accountId}:${scope.orgId}:${scope.centerId}:${selection.id ?? "new"}`}
          scope={scope}
          selection={{ kind: "room", ...selection }}
          resources={query.data}
          onRefresh={refresh}
          onClose={() => {
            if (!locked) setSelection(undefined);
          }}
          onLockChange={onLockChange}
        />
      ) : null,
  };
}
