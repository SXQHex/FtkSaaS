// src/app/users/page.tsx (YENİ DOSYA: Kullanıcı Adres Defteri)
"use client";

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuthGuard } from '@/hooks/useAuthGuard';
// import { fetchUsers } from '@/lib/api'; 
import { UserCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

// --- MOCK VERİ TİPİ VE MOCK VERİSİ ---

interface UserProfileData {
    id: string;
    full_name: string;
    email: string;
    phone_number: string;
    role: string;
    is_active: boolean; // Hesabın aktiflik durumu
}

const mockUsers: UserProfileData[] = [
    { id: '1', full_name: 'Ayşe Yılmaz', email: 'ayse.y@email.com', phone_number: '555-1234', role: 'KULLANICI', is_active: true },
    { id: '2', full_name: 'Mehmet Kaya', email: 'mehmet.k@email.com', phone_number: '555-5678', role: 'EĞİTMEN', is_active: true },
    { id: '3', full_name: 'Zeynep Öztürk', email: 'zeynep.o@email.com', phone_number: '555-9012', role: 'STAFF', is_active: true },
    { id: '4', full_name: 'Ali Çelik', email: 'ali.c@email.com', phone_number: '555-3456', role: 'KULLANICI', is_active: false },
];

// --- SAYFA BİLEŞENİ ---

export default function UsersPage() {
    
    const { isLoadingAuth, isAuthorized } = useAuthGuard(['ADMIN', 'STAFF']);

    const [users, setUsers] = useState<UserProfileData[] | null>(null);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadUsers = async () => {
        setIsLoadingData(true);
        setError(null);
        
        try {
            // Gerçek API çağrısı: const { data, error: apiError } = await fetchUsers();
            
            // Mock Veri Kullanımı
            const data = mockUsers; 
            const apiError = null;

            if (apiError) {
                setError(apiError);
            } else if (data) {
                setUsers(data);
            }
        } catch (e) {
            setError('Kullanıcı listesi çekilirken beklenmedik bir hata oluştu.');
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        if (!isLoadingAuth && isAuthorized) {
            loadUsers();
        }
    }, [isLoadingAuth, isAuthorized]);

    // Yükleniyor ve Yetki Kontrolü
    if (isLoadingAuth || isLoadingData) {
        return (
             <DashboardLayout>
                <div className="flex justify-center items-center h-full min-h-[400px] text-gray-700">
                    <svg className="animate-spin h-6 w-6 text-indigo-600 mr-3" viewBox="0 0 24 24"></svg>
                    {isLoadingAuth ? 'Yetki kontrolü yapılıyor...' : 'Kullanıcı listesi yükleniyor...'}
                </div>
            </DashboardLayout>
        );
    }
    
    if (!isAuthorized) {
        return null; 
    }

    // --- Sayfa İçeriği ---
    return (
        <DashboardLayout>
            <div className="p-4">
                
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-extrabold text-gray-800">
                        👥 Kullanıcı Adres Defteri
                    </h1>
                    <div className="space-x-3">
                        <button 
                            onClick={loadUsers}
                            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                             <ArrowPathIcon className="w-5 h-5 mr-2" />
                            Yenile
                        </button>
                        <button 
                            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <UserCircleIcon className="w-5 h-5 mr-2" />
                            Yeni Kullanıcı Ekle
                        </button>
                    </div>
                </div>

                {/* Kullanıcı Listesi (Basit Kart Görünümü) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {users?.map(user => (
                        <div key={user.id} className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-gray-900">{user.full_name}</h2>
                                    <p className="text-sm text-gray-500 mt-1">{user.email}</p>
                                    <p className="text-sm text-gray-500">{user.phone_number}</p>
                                </div>
                                <span className={`px-3 py-1 text-xs font-semibold rounded-full ${user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                    {user.role}
                                </span>
                            </div>
                            <div className="mt-4 flex justify-end">
                                <a href={`/users/${user.id}`} className="text-sm font-medium text-indigo-600 hover:text-indigo-900">
                                    Profili Gör &rarr;
                                </a>
                            </div>
                        </div>
                    ))}
                    {users?.length === 0 && (
                        <p className="col-span-full text-center py-10 text-gray-500">
                            Adres defterinde kayıtlı kullanıcı bulunamadı.
                        </p>
                    )}
                </div>

            </div>
        </DashboardLayout>
    );
}