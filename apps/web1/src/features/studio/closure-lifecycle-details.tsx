import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "../../components/ui/button";
import { StudioSheets } from "./studio-sheets";
import { ResourceLifecycleController } from "./resource-lifecycle-controller";
import type { ClosureRecord } from "./studio-reads";
import type { StudioScope } from "./studio";
import type { StudioViewData } from "./studio-view";

export function ClosureLifecycleDetails({
  scope,
  record,
  data,
  timezone,
  onClose,
  onRefresh,
  onLockChange,
}: {
  scope: StudioScope;
  record: ClosureRecord;
  data: StudioViewData;
  timezone?: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onLockChange: (value: boolean) => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  if (confirming)
    return (
      <ResourceLifecycleController
        scope={scope}
        selection={{
          kind: "closure",
          id: record.id,
          resource: record.resource,
          label:
            data.closures.find((item) => item.id === record.id)?.scope ??
            t(($) => $.studio.unavailableResource),
        }}
        timezone={timezone}
        onClose={onClose}
        onRefresh={onRefresh}
        onLockChange={onLockChange}
      />
    );
  return (
    <StudioSheets
      selection={{ kind: "closure", id: record.id }}
      data={data}
      onClose={onClose}
      footerActions={
        <Button
          variant="destructive"
          isDisabled={record.state !== "active"}
          onPress={() => setConfirming(true)}
        >
          {t(($) => $.studio.lifecycle.cancelClosure)}
        </Button>
      }
    />
  );
}
