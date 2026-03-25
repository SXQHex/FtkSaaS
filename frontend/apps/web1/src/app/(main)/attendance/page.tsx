// src/app/attendance/page.tsx (GÜNCELLENMİŞ)

"use client";

import React, { useEffect, useState } from 'react'; // useState eklendi
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeftIcon, CalendarDaysIcon, CheckBadgeIcon } from '@heroicons/react/24/outline';
import { UserRole } from '@/types/auth'; 
import { fetchAttendanceSummary } from '@/lib/api'; // Yeni API import edildi

// Ders Özet Tipi
interface CourseAttendanceSummary {
    eventId: string;
    courseName: string;
    instructor: string;
    date: string;
    time: string;
    status: 'Upcoming' | 'Completed' | 'InProgress';
    attendanceTaken: boolean;
}

// mockCourseList kaldırıldı

const AttendanceSchedulePage: React.FC = () => {
    const router = useRouter();
    const { user, loading } = useAuth();
    
    const [courseList, setCourseList] = useState<CourseAttendanceSummary[]>([]);
    const [dataLoading, setDataLoading] = useState(true); // Veri çekme yüklenme durumu

    // Rol Kontrolü
    const userRole = user?.role as UserRole | undefined;
    const isAuthorized = userRole === 'TRAINER' || userRole === 'ADMIN';

    // --- YETKİLENDİRME KORUMASI (AUTH GUARD) ---
    useEffect(() => {
        if (!loading && !isAuthorized) {
            router.replace('/schedule'); 
            alert("Bu yönetim panosuna erişim yetkiniz bulunmamaktadır.");
        }
    }, [loading, isAuthorized, router]);

    // --- VERİ ÇEKME ---
    useEffect(() => {
        // Auth ve Yetki kontrolü tamamlandığında veriyi çek
        if (!loading && isAuthorized && user?.id) { 
            const loadSummary = async () => {
                setDataLoading(true);
                try {
                    // Kullanıcının ID'si API'ye gönderiliyor (Trainer/Admin ayrımı için)
                    const summary = await fetchAttendanceSummary(user.id); 
                    setCourseList(summary);
                } catch (error) {
                    console.error("Yoklama özeti çekilemedi:", error);
                } finally {
                    setDataLoading(false);
                }
            };
            loadSummary();
        } else if (!loading && !isAuthorized) {
            // Yetkili değilse yüklemeyi hemen bitir
            setDataLoading(false);
        }
    }, [isAuthorized, user?.id, loading, router]);


    if (loading || dataLoading || (!loading && !isAuthorized)) {
        return <DashboardLayout><div className="p-6 text-center">{dataLoading ? 'Ders Listesi Yükleniyor...' : 'Yetki Kontrol Ediliyor...'}</div></DashboardLayout>;
    }

    // Yoklama almak için dinamik sayfaya yönlendirme
    const handleTakeAttendance = (eventId: string) => {
        router.push(`/attendance/${eventId}`); 
    };
    
    // Durum stilini belirleyen yardımcı fonksiyon
    const getStatusStyle = (status: CourseAttendanceSummary['status']) => {
        switch (status) {
            case 'Upcoming': return 'bg-blue-100 text-blue-800';
            case 'Completed': return 'bg-gray-100 text-gray-800';
            case 'InProgress': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 md:p-10">
                <header className="flex items-center justify-between mb-8 pb-4 border-b">
                    <h1 className="text-3xl font-extrabold text-gray-800 flex items-center space-x-2">
                        <CheckBadgeIcon className="w-7 h-7 text-red-600" />
                        <span>Yoklama Yönetim Panosu</span>
                    </h1>
                    <button 
                        onClick={() => router.push('/schedule')}
                        className="flex items-center text-indigo-600 hover:text-indigo-800 transition"
                    >
                        <ArrowLeftIcon className="w-5 h-5 mr-1" />
                        Takvime Dön
                    </button>
                </header>

                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <h2 className="text-xl font-semibold mb-4 flex items-center space-x-2">
                        <CalendarDaysIcon className="w-6 h-6 text-gray-500" />
                        Yaklaşan ve Geçmiş Dersler
                    </h2>
                    
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ders Adı</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih / Saat</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Eğitmen</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yoklama</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {courseList.length > 0 ? (
                                courseList.map(course => (
                                    <tr key={course.eventId} className={course.attendanceTaken ? 'opacity-80' : ''}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {course.courseName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {course.date} - {course.time}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {course.instructor}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusStyle(course.status)}`}>
                                                {course.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            {course.attendanceTaken ? (
                                                <span className="text-green-600 flex items-center">
                                                    <CheckBadgeIcon className="w-5 h-5 mr-1" /> Alındı
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => handleTakeAttendance(course.eventId)}
                                                    className="text-indigo-600 hover:text-indigo-900 transition font-semibold"
                                                >
                                                    Yoklama Al
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                        Görüntülenecek ders bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default AttendanceSchedulePage;