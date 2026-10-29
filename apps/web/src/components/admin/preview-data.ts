// Fictitious design fixtures. This module is imported only by /tasarim.
// No production API, session or persistence is used by the design preview.
export type PreviewStudent = {
  id: string;
  name: string;
  initials: string;
  level: "beginner" | "intermediate";
  remaining: number;
  status: "active" | "renewal";
};

export const previewStudents: PreviewStudent[] = [
  {
    id: "sample-1",
    name: "Deniz Yılmaz",
    initials: "DY",
    level: "beginner",
    remaining: 6,
    status: "active",
  },
  {
    id: "sample-2",
    name: "Ece Demir",
    initials: "ED",
    level: "intermediate",
    remaining: 2,
    status: "renewal",
  },
  {
    id: "sample-3",
    name: "Mert Kaya",
    initials: "MK",
    level: "beginner",
    remaining: 8,
    status: "active",
  },
  {
    id: "sample-4",
    name: "Selin Aydın",
    initials: "SA",
    level: "intermediate",
    remaining: 1,
    status: "renewal",
  },
  {
    id: "sample-5",
    name: "Can Arslan",
    initials: "CA",
    level: "beginner",
    remaining: 4,
    status: "active",
  },
  {
    id: "sample-6",
    name: "İpek Yıldız",
    initials: "İY",
    level: "intermediate",
    remaining: 7,
    status: "active",
  },
];

export const previewSessions = [
  {
    id: "technique",
    time: "10:00",
    end: "11:00",
    title: "technique",
    count: 12,
    capacity: 16,
    completed: true,
  },
  {
    id: "private",
    time: "12:30",
    end: "13:30",
    title: "private",
    count: 2,
    capacity: 2,
    completed: true,
  },
  {
    id: "beginner",
    time: "18:00",
    end: "19:00",
    title: "beginner",
    count: 18,
    capacity: 24,
    completed: false,
  },
  {
    id: "practice",
    time: "19:30",
    end: "21:00",
    title: "practice",
    count: 14,
    capacity: 24,
    completed: false,
  },
] as const;

export type PreviewSession = (typeof previewSessions)[number];

export const previewPackages = [
  { id: "starter", credits: 4, price: 1600, students: 24 },
  { id: "regular", credits: 8, price: 2800, students: 38 },
  { id: "intensive", credits: 12, price: 3600, students: 24 },
] as const;
