// src/hooks/useAuthGuard.ts
// Bu bir istemci bileşeni hook'udur.

"use client";

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// NOT: REQUIRED_ROLE global sabitini kaldırdık. 
// Artık gerekli rol dışarıdan, MainLayout'tan geliyor.

/**
 * Kullanıcı oturumunu ve rolünü kontrol eder. Yetkisiz ise yönlendirme yapar.
 * * @param requiredRole - Bu sayfaya erişim için gerekli rol (Örn: 'ADMIN', 'EDITOR'). Opsiyoneldir.
 */
export function useAuthGuard(requiredRole?: string) {
    const { data: session, status } = useSession();
    const router = useRouter();

    const isLoading = status === 'loading';
    const isReady = status !== 'loading';

    // 🔥 Yetki Kontrolü: Yalnızca yetkili ve rolü eşleşenler 'true' döner.
    const userRole = session?.user?.role;
    const isAuthorized = 
        isReady && 
        status === 'authenticated' && 
        (requiredRole ? userRole === requiredRole : true); // Rol gerekiyorsa kontrol et, yoksa yetkili kabul et

    useEffect(() => {
        if (isLoading) return; // Henüz yüklenmediyse bekle

        // 1. Oturum Yoksa (Unauthenticated)
        if (status === 'unauthenticated') {
            console.log('Oturum yok, login sayfasına yönlendiriliyor.');
            router.replace('/login');
            return;
        }

        // 2. Rol Kontrolü (Role-Based Access Control - RBAC)
        if (requiredRole && userRole && userRole !== requiredRole) {
            console.log(`Yetki yetersiz: Gerekli Rol: ${requiredRole}, Kullanıcı Rolü: ${userRole}`);
            // Genellikle 403 Forbidden sayfasına veya ana sayfaya yönlendirilir.
            router.replace('/'); 
            return; // Yönlendirme tetiklendi, devam etme.
        }

        // Eğer authenticated ve rol eşleşiyorsa, bileşen render edilir.

    }, [status, router, requiredRole, userRole, isLoading]);

    // 🔥 Geri Dönüş Değerleri
    // Layout bileşeni, sadece isLoading 'false' VE isAuthenticated 'true' ise 
    // DashboardLayout'u render etmelidir. Bu, Sidebar'ın yetkisiz render'ını engeller.
    return {
        isAuthenticated: isAuthorized, // Rol kontrolünü de içeren son yetki durumu
        isLoading: isLoading,
        session,
    };
}