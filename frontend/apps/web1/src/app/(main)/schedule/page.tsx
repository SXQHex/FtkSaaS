// src/app/schedule/page.tsx (NİHAİ DÜZELTİLMİŞ SÜRÜM)
"use client";

import React, { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import ScheduleFilterBar from '@/components/Schedule/ScheduleFilterBar';
import MainCalendar from '@/components/Schedule/MainCalendar';
import EventDetailModal from './_components/EventDetailModal';
import { useAuthGuard } from '@/hooks/useAuthGuard';
// ScheduleEventDetail ve ScheduleFilters tipinin '@/types/schedule' dosyasında olduğu varsayılır
import { ScheduleEventDetail, ScheduleFilters } from '@/types/schedule'; 
import { fetchSessionDetails } from '@/lib/api'; 

const ALLOWED_ROLES = ['ADMIN', 'STAFF', 'TRAINER', 'MEMBER'];

const initialFilters: ScheduleFilters = {
    disciplineId: 'all',
    levelId: 'all',
    roomId: 'all',
    instructorId: 'all',
};

export default function SchedulePage() {
    // Auth Guard (Yetkilendirme)
    const { isLoadingAuth, isAuthorized } = useAuthGuard(ALLOWED_ROLES);
    
    // 1. Filtre durumunu (state) burada tutuyoruz (RCA Prensibi)
    const [filters, setFilters] = useState<ScheduleFilters>(initialFilters);
    
    // 2. Modal durumunu yönetiyoruz
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<ScheduleEventDetail | null>(null);

    // Filtre değişikliğini yöneten fonksiyon (Filter Bar tarafından çağrılır)
    const handleFilterChange = (newFilters: ScheduleFilters) => {
        setFilters(newFilters);
    };

    // Takvimdeki bir etkinliğe tıklandığında çalışacak işlev
    const handleEventClick = (eventDetail: ScheduleEventDetail) => {
        setSelectedEvent(eventDetail);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedEvent(null);
    };
    
    // Yükleniyor/Yetkilendirme Kontrolü
    if (isLoadingAuth) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <p className="text-xl text-gray-600">Yetkilendirme Kontrol Ediliyor...</p>
            </div>
        );
    }
    
    if (!isAuthorized) return null;


    return (
        <DashboardLayout>
            <div className="p-6 md:p-10 space-y-8">
                <h1 className="text-3xl font-bold text-gray-900">Ders Programı</h1>
                
                {/* Filtreleme Çubuğu: State ve değişim fonksiyonunu alır */}
                <ScheduleFilterBar 
                    currentFilters={filters}
                    onFilterChange={handleFilterChange}
                /> 

                {/* Ana Takvim Bileşeni: activeFilters -> filters olarak düzeltildi */}
                <MainCalendar 
                    filters={filters} // <-- Düzeltilen prop adı
                    onEventClick={handleEventClick} 
                    fetchEventDetail={fetchSessionDetails} // Asenkron fonksiyon prop olarak gönderilir
                />
            </div>
            
            {/* Etkinlik Detay Modal */}
            <EventDetailModal
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                eventDetail={selectedEvent}
            />
        </DashboardLayout>
    );
}