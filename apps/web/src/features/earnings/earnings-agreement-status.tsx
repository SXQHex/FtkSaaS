import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@ftksaas/ui/components/button";
import type { ClientScope } from "../../lib/scoped-backend";
import { readManagedAgreementStatus } from "../instructor/agreement-document";

export function EarningsAgreementStatus({
  scope,
  personId,
  agreementIds,
  locked,
}: {
  scope: ClientScope;
  personId: string;
  agreementIds: string[];
  locked: boolean;
}) {
  const { t } = useTranslation();
  const [requested, setRequested] = useState(false);
  const status = useQuery({
    queryKey: ["earnings-agreement-status", scope, personId, agreementIds],
    enabled: requested,
    queryFn: async ({ signal }) => {
      const rows = [];
      for (const id of agreementIds) {
        signal.throwIfAborted();
        rows.push(await readManagedAgreementStatus(scope, personId, id));
      }
      return rows;
    },
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return (
    <div className="mt-2 space-y-1">
      <Button
        variant="outline"
        size="sm"
        isDisabled={locked}
        isPending={status.isFetching}
        onPress={() => {
          if (requested) void status.refetch();
          else setRequested(true);
        }}
      >
        {requested
          ? t(($) => $.earnings.agreementAcceptance.refresh)
          : t(($) => $.earnings.agreementAcceptance.open)}
      </Button>
      {requested && status.isFetching && (
        <p className="text-xs">{t(($) => $.earnings.agreementAcceptance.loading)}</p>
      )}
      <div role="status" className="text-xs">
        {requested &&
          !status.isFetching &&
          (status.isError ? (
            <p>{t(($) => $.earnings.agreementAcceptance.unavailable)}</p>
          ) : (
            status.data && (
              <ul className="space-y-1">
                {status.data.map((row) => (
                  <li key={row.id}>
                    {t(($) => $.earnings.agreementVersion, { version: row.version })}
                    {" · "}
                    {t(($) => $.earnings.agreementAcceptance.states[row.status])}
                  </li>
                ))}
              </ul>
            )
          ))}
      </div>
    </div>
  );
}
