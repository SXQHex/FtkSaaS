// src/app/memberships/new/page.tsx (TİP UYUMLULUĞU DÜZELTİLMİŞ NİHAİ SÜRÜM)
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
    PlusCircleIcon, LockClosedIcon, 
    ArrowPathIcon, CheckCircleIcon, XCircleIcon, ArrowLeftIcon 
} from '@heroicons/react/24/outline'; 
import Link from 'next/link';

// --- HARİCİ TİP VE API İMPORTLARI ---
import { UserRole } from '@/types/auth'; 
// Bu tiplerin normalde '@/types/memberships' dosyasından gelmesi beklenir.
// Hata 2339'u çözmek için gereken alanları burada varsayılan tiplere ekliyoruz:

// DÜZELTİLMİŞ TİP TANIMLARI
interface UserSelectionData {
    id: string;
    name: string; // Kullanıcının tam adı
    role?: string; // 🚨 HATA ÇÖZÜMÜ: user.role eklendi
}

interface PackageData {
    id: string;
    name: string;
    price: number;
    description?: string; // 🚨 HATA ÇÖZÜMÜ: description eklendi
    session_count?: number; // 🚨 HATA ÇÖZÜMÜ: session_count eklendi
    session_type?: string; // 🚨 HATA ÇÖZÜMÜ: session_type eklendi
}
// ------------------------------------

// --- API FONKSİYONLARI ---
import { 
    fetchPackages, 
    fetchUsersForSelection, 
    submitMembershipRequest 
} from '@/lib/mock-api-memberships'; 

// --- MUTATION TİP TANIMLARI ---
interface SubmitRequestVariables {
    memberId: string; 
    packageId: string; 
    memberName: string; 
    submittedByUserId: string; 
    isAdminOrStaff: boolean;
}

interface SubmitRequestSuccess {
    success: boolean; 
    memberName: string;
}

// --- MOCK YETKİLENDİRME ---
const useMockAuth = () => {
    // Sadece ADMIN ve STAFF bu sayfaya erişebilmelidir.
    const [role, setRole] = useState<UserRole>('ADMIN'); // 🚨 Test Rolü
    const [userId, setUserId] = useState<string>('t1'); // Talep gönderen kullanıcı ID'si
    return { role, userId, isLoading: false };
};


// --- ANA SAYFA BİLEŞENİ ---

export default function NewMembershipPage() {
    
    const router = useRouter();
    const queryClient = useQueryClient();
    
    const { role, userId: submittingUserId, isLoading: isLoadingAuth } = useMockAuth();
    const isAuthorized = useMemo(() => role === 'ADMIN' || role === 'STAFF', [role]); 

    // --- FORM DURUMU ---
    const [selectedUser, setSelectedUser] = useState('');
    const [selectedPackage, setSelectedPackage] = useState('');
    const [formSuccess, setFormSuccess] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);

    // --- VERİ ÇEKME (REACT-QUERY) ---
    const { data: packages = [], isLoading: loadingPackages } = useQuery<PackageData[]>({
        queryKey: ['packages'],
        queryFn: fetchPackages,
        enabled: isAuthorized,
        staleTime: Infinity, 
    });
    
    const { data: users = [], isLoading: loadingUsers } = useQuery<UserSelectionData[]>({
        queryKey: ['usersForSelection'],
        queryFn: fetchUsersForSelection,
        enabled: isAuthorized,
        staleTime: Infinity,
    });
    
    // Seçilen üyenin adını bulma
    const memberName = useMemo(() => {
        // user.name yapısının "Ad Soyad (rol)" şeklinde olduğunu varsayıyoruz,
        // bu yüzden parantez içini ayıklıyoruz.
        const fullNameWithRole = users.find(u => u.id === selectedUser)?.name || '';
        return fullNameWithRole.split(' (')[0] || '';
    }, [selectedUser, users]);

    // --- MUTATION (İŞLEM) HOOK'U ---
    const submitRequestMutation = useMutation<
        SubmitRequestSuccess, 
        Error, 
        SubmitRequestVariables
    >({
        mutationFn: submitMembershipRequest,
        onSuccess: (result) => {
            setFormSuccess(`${result.memberName} için üyelik talebi başarıyla oluşturuldu ve onaya gönderildi.`);
            setFormError(null);
            // Başarılı işlem sonrası formu temizle
            setSelectedUser('');
            setSelectedPackage('');
            // Bekleyen istekler listesini yenile
            queryClient.invalidateQueries({ queryKey: ['pendingRequests'] }); 
        },
        onError: (e: Error) => {
            setFormError(`Talep oluşturulurken bir hata oluştu: ${e.message}`);
            setFormSuccess(null);
        }
    });
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!selectedUser || !selectedPackage || !memberName || submitRequestMutation.isPending) return;

        setFormSuccess(null);
        setFormError(null);

        submitRequestMutation.mutate({
            memberId: selectedUser,
            packageId: selectedPackage,
            memberName: memberName,
            submittedByUserId: submittingUserId,
            isAdminOrStaff: role === 'ADMIN' || role === 'STAFF',
        });
    };

    // --- Yükleniyor ve Erişim Engeli ---
    const isLoadingData = loadingPackages || loadingUsers || isLoadingAuth;
    const isProcessing = submitRequestMutation.isPending;

    if (isLoadingData) {
        return (
            <DashboardLayout>
                <div className="p-4 flex items-center justify-center h-screen text-gray-500">
                    <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin"/> Veriler Yükleniyor...
                </div>
            </DashboardLayout>
        );
    } 
    
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

    // Seçilen paketi bulma
    const selectedPackageData = packages.find(p => p.id === selectedPackage);

    return (
        <DashboardLayout>
            <div className="p-4 md:p-8">
                <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-lg border-t-4 border-indigo-500">
                    
                    <Link href="/memberships" className="flex items-center text-sm text-indigo-600 hover:text-indigo-800 mb-6">
                        <ArrowLeftIcon className="w-4 h-4 mr-1" /> Geri Dön
                    </Link>
                    
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center">
                        <PlusCircleIcon className="w-7 h-7 mr-3 text-indigo-600" />
                        Yeni Üyelik Ata
                    </h1>
                    <p className="text-sm text-gray-600 mb-6">
                        Seçilen üye için yeni bir paket talebi oluşturun. Bu talep, onay mekanizmasına göre işleme alınacaktır.
                    </p>

                    {/* --- MESAJ ALANLARI --- */}
                    {formSuccess && (
                        <div className="bg-green-100 border border-green-400 text-green-700 p-3 rounded-lg mb-4 flex items-center">
                            <CheckCircleIcon className="w-5 h-5 mr-2" /> {formSuccess}
                        </div>
                    )}
                    {formError && (
                        <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded-lg mb-4 flex items-center">
                            <XCircleIcon className="w-5 h-5 mr-2" /> {formError}
                        </div>
                    )}
                    
                    {/* --- FORM --- */}
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label htmlFor="member" className="block text-sm font-medium text-gray-700">Üye Seçimi</label>
                            <select
                                id="member"
                                value={selectedUser}
                                onChange={(e) => setSelectedUser(e.target.value)}
                                required
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                                disabled={isProcessing}
                            >
                                <option value="">-- Üye Seçiniz --</option>
                                {users.map((user) => (
                                    // 🚨 HATA ÇÖZÜMÜ: user.role artık UserSelectionData'da tanımlı (opsiyonel)
                                    <option key={user.id} value={user.id}>
                                        {user.name} {user.role ? `(${user.role})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="package" className="block text-sm font-medium text-gray-700">Paket Seçimi</label>
                            <select
                                id="package"
                                value={selectedPackage}
                                onChange={(e) => setSelectedPackage(e.target.value)}
                                required
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md shadow-sm"
                                disabled={isProcessing}
                            >
                                <option value="">-- Paket Seçiniz --</option>
                                {packages.map((pkg) => (
                                    // 🚨 HATA ÇÖZÜMÜ: session_count ve session_type artık PackageData'da tanımlı (opsiyonel)
                                    <option key={pkg.id} value={pkg.id}>
                                        {pkg.name} ({pkg.session_count || '?'} {pkg.session_type || 'adet'}, {pkg.price} TL)
                                    </option>
                                ))}
                            </select>
                            {selectedPackageData?.description && (
                                // 🚨 HATA ÇÖZÜMÜ: description artık PackageData'da tanımlı (opsiyonel)
                                <p className="mt-2 text-xs text-gray-500">
                                    Paket Açıklaması: {selectedPackageData.description}
                                </p>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={isProcessing || !selectedUser || !selectedPackage}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition"
                        >
                            {isProcessing ? (
                                <>
                                    <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                                    Talep Oluşturuluyor...
                                </>
                            ) : (
                                <>
                                    <PlusCircleIcon className="w-5 h-5 mr-2" />
                                    Talep Oluştur ve Onaya Gönder
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </DashboardLayout>
    );
}