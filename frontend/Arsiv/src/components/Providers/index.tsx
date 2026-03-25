// src/components/Providers/index.tsx (YENİ VE SON HALİ)

'use client'; 

import React from 'react';
import { Provider } from 'react-redux';
import { SessionProvider } from 'next-auth/react'; // 👈 NextAuth importu
import { store } from '@/store'; 
import '@/lib/mock'; 

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        // 1. Auth.js Oturum Sağlayıcısı (En dışta olmalı)
        <SessionProvider>
            {/* 2. Redux Provider (RTK Query'yi içerir) */}
            <Provider store={store}>
                {children}
            </Provider>
        </SessionProvider>
    );
}