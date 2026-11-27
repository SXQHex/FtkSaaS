import { createLucideIcon } from "lucide-react";

// Path geometry from the supplied Studiom reference.
export const DashboardIcon = createLucideIcon("Dashboard", [
  ["rect", { width: "7", height: "9", x: "3", y: "3", rx: "1", key: "0" }],
  ["rect", { width: "7", height: "5", x: "14", y: "3", rx: "1", key: "1" }],
  ["rect", { width: "7", height: "9", x: "14", y: "12", rx: "1", key: "2" }],
  ["rect", { width: "7", height: "5", x: "3", y: "16", rx: "1", key: "3" }],
]);
export const CalendarIcon = createLucideIcon("Calendar", [
  ["path", { d: "M8 2v4M16 2v4", key: "0" }],
  ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2", key: "1" }],
  ["path", { d: "M3 10h18", key: "2" }],
]);
export const BuildingIcon = createLucideIcon("Building", [
  ["rect", { width: "16", height: "20", x: "4", y: "2", rx: "2", key: "0" }],
  [
    "path",
    {
      d: "M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01",
      key: "1",
    },
  ],
]);
export const InvitePersonIcon = createLucideIcon("InvitePerson", [
  ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", key: "0" }],
  ["circle", { cx: "9", cy: "7", r: "4", key: "1" }],
  ["path", { d: "M19 8v6M22 11h-6", key: "2" }],
]);
