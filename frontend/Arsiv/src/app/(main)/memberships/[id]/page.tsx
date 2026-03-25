// src/app/memberships/[id]/page.tsx (GELİŞTİRİLMİŞ NİHAİ SÜRÜM)
"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { ArrowPathIcon, CheckCircleIcon, ArrowLeftIcon, LockClosedIcon, PencilSquareIcon, UserCircleIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// --- MERKEZİ TİP ve API İMPORTLARI ---
import { UserRole } from '@/types/auth'; 
import { MembershipData } from '@/types/memberships'; 
import { 
    fetchMembershipDetail, 
    updateMembershipSessionsAndNotes 
} from '@/lib/mock-api-memberships'; // API katmanı


// --- MOCK YETKİLENDİRME SIMÜLASYONU ---
const useMockAuth = () => {
    // Role'ü dinamik olarak başlatarak TypeScript kısıtlamalarını aşarız.
    const [role, setRole] = useState<UserRole>('ADMIN'); // 🚨 TEST ROLÜ: 'MEMBER', 'STAFF', 'TRAINER', 'ADMIN'
    const [userId, setUserId] = useState<string>('u1'); // u1: Ayşe Yılmaz (MEMBER)
    
    // Gerçek uygulamada bu bir API çağrısı olur.
    return { role, userId, isLoading: false };
};
// --- MOCK SIMÜLASYON SONU ---


export default function MembershipDetailPage() {
    const { id } = useParams<{ id: string }>(); 
    const router = useRouter();
    const queryClient = useQueryClient();
    
    const { role, userId, isLoading: isLoadingAuth } = useMockAuth(); 

    // --- Durum Yönetimi ---
    const [formData, setFormData] = useState<{ remaining_sessions: number; notes: string }>({ remaining_sessions: 0, notes: '' });
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // --- Yetki Kontrolü ---
    const canEdit = useMemo(() => role === 'ADMIN' || role === 'STAFF', [role]);
    const isTrainer = useMemo(() => role === 'TRAINER', [role]);
    const isMember = useMemo(() => role === 'MEMBER', [role]);
    const canViewInternal = useMemo(() => canEdit || isTrainer || isMember, [canEdit, isTrainer, isMember]);


    // --- VERİ ÇEKME (REACT-QUERY) ---
    const { data: membership, isLoading: isLoadingData, isError, error: queryError } = useQuery<MembershipData>({
        queryKey: ['membershipDetail', id],
        queryFn: () => fetchMembershipDetail(id),
        // Sadece yetkisi olan ve ID'si dolu olanlar için API çağrısı yap
        enabled: canViewInternal && !!id && !isLoadingAuth, 
        refetchOnWindowFocus: false,
    });
    
    // Veri geldiğinde formu güncelle
    useEffect(() => {
        if (membership) {
            // Üyenin sadece kendi üyeliğini görebilmesi için son kontrol
            if (isMember && membership.member_id !== userId) {
                setError("Bu üyelik kaydını görüntüleme yetkiniz yok.");
            } else {
                setFormData({
                    remaining_sessions: membership.remaining_sessions,
                    notes: membership.notes
                });
                setError(null);
                setSuccess(null);
            }
        }
    }, [membership, isMember, userId]);


    // --- MUTATION (GÜNCELLEME) HOOK'U ---
    const updateMutation = useMutation({
        mutationFn: updateMembershipSessionsAndNotes,
        onSuccess: (updatedData) => {
            // React Query Cache'i manuel olarak güncelle
            queryClient.setQueryData(['membershipDetail', id], updatedData);
            setSuccess('Üyelik hakları başarıyla güncellendi!');
            // Form verisini de güncel veriye eşle
            setFormData({
                remaining_sessions: updatedData.remaining_sessions,
                notes: updatedData.notes
            });
            setError(null);
        },
        onError: (e: Error) => {
            setError(`Haklar güncellenirken bir hata oluştu: ${e.message}`);
            setSuccess(null);
        }
    });

    // --- Olay Yöneticileri ---
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!canEdit) {
            setError('Bu işlemi yapmaya yetkiniz yok.');
            return;
        }

        updateMutation.mutate({
            membershipId: id,
            ...formData
        });
    };
    
    // --- Yükleniyor ve Hata Kontrolü ---
    const currentError = error || (isError ? queryError?.message : null);
    
    if (isLoadingAuth || isLoadingData) {
        return <DashboardLayout><div className="p-8 text-center text-gray-500">Yükleniyor...</div></DashboardLayout>;
    }
    
    const backLink = isMember ? '/user-profile' : '/memberships';

    // Hata veya Kayıt Bulunamaması
    if (currentError || !membership) {
        return (
             <DashboardLayout>
                <div className="p-8 flex flex-col items-center justify-center h-full min-h-[400px] bg-white rounded-xl shadow-lg m-4">
                    <LockClosedIcon className="w-12 h-12 text-red-500 mb-4" />
                    <p className="text-xl font-semibold text-red-700">Erişim Engellendi / Hata</p>
                    <p className="text-gray-500 mt-2">{currentError || "İstenen üyelik kaydı bulunamadı."}</p>
                    <Link href={backLink} className="mt-6 text-indigo-600 hover:text-indigo-800 font-medium">
                        <ArrowLeftIcon className="w-4 h-4 mr-1 inline" /> Geri Dön
                    </Link>
                </div>
            </DashboardLayout>
        );
    }
    
    
    // --- Sayfa İçeriği ---
    return (
        <DashboardLayout>
            <div className="p-4 md:p-8">
                
                <Link href={backLink} className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors mb-6">
                    <ArrowLeftIcon className="w-5 h-5 mr-1" />
                    {isMember ? 'Profile Geri Dön' : 'Tüm Üyeliklere Geri Dön'}
                </Link>

                <h1 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center">
                    <UserCircleIcon className="w-8 h-8 mr-3 text-indigo-600" />
                    {membership.member_name} Üyeliği Detayı
                </h1>
                
                {/* Başarı Mesajı */}
                {success && (
                    <div className="bg-green-100 border border-green-400 text-green-700 p-3 rounded-lg mb-4 flex items-center">
                        <CheckCircleIcon className="w-5 h-5 mr-2" /> {success}
                    </div>
                )}
                {/* Hata Mesajı */}
                {updateMutation.isError && (
                     <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded-lg mb-4 flex items-center">
                        <LockClosedIcon className="w-5 h-5 mr-2" /> {updateMutation.error.message}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Sol Sütun: Temel Bilgiler */}
                    <div className="lg:col-span-1 space-y-4">
                        <div className="bg-white p-6 rounded-xl shadow-lg space-y-3 border-t-4 border-indigo-500">
                            <p className="text-xl font-bold text-gray-800 border-b pb-2 mb-2">{membership.package_name}</p>
                            
                            <DetailItem label="Üye Adı" value={membership.member_name} icon={UserCircleIcon} />
                            <DetailItem label="E-Posta" value={membership.email} />
                            <DetailItem 
                                label="Başlangıç Tarihi" 
                                value={new Date(membership.start_date).toLocaleDateString('tr-TR')} 
                                icon={CalendarDaysIcon} 
                            />
                            <DetailItem 
                                label="Bitiş Tarihi" 
                                value={new Date(membership.end_date).toLocaleDateString('tr-TR')} 
                                className="font-bold text-red-500"
                                icon={CalendarDaysIcon}
                            />
                            <DetailItem 
                                label="Durum" 
                                value={membership.status} 
                                className={`font-semibold ${membership.status === 'Aktif' ? 'text-green-600' : 'text-red-600'}`}
                            />
                        </div>
                    </div>

                    {/* Sağ Sütun: Hak Yönetimi (Form) */}
                    <div className="lg:col-span-2">
                        <h2 className="text-xl font-semibold text-gray-800 border-b pb-2 mb-4 flex items-center">
                            <PencilSquareIcon className="w-5 h-5 mr-2 text-indigo-500" />
                            {canEdit ? 'Hak Yönetimi ve Yönetici Notları' : 'Kalan Kullanım Hakları'}
                        </h2>
                        
                        {/* Sadece ADMIN/STAFF Formu Görebilir */}
                        {canEdit ? (
                            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100">
                                <div className="space-y-4">
                                    <div>
                                        <label htmlFor="sessions" className="block text-sm font-medium text-gray-700">
                                            Kalan **{membership.session_type}** Sayısı
                                        </label>
                                        <input
                                            type="number"
                                            id="sessions"
                                            value={formData.remaining_sessions}
                                            onChange={(e) => setFormData(prev => ({ ...prev, remaining_sessions: parseInt(e.target.value) || 0 }))}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-lg p-2"
                                            min="0"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                                            Yönetici Notları (Sadece Personel/Admin Görür)
                                        </label>
                                        <textarea
                                            id="notes"
                                            rows={3}
                                            value={formData.notes}
                                            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2"
                                            placeholder="Özel talimatlar, ödeme detayları vb."
                                        />
                                    </div>
                                </div>
                                
                                <button
                                    type="submit"
                                    disabled={updateMutation.isPending}
                                    className="mt-6 w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                                >
                                    {updateMutation.isPending ? (
                                        <>
                                            <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" />
                                            Kaydediliyor...
                                        </>
                                    ) : (
                                        'Hakları Güncelle ve Kaydet'
                                    )}
                                </button>
                            </form>
                        ) : (
                            // TRAINER ve MEMBER Sadece Okuma Görünümü
                            <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
                                <p className="text-sm text-gray-500">Kalan Hak Sayısı</p>
                                <p className="text-3xl font-extrabold text-indigo-600 mb-4">
                                    {membership.remaining_sessions} <span className="text-xl text-indigo-400 font-medium">{membership.session_type}</span>
                                </p>
                                
                                <h3 className="text-lg font-semibold text-gray-700 border-t pt-4 mt-4">Yönetici Notları:</h3>
                                <p className="text-gray-500 italic text-sm">{membership.notes || "Yönetici notu bulunmamaktadır."}</p>
                                
                                {isTrainer && (
                                    <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800">
                                        <p className="font-semibold">Bilgi:</p>
                                        <p className="text-sm">Eğitmen olarak üyelik haklarını doğrudan düzenleyemezsiniz. Düzenleme için Personel'e (STAFF) başvurun.</p>
                                    </div>
                                )}
                            </div>
                        )}
                        
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
}

// Yardımcı Bileşen
const DetailItem: React.FC<{ label: string, value: string | number, className?: string, icon?: React.ElementType }> = ({ label, value, className, icon: Icon }) => (
    <div className="flex justify-between items-center text-sm border-b border-gray-50 last:border-b-0 py-1">
        <span className="font-medium text-gray-600 flex items-center">
            {Icon && <Icon className="w-4 h-4 mr-2 text-indigo-400" />}
            {label}:
        </span>
        <span className={`font-medium ${className}`}>{value}</span>
    </div>
);