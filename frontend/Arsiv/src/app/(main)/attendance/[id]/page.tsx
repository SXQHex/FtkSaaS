// src/app/attendance/[id]/page.tsx (GÜNCELLENMİŞ VE EKSİKSİZ)

"use client";

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { UserRole } from '@/types/auth'; 
// Yeni API importları: fetchSessionDetails eklendi
import { fetchAttendanceListForSession, fetchSessionDetails } from '@/lib/api'; 

// Hata Çözümü 1: Missing 'AttendancePageProps' arayüzü tanımlandı
interface AttendancePageProps {
    params: {
        id: string; // [id] dinamik segmenti
    };
}

// Mock Veri: Üye listesi
interface AttendanceRecord {
    id: string; // Enrollment ID (string)
    memberId: string;
    name: string;
    status: 'PRESENT' | 'ABSENT' | 'CANCELED';
}

const AttendanceDetailPage: React.FC<AttendancePageProps> = props => {
    const params = use(props.params);
    const router = useRouter();
    const { user, loading } = useAuth();
    const eventId = params.id;

    const userRole = user?.role as UserRole | undefined;
    const isAuthorized = userRole === 'TRAINER' || userRole === 'ADMIN';

    const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
    const [dataLoading, setDataLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // Ders adını tutmak için state, başlangıçta Event ID ile
    const [courseTitle, setCourseTitle] = useState(`Ders #${eventId}`);

    // --- YETKİLENDİRME KORUMASI (AUTH GUARD) ---
    useEffect(() => {
        if (!loading && !isAuthorized) {
            router.replace('/schedule'); 
            alert("Bu sayfaya erişim yetkiniz bulunmamaktadır.");
        }
    }, [loading, isAuthorized, router]);

    // --- VERİ ÇEKME ---
    useEffect(() => {
        if (!loading && isAuthorized) {
            const loadEnrollments = async () => {
                setDataLoading(true);
                try {
                    // Yoklama Listesini Çek
                    const list = await fetchAttendanceListForSession(eventId);
                    setAttendanceList(list as AttendanceRecord[]); 
                    
                    // Ders Detaylarını Çek ve Başlığı Ayarla
                    const detail = await fetchSessionDetails(eventId); 
                    if (detail && detail.courseTitle) {
                        setCourseTitle(detail.courseTitle);
                    } else {
                        setCourseTitle(`Ders #${eventId} (Detay Yok)`);
                    }
                    
                } catch (error) {
                    console.error("Yoklama verileri çekilemedi:", error);
                    setCourseTitle(`Hata: Ders #${eventId}`);
                } finally {
                    setDataLoading(false);
                }
            };
            loadEnrollments();
        }
    }, [loading, isAuthorized, eventId]);


    if (loading || dataLoading || (!loading && !isAuthorized)) {
        return <DashboardLayout><div className="p-6 text-center">{dataLoading ? 'Üye Listesi Yükleniyor...' : 'Yetki Kontrol Ediliyor...'}</div></DashboardLayout>;
    }

    const handleStatusChange = (id: string, newStatus: AttendanceRecord['status']) => { // ID string kullanıldı
        setAttendanceList(prevList => 
            prevList.map(record => 
                record.id === id ? { ...record, status: newStatus } : record
            )
        );
    };

    const handleSave = () => {
        setIsSaving(true);
        console.log(`Ders ID ${eventId} için yoklama kaydediliyor:`, attendanceList);
        
        // Simüle edilmiş API çağrısı
        setTimeout(() => {
            setIsSaving(false);
            alert(`Yoklama başarıyla kaydedildi! (Ders ID: ${eventId})`);
            router.push('/attendance'); 
        }, 1500);
    };

    const getStatusStyle = (status: AttendanceRecord['status']) => {
        switch (status) {
            case 'PRESENT': return 'bg-green-100 text-green-800';
            case 'ABSENT': return 'bg-red-100 text-red-800';
            case 'CANCELED': return 'bg-yellow-100 text-yellow-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <DashboardLayout>
            <div className="p-6 md:p-10">
                <header className="flex items-center justify-between mb-8 pb-4 border-b">
                    <h1 className="text-3xl font-extrabold text-gray-800">
                        Yoklama: {courseTitle}
                    </h1>
                    <button 
                        onClick={() => router.push('/attendance')}
                        className="flex items-center text-indigo-600 hover:text-indigo-800 transition"
                    >
                        <ArrowLeftIcon className="w-5 h-5 mr-1" />
                        Yoklama Panosuna Dön
                    </button>
                </header>

                <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6">
                    <h2 className="text-xl font-semibold mb-4">Üye Listesi ({attendanceList.length} Kayıt)</h2>
                    
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Üye Adı</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Aksiyon</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {attendanceList.map(record => (
                                <tr key={record.id}>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {record.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusStyle(record.status)}`}>
                                            {record.status === 'PRESENT' ? 'GELDİ' : record.status === 'ABSENT' ? 'GELMEDİ' : 'İPTAL ETTİ'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        <select
                                            value={record.status}
                                            onChange={(e) => handleStatusChange(record.id, e.target.value as AttendanceRecord['status'])}
                                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                        >
                                            <option value="PRESENT">GELDİ</option>
                                            <option value="ABSENT">GELMEDİ</option>
                                            <option value="CANCELED">İPTAL ETTİ</option>
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    
                    <div className="mt-8 flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 transition duration-150 disabled:bg-indigo-400"
                        >
                            {isSaving ? 'Kaydediliyor...' : 'Yoklamayı Kaydet'}
                        </button>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default AttendanceDetailPage;