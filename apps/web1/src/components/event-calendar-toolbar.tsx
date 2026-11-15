import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CalendarController } from "@fullcalendar/react";
import { EventCalendarNextIcon, EventCalendarPrevIcon } from "@/components/event-calendar-icons";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface EventCalendarToolbarProps {
  className?: string;
  controller: CalendarController;
  availableViews: string[];
  content?: ReactNode;
  disabled?: boolean;
  addButton?: {
    isPrimary?: boolean;
    text?: string;
    hint?: string;
    click?: () => void;
  };
}

export function EventCalendarToolbar({
  className,
  controller,
  availableViews,
  addButton,
  content,
  disabled = false,
}: EventCalendarToolbarProps) {
  const { t } = useTranslation();
  const buttons = controller.getButtonState();

  return (
    <div className={cn("flex items-center justify-between flex-wrap gap-3", className)}>
      <div className="flex items-center min-w-0 flex-wrap gap-2">
        {addButton && (
          <Button onPress={addButton.click} isDisabled={disabled} aria-label={addButton.hint}>
            {addButton.text}
          </Button>
        )}
        <Button
          onPress={() => controller.today()}
          isDisabled={disabled}
          aria-label={buttons.today.hint}
          variant="outline"
          size="sm"
        >
          {buttons.today.text}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            onPress={() => controller.prev()}
            isDisabled={disabled || buttons.prev.isDisabled}
            aria-label={buttons.prev.hint}
            variant="outline"
            size="icon-sm"
          >
            <EventCalendarPrevIcon />
          </Button>
          <Button
            onPress={() => controller.next()}
            isDisabled={disabled || buttons.next.isDisabled}
            aria-label={buttons.next.hint}
            variant="outline"
            size="icon-sm"
          >
            <EventCalendarNextIcon />
          </Button>
        </div>
        <div className="text-sm font-semibold">{controller.view?.title}</div>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {content}
        <ToggleGroup
          variant="segmented"
          selectionMode="single"
          disallowEmptySelection
          aria-label={t(($) => $.schedule.viewLabel)}
          selectedKeys={[controller.view?.type ?? availableViews[0]!]}
          isDisabled={disabled}
          onSelectionChange={(keys) => {
            const view = [...keys][0];
            if (typeof view === "string" && availableViews.includes(view))
              controller.changeView(view);
          }}
        >
          {availableViews.map((view) => (
            <ToggleGroupItem key={view} id={view} aria-label={buttons[view]?.hint}>
              {buttons[view]?.text}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
