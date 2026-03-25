// src/redux/api/apiSlice.ts (GÜNCELLENMİŞ VERSİYON)

import { createApi } from '@reduxjs/toolkit/query/react';
// Yeni base query'mizi import ediyoruz:
import { baseQueryWithAuth } from './baseQueryWithAuth'; 

export const apiSlice = createApi({
    reducerPath: 'api', 
    
    // Artık token ekleme ve Base URL'i içeren baseQueryWithAuth'u kullanıyoruz
    baseQuery: baseQueryWithAuth,
    
    tagTypes: ['User', 'Course', 'Room'], 
    
    endpoints: (builder) => ({
        // Tüm veri çekme endpoint'leriniz buraya gelecek
        // Örn: getUsers: builder.query<User[], void>({ query: () => 'users/' }),
    }),
});

// useLoginMutation ARTIK YOK.
// Diğer tüm use...Query/Mutation hook'ları buradan dışa aktarılmaya devam edecek.