// src/app/payments/page.tsx (REVİZE EDİLMİŞ VERSİYON)
"use client";

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { CurrencyDollarIcon, ArrowPathIcon, LockClosedIcon, EyeIcon } from '@heroicons/react/24/outline';

// --- TİP TANIMLARI ---
type UserRole = 'ADMIN' | 'STAFF' | 'TRAINER' | 'ASSISTANT' | 'MEMBER' | 'GUEST';

interface PaymentRecord {
    id: string;
    user_id: string; // Ödemeyi yapanın ID'si (Member)
    member_name: string;
    amount: number;
    payment_date: string;
    status: 'Ödendi' | 'Bekliyor' | 'Gecikti';
    method: 'Kredi Kartı' | 'Nakit' | 'Havale';
}

// --- MOCK YETKİLENDİRME HOOK'U SIMÜLASYONU (TEST İÇİN) ---
const useMockAuth = () => {
    // 🚨🚨 TEST AMAÇLI ROLÜ VE ID'Yİ BURADAN DEĞİŞTİRİN 🚨🚨
    const initialRole: UserRole = 'MEMBER'; 
    const initialUserId = 'u1'; // 'MEMBER' rolü için bu id'ye ait ödemeler görünür
    
    // State kullanarak TypeScript'in tip daraltmasını engelliyoruz
    const [role, setRole] = useState<UserRole>(initialRole);
    const [userId, setUserId] = useState<string>(initialUserId);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => setLoading(false), 500);
        return () => clearTimeout(timer);
    }, []);

    return { role, userId, isLoading: loading };
};

// --- MOCK VERİ ---
const mockPayments: PaymentRecord[] = [
    { id: 'p1', user_id: 'u1', member_name: 'Ayşe Yılmaz', amount: 500.00, payment_date: '2025-11-05', status: 'Ödendi', method: 'Kredi Kartı' },
    { id: 'p2', user_id: 'u2', member_name: 'Mehmet Kaya', amount: 1200.00, payment_date: '2025-12-01', status: 'Bekliyor', method: 'Nakit' },
    { id: 'p3', user_id: 'u3', member_name: 'Ali Çelik', amount: 750.00, payment_date: '2025-10-25', status: 'Gecikti', method: 'Havale' },
    { id: 'p4', user_id: 'u1', member_name: 'Ayşe Yılmaz', amount: 250.00, payment_date: '2025-11-15', status: 'Ödendi', method: 'Kredi Kartı' },
    { id: 'p5', user_id: 'u4', member_name: 'Canan Demir', amount: 800.00, payment_date: '2025-12-10', status: 'Ödendi', method: 'Havale' },
];

// Helper: Durum Etiketleri
const getStatusClasses = (status: string) => {
    switch (status) {
        case 'Ödendi': return 'bg-green-100 text-green-800';
        case 'Bekliyor': return 'bg-yellow-100 text-yellow-800';
        case 'Gecikti': return 'bg-red-100 text-red-800';
        default: return 'bg-gray-100 text-gray-800';
    }
};

// --- ANA SAYFA BİLEŞENİ ---

export default function PaymentsPage() {
    
    const { role, userId, isLoading: isLoadingAuth } = useMockAuth(); 

    // ASSISTANT ve GUEST rolleri için erişim engeli
    if (role === 'ASSISTANT' || role === 'GUEST') {
        return (
            <DashboardLayout>
                <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-red-500 p-8">
                    <LockClosedIcon className="w-12 h-12 mb-4" />
                    <h2 className="text-xl font-semibold">Erişim Engellendi</h2>
                    <p className="text-gray-500">Ödemeler sayfasına erişim yetkiniz bulunmamaktadır ({role}).</p>
                </div>
            </DashboardLayout>
        );
    }
    
    if (isLoadingAuth) {
        return (
            <DashboardLayout>
                <div className="p-4 flex justify-center items-center h-full min-h-[400px]">
                    <svg className="animate-spin h-6 w-6 text-indigo-600 mr-3" viewBox="0 0 24 24"></svg>
                    Yetki ve Rol bilgisi yükleniyor...
                </div>
            </DashboardLayout>
        );
    }

    // Role göre görünümü seç
    let paymentsView;
    
    if (role === 'MEMBER') {
        // MEMBER: Sadece kendi ödemelerini okur
        const userPayments = mockPayments.filter(p => p.user_id === userId);
        paymentsView = <MemberPaymentsView payments={userPayments} memberName={userPayments[0]?.member_name || 'Kullanıcı'} />;
    } else {
        // ADMIN, STAFF, TRAINER: Dahili görünüm
        paymentsView = <InternalPaymentsView payments={mockPayments} role={role} />;
    }

    return (
        <DashboardLayout>
            {paymentsView}
        </DashboardLayout>
    );
}

// 1. DAHİLİ YÖNETİM GÖRÜNÜMÜ (ADMIN, STAFF, TRAINER)
interface InternalPaymentsViewProps {
    payments: PaymentRecord[];
    role: 'ADMIN' | 'STAFF' | 'TRAINER';
}

const InternalPaymentsView: React.FC<InternalPaymentsViewProps> = ({ payments, role }) => {
    
    const [isLoadingData, setIsLoadingData] = useState(false); // Yenileme durumu
    const isFullControl = role === 'ADMIN' || role === 'STAFF';
    const canCreate = isFullControl || role === 'TRAINER'; // ADMIN, STAFF, TRAINER yeni kayıt girebilir

    // Trainer ve Staff/Admin için farklı uyarı mesajları
    const getWarning = () => {
        if (role === 'TRAINER') {
            return "Eğitmen olarak sadece yeni tahsilat kaydı girebilirsiniz. Mevcut kayıtları düzenleme yetkiniz yoktur.";
        } else if (role === 'STAFF') {
            return "Yönetici olarak Finansal Analiz (Kâr/Zarar) raporlarına erişiminiz yoktur. Lütfen 'Finansal Analiz' sayfasına gidin.";
        }
        return null;
    }
    const warning = getWarning();

    return (
        <div className="p-4">
            
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-extrabold text-gray-800">
                    💲 Ödemeler ve Tahsilat ({role})
                </h1>
                <div className="space-x-3">
                    <button 
                        onClick={() => { /* Veri çekme simülasyonu */ }}
                        className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:ring-indigo-500"
                        disabled={isLoadingData}
                    >
                         <ArrowPathIcon className={`w-5 h-5 mr-2 ${isLoadingData ? 'animate-spin' : ''}`} />
                        Yenile
                    </button>
                    {/* YENİ TAHSİLAT BUTONU (ADMIN, STAFF, TRAINER aktif) */}
                    <button 
                        className={`inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white ${
                            canCreate
                                ? 'bg-indigo-600 hover:bg-indigo-700' 
                                : 'bg-gray-400 cursor-not-allowed'
                        }`}
                        disabled={!canCreate}
                        title={role === 'TRAINER' ? "Yeni Tahsilat Girişi (Sadece Kayıt)" : "Yeni Tahsilat Girişi"}
                    >
                        <CurrencyDollarIcon className="w-5 h-5 mr-2" />
                        Yeni Tahsilat Gir
                    </button>
                </div>
            </div>
            
            {/* Uyarı Mesajı */}
            {warning && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                    <p className="text-sm text-yellow-800">{warning}</p>
                </div>
            )}

            {/* Ödeme Tablosu */}
            <div className="bg-white shadow-xl rounded-xl border border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Üye</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tutar</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yöntem</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {payments.map((p) => (
                            <tr key={p.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.member_name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold text-right">
                                    {p.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.method}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.payment_date}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClasses(p.status)}`}>
                                        {p.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    {/* Sadece ADMIN/STAFF düzenleyebilir */}
                                    {isFullControl ? (
                                        <a href={`/payments/${p.id}/edit`} className="text-indigo-600 hover:text-indigo-900">Düzenle</a>
                                    ) : (
                                        <span className="text-gray-400 flex items-center">
                                            <EyeIcon className="w-4 h-4 mr-1" /> Görüntüle
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// 2. ÜYE GÖRÜNÜMÜ (MEMBER)
interface MemberPaymentsViewProps {
    payments: PaymentRecord[];
    memberName: string;
}

const MemberPaymentsView: React.FC<MemberPaymentsViewProps> = ({ payments, memberName }) => {
    
    const totalPaid = payments.filter(p => p.status === 'Ödendi').reduce((sum, p) => sum + p.amount, 0);

    return (
        <div className="p-4">
            <h1 className="text-3xl font-extrabold text-gray-800 mb-6">
                💳 {memberName} Ödeme Geçmişi
            </h1>
            
            {/* Ödeme Durumu Kartları */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-green-50 p-6 rounded-xl shadow">
                    <p className="text-sm font-medium text-green-700">Toplam Ödenen Tutar</p>
                    <p className="text-3xl font-bold text-green-900 mt-1">{totalPaid.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}</p>
                </div>
                <div className="bg-yellow-50 p-6 rounded-xl shadow">
                    <p className="text-sm font-medium text-yellow-700">Bekleyen Ödeme Sayısı</p>
                    <p className="text-3xl font-bold text-yellow-900 mt-1">{payments.filter(p => p.status === 'Bekliyor').length}</p>
                </div>
                <div className="bg-red-50 p-6 rounded-xl shadow">
                    <p className="text-sm font-medium text-red-700">Geciken Ödeme Sayısı</p>
                    <p className="text-3xl font-bold text-red-900 mt-1">{payments.filter(p => p.status === 'Gecikti').length}</p>
                </div>
            </div>

            <h2 className="text-xl font-semibold text-gray-700 mb-4">Tüm İşlemleriniz</h2>

            {/* Ödeme Tablosu - Kendi İşlemleri */}
             <div className="bg-white shadow-xl rounded-xl border border-gray-100 overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tutar</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yöntem</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {payments.map((p) => (
                            <tr key={p.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold text-right">
                                    {p.amount.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.method}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.payment_date}</td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClasses(p.status)}`}>
                                        {p.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {payments.length === 0 && (
                 <div className="text-center py-10 text-gray-500 bg-white rounded-xl shadow-lg">
                    Henüz size ait bir ödeme kaydı bulunmamaktadır.
                 </div>
            )}
        </div>
    );
};