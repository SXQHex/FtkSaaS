// src/app/memberships/request/page.tsx (GELİŞTİRİLMİŞ VE MUTATION UYUMLU SÜRÜM)
"use client";

import React, { useState, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { UserRole } from '@/types/auth'; 
import { CheckCircleIcon, PaperAirplaneIcon, ArrowPathIcon, MagnifyingGlassIcon, UserIcon} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';

// --- MOCK API HİZMETLERİ ---
import { 
    fetchPackages, 
    fetchUsersForSelection, 
    submitMembershipRequest 
} from '@/lib/mock-api-memberships'; // Varsayılan mock API importu
import { PackageData, UserSelectionData } from '@/types/memberships';

// --- MOCK AUTH HOOK (Role MANTIK İÇİN) ---
const useMockAuth = () => {
    // 🛑 TEST DEĞİŞKENİ: 'MEMBER', 'STAFF', veya 'ADMIN' olarak değiştirerek test edebilirsiniz.
    const TEST_ROLE = 'ADMIN' as UserRole;
    
    return { 
        role: TEST_ROLE,
        userId: TEST_ROLE === 'MEMBER' ? 'u1' : 't1', 
        memberName: TEST_ROLE === 'MEMBER' ? 'Ayşe Yılmaz' : 'Burak Demir (Personel)',
        isAuthenticated: true,
        isLoading: false
    };
};


export default function MembershipRequestPage() {
    const { role, memberName, userId, isAuthenticated, isLoading: isLoadingAuth } = useMockAuth();
    
    // --- VERİ ÇEKME (MOCK) ---
    // Gerçekte useQuery ile çekilmelidir. Basit tutmak için burada mock olarak tutuldu.
    const mockPackages: PackageData[] = fetchPackages();
    const mockUsers: UserSelectionData[] = fetchUsersForSelection();

    // --- STATE YÖNETİMİ ---
    const [selectedPackage, setSelectedPackage] = useState(mockPackages[0]?.id || '');
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // ADMIN/STAFF için Üye Seçimi State'leri
    const isAdminOrStaff = useMemo(() => ['ADMIN', 'STAFF'].includes(role), [role]);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(isAdminOrStaff && mockUsers.length > 0 ? mockUsers[0].id : null);
    const [searchTerm, setSearchTerm] = useState('');


    // Seçilen üyenin adını dinamik olarak belirliyoruz
    const currentMemberInfo = useMemo(() => {
        if (!isAdminOrStaff) {
            return { id: userId, name: memberName };
        }
        const member = mockUsers.find(u => u.id === selectedMemberId);
        return { id: selectedMemberId, name: member?.name || 'Üye Seçilmedi' };
    }, [isAdminOrStaff, selectedMemberId, memberName, mockUsers, userId]);

    
    // --- MUTATION (İŞLEM) HOOK'U ---
    const submitMutation = useMutation({
        mutationFn: submitMembershipRequest,
        onSuccess: (data, variables) => {
            const packageName = mockPackages.find(p => p.id === variables.packageId)?.name;
            const submitterName = isAdminOrStaff ? `Personel (${memberName}) tarafından` : 'kendi adına';
            
            setSuccessMessage(`Tebrikler, "${packageName}" paketi için istek başarıyla alındı. ${data.memberName} adına ${submitterName} oluşturulmuştur.`);
        },
        onError: (error) => {
            console.error("İstek gönderimi başarısız oldu:", error);
            setSuccessMessage(`Hata: İstek gönderilemedi. Lütfen tekrar deneyin. (${error.message})`);
        }
    });


    // --- YÖNLENDİRMELER VE FORMLAR ---
    if (isLoadingAuth) return <DashboardLayout><div className="p-4">Yükleniyor...</div></DashboardLayout>;
    
    if (role === 'GUEST' && !isAuthenticated) {
        return (
             <DashboardLayout>
                <div className="p-10 text-center">
                    <p className="text-xl font-semibold text-gray-700">Lütfen önce giriş yapın.</p>
                    <Link href="/login" className="text-indigo-600 hover:underline">Giriş Yap / Üye Ol</Link>
                </div>
            </DashboardLayout>
        );
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (isAdminOrStaff && !selectedMemberId) {
            alert("Lütfen bir üye seçin.");
            return;
        }

        submitMutation.mutate({
            memberId: currentMemberInfo.id!,
            packageId: selectedPackage,
            memberName: currentMemberInfo.name,
            submittedByUserId: userId,
            isAdminOrStaff: isAdminOrStaff,
        });
    };

    const filteredUsers = useMemo(() => {
        return mockUsers.filter(user =>
            user.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [mockUsers, searchTerm]);
    
    const isSubmitting = submitMutation.isPending;

    return (
        <DashboardLayout>
            <div className="max-w-3xl mx-auto p-6">
                <h1 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center">
                    <PaperAirplaneIcon className="w-7 h-7 mr-3 text-indigo-600" />
                    Yeni Üyelik / Paket Başvurusu
                </h1>
                
                {successMessage ? (
                    // Başarı Mesajı
                    <div className={`border p-6 rounded-xl text-center ${successMessage.startsWith('Hata') ? 'bg-red-100 border-red-400 text-red-700' : 'bg-green-100 border-green-400 text-green-700'}`}>
                        <CheckCircleIcon className="w-10 h-10 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">Başvuru {successMessage.startsWith('Hata') ? 'Başarısız' : 'Başarılı'}!</h2>
                        <p className="text-lg">{successMessage}</p>
                        <Link href="/memberships" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
                           {isAdminOrStaff ? 'Üyelik Yönetimine Geri Dön' : 'Mevcut Üyelik Durumuna Geri Dön'}
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="bg-white p-8 rounded-xl shadow-lg">
                        
                        {/* 🛑 PERSONEL/ADMIN ÜYE SEÇİMİ ARAYÜZÜ */}
                        {isAdminOrStaff && (
                            <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center">
                                     <MagnifyingGlassIcon className="w-5 h-5 mr-2" />
                                     Üye Seçimi (Personel/Admin)
                                </h2>
                                
                                <div className="relative mb-3">
                                    <input
                                        type="text"
                                        placeholder="Üye adı veya ID ile arayın..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                                    />
                                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                </div>

                                <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                    {filteredUsers.map((user) => (
                                        <div 
                                            key={user.id}
                                            onClick={() => setSelectedMemberId(user.id)}
                                            className={`p-2 rounded-lg cursor-pointer transition-colors text-sm ${
                                                selectedMemberId === user.id
                                                    ? 'bg-indigo-200 font-semibold text-indigo-800'
                                                    : 'hover:bg-gray-100 text-gray-700'
                                            }`}
                                        >
                                            {user.name}
                                        </div>
                                    ))}
                                    {filteredUsers.length === 0 && <p className="text-center text-gray-500 text-sm py-2">Eşleşen üye bulunamadı.</p>}
                                </div>
                                <p className={`mt-3 text-sm font-medium flex items-center ${selectedMemberId ? 'text-green-600' : 'text-red-600'}`}>
                                    <UserIcon className="w-4 h-4 mr-1"/> Seçili Üye: **{currentMemberInfo.name}**
                                </p>
                            </div>
                        )}
                        
                        {/* Ortak Giriş Mesajı */}
                        <p className="mb-6 text-gray-600">
                            Merhaba **{memberName}**, {isAdminOrStaff ? `**${currentMemberInfo.name}** için` : 'size en uygun'} paketi seçin ve {isAdminOrStaff ? 'atama işlemini başlatın.' : 'satın alma isteğini gönderin.'}
                        </p>

                        {/* Paket Seçimi */}
                        <div className="space-y-4 mb-8">
                            {mockPackages.map((pkg) => (
                                <label 
                                    key={pkg.id}
                                    className={`block p-4 border rounded-lg cursor-pointer transition-all ${
                                        selectedPackage === pkg.id 
                                            ? 'border-indigo-500 ring-2 ring-indigo-500 bg-indigo-50' 
                                            : 'border-gray-300 hover:border-indigo-300'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="package"
                                        value={pkg.id}
                                        checked={selectedPackage === pkg.id}
                                        onChange={(e) => setSelectedPackage(e.target.value)}
                                        className="hidden"
                                        required
                                    />
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-lg font-semibold text-gray-900">{pkg.name}</p>
                                            <p className="text-sm text-gray-500">{pkg.details}</p>
                                        </div>
                                        <p className="text-xl font-bold text-indigo-700">
                                            {pkg.price.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                        </p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        {/* Gönder Butonu */}
                        <button
                            type="submit"
                            disabled={isSubmitting || (isAdminOrStaff && !selectedMemberId)}
                            className={`w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white transition-colors ${
                                (isSubmitting || (isAdminOrStaff && !selectedMemberId)) ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                                    İstek Gönderiliyor...
                                </>
                            ) : (
                                <>
                                    <PaperAirplaneIcon className="w-5 h-5 mr-2" />
                                    {isAdminOrStaff ? 'Üyeye Paket Ata' : 'Seçili Paketi Talep Et'}
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </DashboardLayout>
    );
}