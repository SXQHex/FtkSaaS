"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@ftksaas/ui/components/button";
import { WorkspaceScope, type WorkspaceStudios } from "../workspace-scope";
import { ReportPanel } from "./report-panel";
import { ImportPanel } from "./import-panel";
import type { SetupScope } from "../../lib/studio-setup";
export function ReportsWorkspace({
  actorId,
  studios,
}: {
  actorId: string;
  studios: WorkspaceStudios;
}) {
  return (
    <WorkspaceScope actorId={actorId} studios={studios}>
      {(scope, timeZone) => <ReportsHome scope={scope} timeZone={timeZone} />}
    </WorkspaceScope>
  );
}
function ReportsHome({ scope: initialScope, timeZone }: { scope: SetupScope; timeZone: string }) {
  const [scope] = useState(initialScope),
    t = useTranslations("reports"),
    [tab, setTab] = useState("report");
  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap gap-2">
        <Button variant={tab === "report" ? "default" : "outline"} onClick={() => setTab("report")}>
          {t("title")}
        </Button>
        <Button variant={tab === "import" ? "default" : "outline"} onClick={() => setTab("import")}>
          {t("import")}
        </Button>
      </div>
      {tab === "report" ? (
        <ReportPanel scope={scope} timeZone={timeZone} />
      ) : (
        <ImportPanel scope={scope} />
      )}
    </div>
  );
}
