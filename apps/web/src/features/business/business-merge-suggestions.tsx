import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@ftksaas/ui/components/alert";
import { Button, LinkButton } from "@ftksaas/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@ftksaas/ui/components/card";
import type { ClientScope } from "../../lib/scoped-backend";
import { readMergeDirectory } from "../people/merge-directory";

export function BusinessMergeSuggestions({ scope }: { scope: ClientScope }) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: ["business-merge-suggestions", scope],
    queryFn: () => readMergeDirectory(scope, "suggested", "", undefined, 3),
    retry: false,
    gcTime: 0,
  });
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>
          <h2>{t(($) => $.businessCenters.mergeSuggestions.title)}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {query.isPending ? (
          <p role="status">{t(($) => $.platform.loading)}</p>
        ) : query.isError ? (
          <Alert variant="destructive">
            <AlertDescription className="space-y-2">
              <p>{t(($) => $.businessCenters.mergeSuggestions.error)}</p>
              <Button variant="outline" onPress={() => void query.refetch()}>
                {t(($) => $.auth.retry)}
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {query.data.items.length ? (
              <ul className="divide-y">
                {query.data.items.map((row) => (
                  <li key={row.id} className="wrap-anywhere py-2">
                    <p>
                      {row.source.display_name} · {row.target.display_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {row.matching_kinds
                        .map((kind) => t(($) => $.businessCenters.mergeSuggestions.matches[kind]))
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>{t(($) => $.businessCenters.mergeSuggestions.empty)}</p>
            )}
            <LinkButton
              href={`/o/${scope.orgId}/c/${scope.centerId}/people/merge`}
              variant="outline"
            >
              {t(($) => $.businessCenters.mergeSuggestions.open)}
            </LinkButton>
          </>
        )}
      </CardContent>
    </Card>
  );
}
