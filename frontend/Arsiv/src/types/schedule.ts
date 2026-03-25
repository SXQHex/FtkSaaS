// src/types/schedule.ts
import { CourseGroup as CourseGroupType, Discipline, Level } from './courses';

import { EntityId, ISODateString } from './common';

// --- ROOM (ODA) TİPİ --- (common.ts'ten taşındı)
export interface Room {
    id: EntityId;
    name: string;
    capacity: number;
}

// --- ENROLLMENT (KAYIT) TİPİ --- (common.ts'ten taşındı)
export interface Enrollment {
    id: EntityId;
    user_id: EntityId;
    course_session_id: EntityId; // Session ID
    membership_id: EntityId | null;
    status: 'Enrolled' | 'Canceled' | 'Completed' | string;
    enrolled_at: ISODateString;
}

// --- Schedule (Takvim) Tipi Tanımları ---

// dataService'den taşınan CourseSession
export interface CourseSession {
    id: string;
    course_group_id: string;
    session_date: string;
    start_datetime: string;
    end_datetime: string;
    is_completed: boolean;
    room_id: string;
}

// dataService'den taşınan ScheduleEventDetail (Detaylı Takvim Etkinliği)
export interface ScheduleEventDetail {
    id: string; 
    start_datetime: string;
    end_datetime: string;
    is_completed: boolean;
    courseTitle: string; 
    discipline: string; // Adı
    disciplineId: string; // ID'si
    level: string; // Adı
    levelId: string; // ID'si
    group: CourseGroupType; // courses.ts'den geldi
    instructorName: string; 
    instructorId: string;
    room: Room; // common.ts'den geldi
    enrolledCount: number;
    capacity: number;
}

// FullCalendar kütüphanesi için formatlanmış event tipi (Mevcut hali korundu)
export interface CalendarEvent {
    id: string; // session ID
    title: string;
    start: string; // ISO string formatında
    end: string; // ISO string formatında
    color: string; // Renge göre sınıflandırma
    extendedProps: {
        disciplineId: string;
        levelId: string;
        roomId: string;
        instructorId: string;
    };
}

// Filter Bar için seçenek tipi (Mevcut hali korundu)
export interface FilterOption {
    id: string;
    name: string;
}

// Tüm filtre durumunu yöneten ana tip (Mevcut hali korundu)
export interface ScheduleFilters {
    disciplineId: string | 'all';
    levelId: string | 'all';
    roomId: string | 'all';
    instructorId: string | 'all';
}