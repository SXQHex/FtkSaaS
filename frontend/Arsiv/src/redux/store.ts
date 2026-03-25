// src/redux/store.ts (KORUNAN VE DOĞRU YAPILANDIRMA)

import { configureStore } from '@reduxjs/toolkit';
import { apiSlice } from './api/apiSlice';

export const store = configureStore({
  reducer: {
    // Sadece apiSlice reducer'ı dahil edilmeli
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  
  // API middleware'i dahil edilmeli
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware),
});

// TypeScript tipleri
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;