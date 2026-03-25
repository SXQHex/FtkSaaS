// src/app/(main)/layout.tsx

"use client"; 

import React from 'react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import DashboardLayout from '@/components/DashboardLayout'; 
// 🔥 GÜNCELLEME: Artık USER_ROLES sabit nesnesini import ediyoruz
import { USER_ROLES } from '@/types/common'; 


// Loading veya Hata durumunda gösterilecek basit bir yükleme bileşeni
const LoadingScreen: React.FC = () => (
    // ... (LoadingScreen içeriği aynı) ...
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="flex items-center space-x-2 text-indigo-600">
            <svg className="animate-spin h-5 w-5 mr-3 text-indigo-500" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Dashboard Yükleniyor...</span>
        </div>
    </div>
);


export default function MainLayout({ children }: { children: React.ReactNode }) {
    
    // AuthGuard'ı çağırın. Artık değeri USER_ROLES nesnesinden alıyoruz.
    const { isLoading, isAuthenticated } = useAuthGuard(USER_ROLES.ADMIN); // ✅ Hata Çözüldü
    
    if (isLoading) {
        return <LoadingScreen />;
    }
    
    if (!isAuthenticated) {
        return null; 
    }

    return (
        <DashboardLayout>
            {children}
        </DashboardLayout>
    );
}