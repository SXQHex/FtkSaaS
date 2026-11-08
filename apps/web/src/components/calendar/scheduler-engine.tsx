"use client";

import { useUserPreferences } from "../user-preferences";
import { useLocale } from "next-intl";
import {
  Day,
  Week,
  Month,
  Agenda,
  Inject,
  ScheduleComponent,
  type EventClickArgs,
} from "@syncfusion/ej2-react-schedule";
import { L10n, loadCldr, registerLicense } from "@syncfusion/ej2-base";
import trNumbers from "@syncfusion/ej2-cldr-data/main/tr/numbers.json";
import trTimeZones from "@syncfusion/ej2-cldr-data/main/tr/timeZoneNames.json";
import trCalendar from "@syncfusion/ej2-cldr-data/main/tr/ca-gregorian.json";
import numberingSystems from "@syncfusion/ej2-cldr-data/supplemental/numberingSystems.json";
import trLocale from "@syncfusion/ej2-locale/src/tr.json";
import { entryKey, type CalendarEntry, type CalendarRange } from "../../lib/schedule";
import { configureSchedulerEvent } from "./scheduler-accessibility";
import "./scheduler.css";

loadCldr(trNumbers, trTimeZones, trCalendar, numberingSystems);
L10n.load({ tr: { schedule: trLocale.tr.schedule } });
const license = process.env.NEXT_PUBLIC_SYNCFUSION_LICENSE_KEY;
if (license) registerLicense(license);

// Vendor types, field names and callbacks remain inside this adapter.
export default function SchedulerEngine({
  date,
  range,
  timeZone,
  entries,
  onSelect,
}: {
  date: string;
  range: CalendarRange;
  timeZone: string;
  entries: CalendarEntry[];
  onSelect: (entry: CalendarEntry) => void;
}) {
  const locale = useLocale();
  const preferences = useUserPreferences();
  const format = new Intl.DateTimeFormat(locale, {
    timeZone,
    dateStyle: "full",
    timeStyle: "long",
    hourCycle: "h23",
  });
  if (!license) return null;
  const dataSource = entries.map((entry) => ({
    Id: entryKey(entry),
    Subject: entry.title,
    StartTime: new Date(entry.startsAt),
    EndTime: new Date(entry.endsAt),
    IsReadonly: true,
  }));
  function select(args: EventClickArgs) {
    args.cancel = true;
    const event = Array.isArray(args.event) ? args.event[0] : args.event;
    const entry = entries.find((value) => entryKey(value) === event?.Id);
    if (entry) onSelect(entry);
  }
  return (
    <div className="session-scheduler overflow-x-auto rounded-xl border bg-card">
      <ScheduleComponent
        key={`${locale}:${range}:${date}:${timeZone}`}
        cssClass="ftk-scheduler"
        width="100%"
        height="640px"
        selectedDate={new Date(`${date}T12:00:00`)}
        currentView={
          range === "day"
            ? "Day"
            : range === "week"
              ? "Week"
              : range === "month"
                ? "Month"
                : "Agenda"
        }
        views={["Day", "Week", "Month", "Agenda"]}
        timezone={timeZone}
        locale={locale === "tr" ? "tr" : "en-US"}
        firstDayOfWeek={preferences?.week_start === "sunday" ? 0 : 1}
        showWeekend={preferences?.show_weekends !== false}
        timeFormat={preferences?.time_format === "12" ? "hh:mm a" : "HH:mm"}
        dateFormat="dd.MM.yyyy"
        showHeaderBar={false}
        showQuickInfo={false}
        readonly
        allowDragAndDrop={false}
        allowResizing={false}
        enableHtmlSanitizer
        eventSettings={{
          dataSource,
          allowAdding: false,
          allowEditing: false,
          allowDeleting: false,
        }}
        eventClick={select}
        eventRendered={({ element, data }) => {
          const entry = entries.find((value) => entryKey(value) === data.Id);
          if (!entry) return;
          configureSchedulerEvent(
            element,
            `${format.format(new Date(entry.startsAt))} – ${format.format(new Date(entry.endsAt))}`,
            () => onSelect(entry),
          );
        }}
        popupOpen={(args) => {
          args.cancel = true;
        }}
      >
        <Inject services={[Day, Week, Month, Agenda]} />
      </ScheduleComponent>
    </div>
  );
}
