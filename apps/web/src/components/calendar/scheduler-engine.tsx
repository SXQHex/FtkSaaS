"use client";

import { useLocale } from "next-intl";
import {
  Day,
  Week,
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
        currentView={range === "day" ? "Day" : "Week"}
        views={["Day", "Week"]}
        timezone={timeZone}
        locale={locale === "tr" ? "tr" : "en-US"}
        firstDayOfWeek={1}
        timeFormat="HH:mm"
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
        popupOpen={(args) => {
          args.cancel = true;
        }}
      >
        <Inject services={[Day, Week]} />
      </ScheduleComponent>
    </div>
  );
}
