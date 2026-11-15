import type { ReactNode } from "react";
import { type CalendarOptions, useCalendarController } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import multiMonthPlugin from "@fullcalendar/react/multimonth";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { EventCalendarViews } from "@/components/ui/event-calendar-views";
import { EventCalendarToolbar } from "@/components/event-calendar-toolbar";
import { EventCalendarCloseIcon } from "@/components/event-calendar-icons";
import { cn } from "@/lib/utils";

const plugins = [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, multiMonthPlugin];
const defaultAvailableViews = [
  "dayGridMonth",
  "timeGridWeek",
  "timeGridDay",
  "listWeek",
  "multiMonthYear",
];
const navLinkDayClick = "timeGridDay";
const navLinkWeekClick = "timeGridWeek";

export interface EventCalendarProps extends Omit<
  CalendarOptions,
  "class" | "className" | "headerToolbar" | "footerToolbar"
> {
  className?: string;
  availableViews?: string[];
  toolbarContent?: ReactNode;
  beforeViews?: ReactNode;
  toolbarDisabled?: boolean;
  viewMinWidths?: Record<string, string>;
  addButton?: {
    isPrimary?: boolean;
    text?: string;
    hint?: string;
    click?: () => void;
  };
}

export function EventCalendar({
  availableViews = defaultAvailableViews,
  addButton,
  toolbarContent,
  beforeViews,
  toolbarDisabled,
  viewMinWidths,
  className,
  height,
  contentHeight,
  direction,
  plugins: userPlugins = [],
  ...restOptions
}: EventCalendarProps) {
  const controller = useCalendarController();

  const hasBorderX = !(restOptions.borderlessX ?? restOptions.borderless);
  const hasBorderBottom = !(restOptions.borderlessBottom ?? restOptions.borderless);
  const isHeightAuto = height === "auto" || contentHeight === "auto";

  return (
    <div
      className={cn("flex flex-col gap-5", className)}
      style={{ height }}
      dir={direction === "rtl" ? "rtl" : undefined}
    >
      <EventCalendarToolbar
        className={!hasBorderX ? "px-5" : undefined}
        controller={controller}
        availableViews={availableViews}
        addButton={addButton}
        content={toolbarContent}
        disabled={toolbarDisabled}
      />
      {beforeViews}
      <div className="grow min-h-0 min-w-0 overflow-x-auto">
        <div
          style={{
            minWidth: viewMinWidths?.[controller.view?.type ?? availableViews[0]!],
            height: isHeightAuto ? undefined : "100%",
          }}
        >
          <EventCalendarViews
            className={cn(
              "bg-background border-t",
              hasBorderX && "border-x",
              hasBorderBottom && "border-b",
              hasBorderX && !isHeightAuto && "rounded-t-xs",
              hasBorderBottom && hasBorderX && !isHeightAuto && "rounded-b-xs",
              !isHeightAuto && "overflow-hidden",
            )}
            height={isHeightAuto ? "auto" : height !== undefined ? "100%" : contentHeight}
            initialView={availableViews[0]}
            navLinkDayClick={navLinkDayClick}
            navLinkWeekClick={navLinkWeekClick}
            controller={controller}
            plugins={[...plugins, ...userPlugins]}
            popoverCloseContent={() => <EventCalendarCloseIcon />}
            {...restOptions}
          />
        </div>
      </div>
    </div>
  );
}
