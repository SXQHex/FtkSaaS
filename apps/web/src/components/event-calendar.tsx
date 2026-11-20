import { useCallback, useRef, type ReactNode } from "react";
import { type CalendarOptions, useCalendarController } from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import interactionPlugin from "@fullcalendar/react/interaction";
import listPlugin from "@fullcalendar/react/list";
import multiMonthPlugin from "@fullcalendar/react/multimonth";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import { EventCalendarViews } from "@ftksaas/ui/components/event-calendar-views";
import { EventCalendarToolbar } from "@/components/event-calendar-toolbar";
import { EventCalendarCloseIcon } from "@/components/event-calendar-icons";
import { cn } from "@ftksaas/ui/lib/utils";

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

function scrollToInitialHour(scroll: HTMLElement, root: HTMLElement, targetClass?: string) {
  const target = targetClass ? root.getElementsByClassName(targetClass)[0] : undefined;
  if (!target) return;
  const header = root.querySelector('[role="rowgroup"]');
  // The SDK finishes sizing its auto-height rows after its mount callback.
  // Initial position only. Keyboard, touch and wheel scrolling remain native.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!scroll.isConnected || !target.isConnected) return;
      scroll.scrollTop =
        target.getBoundingClientRect().top -
        scroll.getBoundingClientRect().top +
        scroll.scrollTop -
        (header?.getBoundingClientRect().height ?? 0);
    });
  });
}

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
  scrollRegionLabel?: string;
  viewScrollHeight?: string;
  initialScrollTargetClass?: string;
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
  scrollRegionLabel,
  viewScrollHeight,
  initialScrollTargetClass,
  className,
  height,
  contentHeight,
  direction,
  plugins: userPlugins = [],
  ...restOptions
}: EventCalendarProps) {
  const controller = useCalendarController();
  const scrollRef = useRef<HTMLDivElement>(null);
  const attachScroll = useCallback(
    (scroll: HTMLDivElement | null) => {
      scrollRef.current = scroll;
      // The SDK mounts before its containing div's ref is attached on the initial render.
      if (scroll) scrollToInitialHour(scroll, scroll, initialScrollTargetClass);
    },
    [initialScrollTargetClass],
  );

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
      <div
        ref={attachScroll}
        className={cn(
          "grow min-h-0 min-w-0",
          viewScrollHeight ? "overflow-auto" : "overflow-x-auto",
        )}
        style={{ height: viewScrollHeight, flexGrow: viewScrollHeight ? 0 : undefined }}
        role={scrollRegionLabel ? "region" : undefined}
        aria-label={scrollRegionLabel}
        tabIndex={scrollRegionLabel ? 0 : undefined}
      >
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
            viewDidMount={(info) => {
              restOptions.viewDidMount?.(info);
              const scroll = scrollRef.current;
              if (scroll) scrollToInitialHour(scroll, info.el, initialScrollTargetClass);
            }}
          />
        </div>
      </div>
    </div>
  );
}
