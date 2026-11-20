import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { UploadIcon, FileTextIcon } from "lucide-react";
import type { DocumentGate } from "@ftksaas/api-contracts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@ftksaas/ui/components/card";
import { Button } from "@ftksaas/ui/components/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@ftksaas/ui/components/tabs";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@ftksaas/ui/components/table";
import { Badge } from "@ftksaas/ui/components/badge";
import { Progress } from "@ftksaas/ui/components/progress";
import { Avatar, AvatarFallback } from "@ftksaas/ui/components/avatar";
import { Empty, EmptyDescription } from "@ftksaas/ui/components/empty";
import { ToggleGroup, ToggleGroupItem } from "@ftksaas/ui/components/toggle-group";
export interface DocumentRow {
  id: string;
  name: string;
  gates?: DocumentGate[];
  version?: string;
  publishedAt?: string;
  state: "published" | "draft" | "expired" | "uploading" | "inactive" | "unavailable";
  acceptance?: { accepted: number; total: number };
}
export interface DocumentAcceptanceRow {
  id: string;
  name: string;
  initials: string;
  document: string;
  requiredVersion: string;
  state: "accepted" | "old" | "pending" | "recorded" | "invalidated";
  context?: string;
  evidenceMatches?: boolean | null;
  acceptedVersion?: string;
}
export function DocumentsView({
  documents,
  acceptances,
  tab,
  onTab,
  filter,
  onFilter,
  summary,
  pendingCount,
  onAdd,
  onOpen,
  notice,
  pagination,
  locked = false,
  acceptancePrompt,
  contentCatalog,
  loading = false,
}: {
  documents: DocumentRow[] | null;
  acceptances: DocumentAcceptanceRow[] | null;
  tab: "documents" | "acceptance" | "catalog";
  onTab: (value: "documents" | "acceptance" | "catalog") => void;
  filter: "pending" | "all";
  onFilter: (value: "pending" | "all") => void;
  summary: {
    published: string | null;
    draft: string | null;
    pending: string | null;
    lastPublished: string | null;
  };
  pendingCount?: string;
  onAdd: () => void;
  onOpen?: (id: string) => void;
  notice?: ReactNode;
  pagination?: ReactNode;
  locked?: boolean;
  acceptancePrompt?: string;
  contentCatalog?: ReactNode;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const unknown = t(($) => $.documents.unknown);
  return (
    <div className="flex min-w-0 flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t(($) => $.documents.title)}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t(($) => $.documents.description)}</p>
        </div>
        <Button isDisabled={locked} onPress={onAdd}>
          <UploadIcon data-icon="inline-start" />
          {t(($) => $.documents.add)}
        </Button>
      </header>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {(["published", "draft", "pending", "lastPublished"] as const).map((key) => (
          <Card key={key} className="min-w-0">
            <CardHeader>
              <CardDescription>{t(($) => $.documents.metrics[key])}</CardDescription>
              <CardTitle className="text-2xl tabular-nums wrap-anywhere">
                {summary[key] ?? unknown}
              </CardTitle>
              <CardDescription>{t(($) => $.documents.metricHints[key])}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
      {notice}
      <Card className="min-w-0">
        <Tabs
          selectedKey={tab}
          onSelectionChange={(key) => {
            if (!locked && (key === "documents" || key === "acceptance" || key === "catalog"))
              onTab(key);
          }}
        >
          <CardHeader className="flex flex-wrap items-center justify-between gap-3">
            <TabsList aria-label={t(($) => $.documents.tabsLabel)} variant="line">
              <TabsTrigger id="documents" isDisabled={locked}>
                {t(($) => $.documents.title)}
              </TabsTrigger>
              <TabsTrigger id="acceptance" isDisabled={locked}>
                {t(($) => $.documents.acceptanceTab)}{" "}
                {pendingCount !== undefined && <Badge variant="secondary">{pendingCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger id="catalog" isDisabled={locked}>
                {t(($) => $.documents.contentCatalog.title)}
              </TabsTrigger>
            </TabsList>
            {tab === "acceptance" && (
              <ToggleGroup
                aria-label={t(($) => $.documents.filterLabel)}
                selectionMode="single"
                disallowEmptySelection
                selectedKeys={[filter]}
                onSelectionChange={(keys) => {
                  const key = [...keys][0];
                  if (!locked && (key === "pending" || key === "all")) onFilter(key);
                }}
                variant="segmented"
              >
                <ToggleGroupItem id="pending" isDisabled={locked}>
                  {t(($) => $.documents.filters.pending)}
                </ToggleGroupItem>
                <ToggleGroupItem id="all" isDisabled={locked}>
                  {t(($) => $.documents.filters.all)}
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          </CardHeader>
          <TabsContent id="documents">
            <CardContent className="min-w-0">
              {documents === null ? (
                <p role="status">
                  {loading ? t(($) => $.documents.loading) : t(($) => $.documents.documentsUnread)}
                </p>
              ) : (
                <div
                  role="region"
                  tabIndex={0}
                  aria-label={t(($) => $.documents.title)}
                  className="min-w-0 focus-visible:outline-2 focus-visible:outline-ring [&_[data-slot=table-container]]:max-h-[min(65dvh,36rem)]"
                >
                  <Table aria-label={t(($) => $.documents.title)} className="min-w-[43rem]">
                    <TableHeader className="sticky top-0 z-20 bg-card">
                      <TableHead isRowHeader className="sticky start-0 z-30 bg-card">
                        {t(($) => $.documents.columns.document)}
                      </TableHead>
                      <TableHead>{t(($) => $.documents.columns.gates)}</TableHead>
                      <TableHead>{t(($) => $.documents.columns.version)}</TableHead>
                      <TableHead>{t(($) => $.documents.columns.published)}</TableHead>
                      <TableHead>{t(($) => $.documents.columns.acceptance)}</TableHead>
                      <TableHead>{t(($) => $.documents.columns.state)}</TableHead>
                    </TableHeader>
                    <TableBody
                      renderEmptyState={() => (
                        <Empty>
                          <EmptyDescription>
                            {t(($) => $.documents.emptyDocuments)}
                          </EmptyDescription>
                        </Empty>
                      )}
                    >
                      {documents.map((row) => (
                        <TableRow
                          key={row.id}
                          id={row.id}
                          onAction={() => {
                            if (!locked) onOpen?.(row.id);
                          }}
                          className="cursor-pointer"
                        >
                          <TableCell className="sticky start-0 z-10 bg-card">
                            <span className="flex items-center gap-2">
                              <FileTextIcon aria-hidden="true" className="size-4 shrink-0" />
                              <span className="font-medium">{row.name}</span>
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="flex flex-wrap gap-1">
                              {row.gates?.map((gate) => (
                                <Badge variant="secondary" key={gate}>
                                  {t(($) => $.documents.gates[gate])}
                                </Badge>
                              ))}
                              {row.gates === undefined && (
                                <span className="text-xs text-muted-foreground">
                                  {t(($) => $.documents.metadataOnly)}
                                </span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums">{row.version ?? unknown}</TableCell>
                          <TableCell className="tabular-nums">
                            {row.publishedAt ?? unknown}
                          </TableCell>
                          <TableCell>
                            {row.acceptance ? (
                              <div className="flex min-w-24 items-center gap-2">
                                {row.acceptance.total > 0 && (
                                  <Progress
                                    aria-label={t(($) => $.documents.acceptanceProgress, {
                                      name: row.name,
                                    })}
                                    value={row.acceptance.accepted}
                                    maxValue={row.acceptance.total}
                                    className="min-w-12 flex-1"
                                  />
                                )}
                                <span className="text-xs whitespace-nowrap tabular-nums">
                                  {row.acceptance.accepted.toLocaleString("tr-TR")} /{" "}
                                  {row.acceptance.total.toLocaleString("tr-TR")}
                                </span>
                              </div>
                            ) : (
                              unknown
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.state === "draft" ? "secondary" : "outline"}>
                              {t(($) => $.documents.states[row.state])}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t(($) => $.documents.historyHint)}</p>
              {pagination}
            </CardFooter>
          </TabsContent>
          <TabsContent id="acceptance">
            <CardContent className="min-w-0">
              {acceptances === null ? (
                <p role="status">
                  {acceptancePrompt ??
                    (loading
                      ? t(($) => $.documents.loading)
                      : t(($) => $.documents.acceptanceUnread))}
                </p>
              ) : (
                <div
                  role="region"
                  tabIndex={0}
                  aria-label={t(($) => $.documents.acceptanceTab)}
                  className="min-w-0 focus-visible:outline-2 focus-visible:outline-ring [&_[data-slot=table-container]]:max-h-[min(65dvh,36rem)]"
                >
                  <Table aria-label={t(($) => $.documents.acceptanceTab)} className="min-w-[37rem]">
                    <TableHeader className="sticky top-0 z-20 bg-card">
                      <TableHead isRowHeader className="sticky start-0 z-30 bg-card">
                        {t(($) => $.documents.columns.member)}
                      </TableHead>
                      <TableHead>{t(($) => $.documents.columns.document)}</TableHead>
                      <TableHead>{t(($) => $.documents.columns.requiredVersion)}</TableHead>
                      <TableHead>{t(($) => $.documents.columns.state)}</TableHead>
                    </TableHeader>
                    <TableBody
                      renderEmptyState={() => (
                        <Empty>
                          <EmptyDescription>
                            {t(($) => $.documents.emptyAcceptances)}
                          </EmptyDescription>
                        </Empty>
                      )}
                    >
                      {acceptances.map((row) => (
                        <TableRow key={row.id} id={row.id}>
                          <TableCell className="sticky start-0 z-10 bg-card">
                            <span className="flex items-center gap-2">
                              <Avatar size="sm">
                                <AvatarFallback>{row.initials}</AvatarFallback>
                              </Avatar>
                              <span>
                                {row.name}
                                {row.context && (
                                  <span className="mt-1 block text-xs text-muted-foreground">
                                    {row.context}
                                  </span>
                                )}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell>{row.document}</TableCell>
                          <TableCell className="tabular-nums">{row.requiredVersion}</TableCell>
                          <TableCell>
                            <Badge variant={row.state === "pending" ? "destructive" : "secondary"}>
                              {row.state === "old"
                                ? t(($) => $.documents.oldVersion, {
                                    version: row.acceptedVersion ?? unknown,
                                  })
                                : row.state === "accepted"
                                  ? t(($) => $.documents.acceptanceStates.accepted)
                                  : row.state === "recorded"
                                    ? t(($) => $.documents.acceptanceStates.recorded)
                                    : row.state === "invalidated"
                                      ? t(($) => $.documents.acceptanceStates.invalidated)
                                      : t(($) => $.documents.acceptanceStates.pending)}
                            </Badge>
                            {row.evidenceMatches === false && row.state === "accepted" && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                {t(($) => $.documents.previousEvidenceValid)}
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
            <CardFooter className="flex flex-wrap justify-between gap-2">
              <p className="text-xs text-muted-foreground">{t(($) => $.documents.selfOnly)}</p>
              {pagination}
            </CardFooter>
          </TabsContent>
          <TabsContent id="catalog">
            <CardContent className="min-w-0">{contentCatalog}</CardContent>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}
