// src/app/memberships/page.tsx (SADELEŞTİRİLMİŞ NİHAİ SÜRÜM)
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
    PlusCircleIcon, LockClosedIcon, 
    BellAlertIcon, ArrowUpRightIcon,
    ArrowPathIcon 
} from '@heroicons/react/24/outline'; 
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation'; 
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- MOCK API HİZMETLERİ ---
import { 
    fetchMemberships, 
    fetchPendingRequests, 
    fetchRequestHistory, 
    approveRequest, 
    rejectRequest 
} from '@/lib/mock-api-memberships'; 

// --- TİP İMPORTLARI ---
import { UserRole } from '@/types/auth'; 
import { MembershipData, RequestData } from '@/types/memberships'; 

// 👇 MODAL IMPORTLARI (Bu bileşenleri harici dosyalarda oluşturmalısınız)
import RequestManagementModal from './modals/RequestManagementModal';
import RejectionReasonModal from './modals/RejectionReasonModal';


// --- MOCK YETKİLENDİRME ---
const useMockAuth = () => {
    // Dinamik rol tipi için useState kullanmak en güvenli yoldur.
    const [role, setRole] = useState<UserRole>('ADMIN'); // 🚨 Test Rolü
    return { role, userId: 't1', isLoading: false };
};

// Durum etiketleri için yardımcı fonksiyon
const getStatusClasses = (status: string) => {
    switch (status) {
        case 'Aktif': return 'bg-green-100 text-green-800 border-green-300';
        case 'Beklemede': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
        case 'Pasif': return 'bg-red-100 text-red-800 border-red-300';
        case 'Reddedildi': return 'bg-red-100 text-red-700';
        case 'Onaylandı': return 'bg-green-100 text-green-700';
        default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
};


// --- ANA SAYFA BİLEŞENİ ---

export default function MembershipsPage() {
    
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    
    const { role, isLoading: isLoadingAuth } = useMockAuth();
    // Yalnızca ADMIN ve STAFF yetkili
    const isAuthorized = useMemo(() => role === 'ADMIN' || role === 'STAFF', [role]); 

    // --- VERİ ÇEKME (REACT-QUERY) ---
    // Başarılı işlem sonrası cache'i yenileme fonksiyonu
    const onSuccessInvalidate = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['memberships'] });
        queryClient.invalidateQueries({ queryKey: ['pendingRequests'] });
        queryClient.invalidateQueries({ queryKey: ['requestHistory'] });
    }, [queryClient]);
    
    const { data: memberships = [], isLoading: loadingMemberships } = useQuery<MembershipData[]>({
        queryKey: ['memberships'],
        queryFn: fetchMemberships,
        enabled: isAuthorized,
        refetchOnWindowFocus: false,
    });

    const { data: pendingRequests = [], isLoading: loadingRequests } = useQuery<RequestData[]>({
        queryKey: ['pendingRequests'],
        queryFn: fetchPendingRequests,
        enabled: isAuthorized,
        refetchOnWindowFocus: false,
    });
    
    const { data: history = [], isLoading: loadingHistory } = useQuery<RequestData[]>({
        queryKey: ['requestHistory'],
        queryFn: fetchRequestHistory,
        enabled: isAuthorized,
        refetchOnWindowFocus: false,
    });

    // --- MUTATION (İŞLEM) HOOKLARI ---
    const approveMutation = useMutation({
        mutationFn: approveRequest,
        onSuccess: onSuccessInvalidate,
    });

    const rejectMutation = useMutation({
        mutationFn: rejectRequest,
        onSuccess: onSuccessInvalidate,
    });


    // --- MODAL YÖNETİMİ ---
    const isRequestModalOpen = searchParams.get('modal') === 'requests';
    const isRejectModalOpen = searchParams.get('modal') === 'reject';
    const [selectedRequestToReject, setSelectedRequestToReject] = useState<RequestData | null>(null);

    const openRequestModal = () => router.push('/memberships?modal=requests', { scroll: false });
    const closeModals = () => {
        setSelectedRequestToReject(null);
        router.push('/memberships', { scroll: false });
    }

    // --- STAFF/ADMIN Aksiyonları ---

    const handleApprove = useCallback(async (requestId: string) => {
        try {
            await approveMutation.mutateAsync(requestId);
        } catch (error) {
            console.error("Onaylama başarısız oldu:", error);
        }
    }, [approveMutation]);

    const handleRejectStart = useCallback((request: RequestData) => {
        setSelectedRequestToReject(request);
        router.push('/memberships?modal=reject', { scroll: false }); 
    }, [router]);

    const handleReject = useCallback(async (requestId: string, reason: string) => {
        try {
            await rejectMutation.mutateAsync({ requestId, reason });
            closeModals();
        } catch (error) {
            console.error("Reddetme başarısız oldu:", error);
        }
    }, [rejectMutation, closeModals]);


    // --- Yükleniyor ve Erişim Engeli ---
    const isLoadingData = loadingMemberships || loadingRequests || loadingHistory || isLoadingAuth;
    const isProcessing = approveMutation.isPending || rejectMutation.isPending;

    if (isLoadingData) return <DashboardLayout><div className="p-4 flex items-center justify-center h-screen text-gray-500"><ArrowPathIcon className="w-5 h-5 mr-2 animate-spin"/> Veriler Yükleniyor...</div></DashboardLayout>;
    
    if (!isAuthorized) {
        return (
             <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-red-500 p-8">
                    <LockClosedIcon className="w-12 h-12 mb-4" />
                    <h2 className="text-xl font-semibold">Yetkisiz Erişim</h2>
                    <p className="text-gray-500">Bu alan sadece yönetici ve personel (ADMIN/STAFF) yetkisine sahiptir.</p>
                </div>
            </DashboardLayout>
        );
    } 

    return (
        <>
            <DashboardLayout>
                <div className="p-4 md:p-8">
                    
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-extrabold text-gray-800">💳 Üyelik Yönetimi</h1>
                        <div className="space-x-3">
                            <Link 
                                href="/admin/packages" 
                                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:ring-indigo-500 transition"
                            >
                                <ArrowUpRightIcon className="w-5 h-5 mr-2" /> Paketleri Yönet
                            </Link>
                            {/* Yeni Üyelik Ata Linki: Oluşturma mantığı ayrı sayfaya taşındı */}
                            <Link 
                                href="/memberships/new" 
                                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 transition"
                            >
                                <PlusCircleIcon className="w-5 h-5 mr-2" /> Yeni Üyelik Ata
                            </Link>
                        </div>
                    </div>

                    {/* --- İSTEK YÖNETİM KARTI --- */}
                    <div 
                        onClick={openRequestModal}
                        className="flex items-center justify-between p-6 bg-yellow-50 border-l-4 border-yellow-400 rounded-xl shadow-lg cursor-pointer hover:bg-yellow-100 transition-colors mb-6"
                    >
                        <div className="flex items-center">
                            <BellAlertIcon className="w-8 h-8 text-yellow-600 mr-4" />
                            <div>
                                <p className="text-lg font-semibold text-yellow-800">Bekleyen Üyelik İstekleri</p>
                                <p className="text-sm text-yellow-700">{pendingRequests.length} adet yeni paket talebi var.</p>
                            </div>
                        </div>
                        <span className="text-xl font-bold text-yellow-800 bg-yellow-300 px-3 py-1 rounded-full">{pendingRequests.length}</span>
                        {isProcessing && <div className="ml-4 text-indigo-600 text-sm">İşleniyor...</div>}
                    </div>
                    
                    {/* --- AKTİF ÜYELİK TABLOSU --- */}
                    <h2 className="text-xl font-bold text-gray-700 mb-4 border-b pb-2">Aktif Üyelik Listesi</h2>
                    <div className="bg-white shadow-xl rounded-xl border border-gray-100 overflow-x-auto mb-10">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Üye Adı</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paket Adı</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bitiş Tarihi</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {memberships.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-6 text-gray-500">Aktif üyelik bulunmamaktadır.</td>
                                    </tr>
                                ) : (
                                    memberships.map((m) => (
                                        <tr key={m.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{m.member_name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.package_name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{m.end_date}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full border ${getStatusClasses(m.status)}`}>
                                                    {m.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <Link href={`/memberships/${m.id}`} className="text-indigo-600 hover:text-indigo-900">Detay / Hak Yönetimi</Link>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* --- İSTEK GEÇMİŞİ KARTI/LİSTESİ --- */}
                    <h2 className="text-xl font-bold text-gray-700 mb-4 border-b pb-2">İstek Yönetimi Geçmişi</h2>
                    <div className="bg-white shadow-xl rounded-xl border border-gray-100 p-4">
                        <ul className="divide-y divide-gray-100">
                            {history.length === 0 ? (
                                <li className="text-center py-4 text-gray-500 text-sm">Geçmiş kayıt bulunmamaktadır.</li>
                            ) : (
                                history.map(item => (
                                    <li key={item.id} className="py-2 text-sm flex justify-between items-center">
                                        <span className="font-medium text-gray-900">{item.member_name} - {item.package_name}</span>
                                        <div className='flex items-center space-x-4'>
                                            {item.status === 'Reddedildi' && item.rejection_reason && (
                                                <span className='text-xs text-red-500 italic truncate max-w-xs'>
                                                    Sebep: {item.rejection_reason}
                                                </span>
                                            )}
                                            <span className={`text-xs px-2 py-1 rounded-full border ${getStatusClasses(item.status)}`}>
                                                {item.status}
                                            </span>
                                        </div>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </div>
            </DashboardLayout>
            
            {/* --- MODALS --- */}
            {/* Bu modal'lar, önceki versiyonda çok satır kaplayan listeleme ve form mantığını içermelidir. */}
            <RequestManagementModal 
                isOpen={isRequestModalOpen}
                onClose={closeModals}
                requests={pendingRequests}
                onApprove={handleApprove}
                onRejectStart={handleRejectStart}
                isProcessing={isProcessing}
            />

            {selectedRequestToReject && (
                <RejectionReasonModal
                    isOpen={isRejectModalOpen}
                    onClose={closeModals}
                    request={selectedRequestToReject}
                    onReject={handleReject}
                    isProcessing={isProcessing}
                />
            )}   
        </>
    );
}