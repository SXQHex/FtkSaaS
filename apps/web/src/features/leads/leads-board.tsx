import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GripVerticalIcon } from "lucide-react";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanItem,
  KanbanItemHandle,
} from "@ftksaas/ui/components/kanban";
import { Card, CardHeader, CardTitle, CardContent } from "@ftksaas/ui/components/card";
import { Button } from "@ftksaas/ui/components/button";
import { Badge } from "@ftksaas/ui/components/badge";
import { NativeSelect, NativeSelectOption } from "@ftksaas/ui/components/native-select";
import type { CrmPipelineStage, CrmStageCount } from "@ftksaas/api-contracts";
export interface LeadRow {
  id: string;
  name: string;
  source: string;
  interest: string;
  stageKey: string | null;
  stageName: string | null;
  assignedName: string | null;
  nextAction: string | null;
  due: string | null;
  tags: string[];
  movable: boolean;
}
export function LeadsBoard({
  rows,
  stages,
  stageCounts,
  disabled,
  onSelect,
  onStage,
}: {
  rows: LeadRow[];
  stages: CrmPipelineStage[];
  stageCounts?: CrmStageCount[];
  disabled: boolean;
  onSelect: (id: string) => void;
  onStage?: (id: string, stage: string) => void;
}) {
  const { t } = useTranslation();
  const unassignedCount = stageCounts
    ?.filter((row) => !stages.some((stage) => stage.key === row.stage_key))
    .reduce((sum, row) => sum + row.count, 0);
  const columnCount = (key: string) =>
    key === "__unassigned"
      ? unassignedCount
      : stageCounts?.find((row) => row.stage_key === key)?.count;
  const stageKeys = stages.map((stage) => stage.key);
  const columns = Object.fromEntries(stageKeys.map((key) => [key, [] as LeadRow[]]));
  if (unassignedCount) columns.__unassigned = [];
  for (const row of rows) {
    const key = row.stageKey && stageKeys.includes(row.stageKey) ? row.stageKey : "__unassigned";
    (columns[key] ??= []).push(row);
  }
  const [preview, setPreview] = useState<Record<string, LeadRow[]>>(),
    dragging = useRef(false);
  const value = preview ?? columns;
  const boardRef = useRef<HTMLDivElement>(null),
    activeHandle = useRef<string | undefined>(undefined),
    keyboardDrag = useRef(false);
  useLayoutEffect(() => {
    if (!keyboardDrag.current || !activeHandle.current) return;
    const handle = boardRef.current?.querySelector<HTMLElement>(
      `[data-lead-handle="${CSS.escape(activeHandle.current)}"]`,
    );
    if (handle && document.activeElement !== handle) {
      handle
        .closest('[data-slot="kanban-item"]')
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
      handle.focus({ preventScroll: true });
    }
  }, [preview]);
  const stageLabel = (key: string) =>
    stages.find((stage) => stage.key === key)?.name ?? t(($) => $.leads.noStageGroup);
  const itemName = (id: unknown) =>
    rows.find((row) => row.id === String(id))?.name ?? t(($) => $.leads.candidate);
  return (
    <div
      ref={boardRef}
      role="region"
      aria-label={t(($) => $.leads.boardRegion)}
      tabIndex={0}
      className="min-w-0 overflow-x-auto p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground focus-visible:-outline-offset-2"
    >
      <Kanban
        value={value}
        getItemValue={(row) => row.id}
        onValueChange={(next) => {
          if (dragging.current) setPreview(next);
        }}
        onDragStart={(event) => {
          activeHandle.current = String(event.active.id);
          keyboardDrag.current = event.activatorEvent instanceof KeyboardEvent;
          dragging.current = true;
        }}
        onDragCancel={() => {
          dragging.current = false;
          activeHandle.current = undefined;
          keyboardDrag.current = false;
          setPreview(undefined);
        }}
        onDragEnd={(event) => {
          const key = event.over
            ? Object.keys(value).find(
                (key) =>
                  key === event.over?.id || value[key].some((row) => row.id === event.over?.id),
              )
            : undefined;
          const row = rows.find((row) => row.id === event.active.id);
          dragging.current = false;
          activeHandle.current = undefined;
          keyboardDrag.current = false;
          setPreview(undefined);
          if (!disabled && row?.movable && key && key !== "__unassigned" && key !== row.stageKey)
            onStage?.(row.id, key);
        }}
        accessibility={{
          screenReaderInstructions: { draggable: t(($) => $.leads.dragInstructions) },
          announcements: {
            onDragStart: ({ active }) => t(($) => $.leads.dragStart, { name: itemName(active.id) }),
            onDragOver: ({ active, over }) =>
              over
                ? t(($) => $.leads.dragOver, {
                    name: itemName(active.id),
                    stage: stageLabel(
                      Object.keys(value).find(
                        (key) => key === over.id || value[key].some((row) => row.id === over.id),
                      ) ?? "",
                    ),
                  })
                : undefined,
            onDragEnd: ({ active }) => t(($) => $.leads.dragEnd, { name: itemName(active.id) }),
            onDragCancel: ({ active }) =>
              t(($) => $.leads.dragCancel, { name: itemName(active.id) }),
          },
        }}
      >
        <KanbanBoard
          aria-orientation={undefined}
          className="flex w-max min-w-full items-stretch gap-3"
        >
          {Object.entries(value).map(([key, items]) => (
            <KanbanColumn
              key={key}
              value={key}
              className={
                stages.find((stage) => stage.key === key)?.kind === "open"
                  ? "min-h-56 w-50 shrink-0 grow basis-50"
                  : "min-h-56 w-40 shrink-0 basis-40"
              }
            >
              <div className="flex items-center justify-between gap-2 px-1 py-2">
                <h2 className="min-w-0 break-words font-medium">{stageLabel(key)}</h2>
                <Badge variant="secondary">
                  {columnCount(key)?.toLocaleString("tr-TR") ?? "—"}
                </Badge>
              </div>
              {items.map((row) => (
                <KanbanItem
                  key={row.id}
                  value={row.id}
                  disabled={disabled || !row.movable || !onStage}
                  render={<Card />}
                  className="gap-2 p-3 has-focus-visible:ring-2 has-focus-visible:ring-ring motion-reduce:transition-none data-dragging:opacity-100 data-disabled:opacity-100 data-disabled:pointer-events-auto"
                >
                  <CardHeader className="flex flex-row items-start gap-1 p-0">
                    <CardTitle className="min-w-0 flex-1">
                      <Button
                        variant="link"
                        className="h-auto justify-start p-0 text-left whitespace-normal"
                        isDisabled={disabled}
                        onPress={() => onSelect(row.id)}
                      >
                        {row.name}
                      </Button>
                    </CardTitle>
                    {row.movable && (
                      <KanbanItemHandle
                        data-lead-handle={row.id}
                        aria-label={t(($) => $.leads.dragLabel, { name: row.name })}
                        className="flex size-7 shrink-0 touch-none items-center justify-center rounded-md [-webkit-user-select:none] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        <GripVerticalIcon className="size-4" aria-hidden="true" />
                      </KanbanItemHandle>
                    )}
                  </CardHeader>
                  <CardContent className="flex min-w-0 flex-col gap-2 p-0">
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">{row.interest}</Badge>
                      {row.tags.map((tag) => (
                        <Badge key={tag} variant="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {row.source} · {row.assignedName ?? t(($) => $.leads.unassigned)}
                    </p>
                    <p className="text-xs">
                      {row.nextAction ?? t(($) => $.leads.noNext)}
                      {row.due && <> · {row.due}</>}
                    </p>
                    <NativeSelect
                      aria-label={t(($) => $.leads.stageLabel, { name: row.name })}
                      value={row.stageKey ?? ""}
                      disabled={disabled || !row.movable || !onStage}
                      onChange={(event) => onStage?.(row.id, event.target.value)}
                    >
                      <NativeSelectOption value="">{t(($) => $.leads.noStage)}</NativeSelectOption>
                      {stages.map((stage) => (
                        <NativeSelectOption key={stage.key} value={stage.key}>
                          {stage.name}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </CardContent>
                </KanbanItem>
              ))}
            </KanbanColumn>
          ))}
        </KanbanBoard>
      </Kanban>
    </div>
  );
}
