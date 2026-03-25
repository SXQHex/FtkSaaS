// src/redux/api/baseQueryWithAuth.ts (KORUNAN VE DOĞRU MANTIK)

import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getSession } from 'next-auth/react'; 

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api/';

/**
 * Custom baseQuery, NextAuth.js'ten JWT Access Token'ı çeker.
 */
export const baseQueryWithAuth = fetchBaseQuery({
    baseUrl: BASE_URL,
    prepareHeaders: async (headers, { getState }) => {
        
        // Session'ı asenkron olarak çek
        const session = await getSession();
        
        // Custom session objemize eklediğimiz accessToken'ı kullan
        const token = (session as any)?.accessToken; // 'as any' yerine tipleme (types/auth.ts) kullanıldıysa tip hatası olmaz.

        if (token) {
            headers.set('authorization', `Bearer ${token}`);
        }
        
        return headers;
    },
});

// Refresh token mantığı daha sonra bu dosya üzerine eklenecektir.