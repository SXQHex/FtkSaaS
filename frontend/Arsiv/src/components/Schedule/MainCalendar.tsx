// src/components/Schedule/MainCalendar.tsx (NİHAİ VE HATA GİDERİLMİŞ SÜRÜM)
"use client";

import React, { useMemo, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { EventClickArg } from '@fullcalendar/core'; 
import trLocale from '@fullcalendar/core/locales/tr';
import { useQuery } from '@tanstack/react-query';

import { 
    fetchScheduleEvents, 
    fetchEventDetail as syncFetchEventDetail, // <-- Senkron versiyonu farklı bir isimle aldık
    ScheduleEventDetail,
    CourseSession // api.ts üzerinden re-export edilen tip
} from '../../lib/api'; 


// --- TİP TANIMLARI ---

export interface ScheduleFilters {
    disciplineId?: string;
    levelId?: string;
    instructorId?: string;
    roomId?: string;
}

export interface MainCalendarProps {
    filters: ScheduleFilters; 
    onEventClick: (eventDetail: ScheduleEventDetail) => void;
    // Asenkron fonksiyon prop olarak gelir, useMemo içinde kullanılmaz.
    fetchEventDetail: (sessionId: string) => Promise<ScheduleEventDetail | null>; 
}


// --- BİLEŞEN ---

// Prop adını karışıklığı gidermek için yeniden adlandırarak alıyoruz
const MainCalendar = ({ filters, onEventClick, fetchEventDetail: fetchSessionDetailsProp }: MainCalendarProps) => {

    // 1. Tüm Takvim Verisini Çekme
    const { data: allEvents = [], isLoading, error } = useQuery<CourseSession[]>({
        queryKey: ['scheduleEvents'],
        queryFn: fetchScheduleEvents, 
    });

    // 2. Filtreleme Mantığı (useMemo kullanarak)
    const filteredEvents = useMemo(() => {
        if (!allEvents || allEvents.length === 0) return [];

        return allEvents.filter((event: CourseSession) => {
            // HATA ÇÖZÜMÜ: BURADA SADECE SENKRON FONKSİYONU KULLANIYORUZ!
            const detail = syncFetchEventDetail(event.id); // <-- syncFetchEventDetail kullanılır
            if (!detail) return false;

            // Filtreleme mantığı
            if (filters.disciplineId && filters.disciplineId !== 'all' && detail.disciplineId !== filters.disciplineId) {
                return false;
            }
            if (filters.levelId && filters.levelId !== 'all' && detail.levelId !== filters.levelId) {
                return false;
            }
            if (filters.instructorId && filters.instructorId !== 'all' && detail.instructorId !== filters.instructorId) {
                return false;
            }
            if (filters.roomId && filters.roomId !== 'all' && detail.room.id !== filters.roomId) {
                return false;
            }

            return true;
        })
        .map((event: CourseSession) => {
            // HATA ÇÖZÜMÜ: BURADA SADECE SENKRON FONKSİYONU KULLANIYORUZ!
            const detail = syncFetchEventDetail(event.id); // <-- syncFetchEventDetail kullanılır
            
            return {
                id: event.id,
                title: detail?.courseTitle || 'Kurs Oturumu',
                start: event.start_datetime,
                end: event.end_datetime,
                extendedProps: {
                    isCompleted: event.is_completed,
                    instructorId: detail?.instructorId,
                    disciplineId: detail?.disciplineId,
                },
                backgroundColor: event.is_completed ? '#ccc' : '#4f46e5', 
                borderColor: event.is_completed ? '#999' : '#4f46e5',
            };
        });

    }, [allEvents, filters]);


    // 3. Etkinlik Tıklama İşleyicisi (Modal sorumluluğu parent'a devredildi)
    const handleEventClick = useCallback(async (info: EventClickArg) => { 
        
        console.log(`Etkinlik tıklandı, ID: ${info.event.id}`);

        // BURADA ASENKRON ÇAĞRI: Prop olarak gelen asenkron fonksiyonu çağır
        const eventDetail = await fetchSessionDetailsProp(info.event.id); 

        if (eventDetail) {
            onEventClick(eventDetail); 
        } else {
            console.error("Etkinlik detayı bulunamadı.");
        }
    }, [onEventClick, fetchSessionDetailsProp]);


    if (isLoading) return <div className="text-center py-10">Takvim yükleniyor...</div>;
    if (error) return <div className="text-red-500 text-center py-10">Takvim yüklenirken hata oluştu: {error.message}</div>;

    return (
        <div className="p-4 bg-white rounded-lg shadow-md">
            <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="timeGridWeek"
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                }}
                events={filteredEvents}
                locale={trLocale}
                timeZone="Europe/Istanbul"
                slotMinTime="08:00:00"
                slotMaxTime="22:00:00"
                eventClick={handleEventClick}
                editable={false}
                droppable={false}
                allDaySlot={false}
                slotLabelFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    omitZeroMinute: false,
                    meridiem: false
                }}
                eventTimeFormat={{
                    hour: '2-digit',
                    minute: '2-digit',
                    meridiem: false
                }}
            />
        </div>
    );
};

export default MainCalendar;