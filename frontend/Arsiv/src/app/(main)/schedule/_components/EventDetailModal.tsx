// src/app/schedule/_components/EventDetailModal.tsx
"use client";

import React from 'react';
import BaseModal from '@/components/modals/BaseModal';
import { ScheduleEventDetail } from '@/types/schedule';
import { ClockIcon, UsersIcon, MapPinIcon, AcademicCapIcon, UserIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

interface EventDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventDetail: ScheduleEventDetail | null;
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({ isOpen, onClose, eventDetail }) => {
    
    if (!eventDetail) return null;

    // Tarih ve saatleri okunabilir formata dönüştür
    const startDate = new Date(eventDetail.start_datetime);
    const endDate = new Date(eventDetail.end_datetime);
    
    const formattedDate = startDate.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const formattedTime = `${startDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} - ${endDate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    
    const isPast = endDate < new Date();
    
    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title="Ders Oturumu Detayları">
            <div className="space-y-6 p-4">
                
                {/* Başlık ve Durum */}
                <header className="border-b pb-4">
                    <h2 className="text-2xl font-bold text-indigo-700">{eventDetail.courseTitle}</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Grup: <span className="font-medium text-gray-700">{eventDetail.group.group_name}</span>
                    </p>
                    <span 
                        className={`inline-flex items-center px-3 py-1 text-sm font-semibold rounded-full mt-2 ${
                            isPast 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                        }`}
                    >
                        {isPast ? 'Tamamlandı' : 'Yaklaşan Ders'}
                    </span>
                </header>

                {/* Detaylar Bölümü */}
                <div className="space-y-4">
                    
                    {/* Tarih ve Saat */}
                    <DetailItem icon={ClockIcon} label="Tarih" value={formattedDate} />
                    <DetailItem icon={ClockIcon} label="Saat Aralığı" value={formattedTime} />
                    
                    {/* Eğitmen ve Sınıf */}
                    <DetailItem icon={UserIcon} label="Eğitmen" value={eventDetail.instructorName} />
                    <DetailItem icon={MapPinIcon} label="Sınıf" value={eventDetail.room.name} />

                    {/* Disiplin ve Seviye */}
                    <DetailItem icon={AcademicCapIcon} label="Disiplin" value={eventDetail.discipline} />
                    <DetailItem icon={AcademicCapIcon} label="Seviye" value={eventDetail.level} />

                    {/* Kapasite ve Kayıt Sayısı */}
                    <DetailItem 
                        icon={UsersIcon} 
                        label="Kayıt Durumu" 
                        value={`${eventDetail.enrolledCount} / ${eventDetail.capacity} Kişi`} 
                        colorClass={eventDetail.enrolledCount >= eventDetail.capacity ? 'text-red-600 font-bold' : 'text-gray-900'}
                    />
                </div>
                
                {/* Eylem Düğmeleri (Yönetici/Eğitmenler için) */}
                <div className="pt-4 border-t flex justify-end space-x-3">
                    
                    {/* Ders Detaylarını Düzenle */}
                    <button
                        onClick={() => {
                            // Düzenleme sayfasına yönlendir
                            onClose(); 
                            // window.location.href = `/groups/edit/${eventDetail.group.id}`; 
                            console.log("Ders Düzenleme Sayfasına Git:", eventDetail.group.id);
                        }}
                        className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-800 font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                        <PencilSquareIcon className="w-5 h-5"/>
                        <span>Düzenle</span>
                    </button>
                    
                    {/* Yoklama Alma Düğmesi (Sadece tamamlanmadıysa ve yetki varsa) */}
                    {!isPast && (
                        <button
                            onClick={() => {
                                // Yoklama sayfasına yönlendir
                                onClose(); 
                                window.location.href = `/attendance/${eventDetail.id}`;
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                        >
                            Yoklama Al
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-200 text-gray-800 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                    >
                        Kapat
                    </button>
                </div>

            </div>
        </BaseModal>
    );
};

// Detay öğelerini standart formatta göstermek için yardımcı bileşen
const DetailItem: React.FC<{ icon: React.ElementType, label: string, value: string, colorClass?: string }> = ({ icon: Icon, label, value, colorClass = 'text-gray-900' }) => (
    <div className="flex items-center space-x-3">
        <Icon className="w-5 h-5 text-indigo-500 shrink-0" />
        <span className="text-sm font-medium text-gray-600 w-28">{label}:</span>
        <span className={`text-sm ${colorClass}`}>{value}</span>
    </div>
);

export default EventDetailModal;