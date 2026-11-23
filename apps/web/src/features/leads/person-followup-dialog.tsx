import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button } from "@ftksaas/ui/components/button";
import { Dialog, DialogClose, DialogFooter, DialogTitle } from "@ftksaas/ui/components/dialog";
import type { ClientScope } from "../../lib/scoped-backend";
import { readPersonFollowup } from "./leads-read";

export function PersonFollowupDialog({
  scope,
  followup,
  formatDate,
  onClose,
}: {
  scope: ClientScope;
  followup: { id: string; personId: string; name: string };
  formatDate: (instant: string) => string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const activity = useQuery({
    queryKey: ["lead-person-followup", scope, followup.personId, followup.id],
    queryFn: (context) => readPersonFollowup(scope, followup.personId, followup.id, context),
    refetchOnMount: "always",
    retry: false,
  });
  const values = activity.isFetchedAfterMount && !activity.isError ? activity.data?.values : null;
  const unknown = t(($) => $.studio.resourceUnknown);
  return (
    <Dialog isOpen onOpenChange={(open) => !open && onClose()} showCloseButton={false}>
      <DialogTitle>{t(($) => $.leads.followupKinds.automation_followup)}</DialogTitle>
      <p className="break-words font-medium">{followup.name}</p>
      {activity.isError ? (
        <Alert variant="destructive">
          <AlertDescription>
            {t(($) => $.leads.followupReadFailed)}
            <Button
              variant="outline"
              isDisabled={activity.isFetching}
              onPress={() => void activity.refetch()}
            >
              {t(($) => $.auth.retry)}
            </Button>
          </AlertDescription>
        </Alert>
      ) : values ? (
        <dl className="grid gap-3">
          <div>
            <dt className="text-muted-foreground">{t(($) => $.leads.when)}</dt>
            <dd>{values.due_at ? formatDate(values.due_at) : unknown}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{t(($) => $.leads.note)}</dt>
            <dd className="break-words">{values.note || unknown}</dd>
          </div>
          {values.outcome && (
            <div>
              <dt className="text-muted-foreground">{t(($) => $.leads.outcome)}</dt>
              <dd className="break-words">{values.outcome}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p role="status">{t(($) => $.leads.loading)}</p>
      )}
      <DialogFooter>
        <DialogClose variant="outline">{t(($) => $.leads.close)}</DialogClose>
      </DialogFooter>
    </Dialog>
  );
}
