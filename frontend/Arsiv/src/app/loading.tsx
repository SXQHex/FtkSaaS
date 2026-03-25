// src/app/loading.tsx
// Next.js bu dosyayı / rotası yüklenirken otomatik olarak gösterecektir.

import React from 'react';

// Basit bir spinner bileşeni
const Spinner = () => (
    <div className="flex justify-center items-center h-full">
        <div 
            className="w-10 h-10 border-4 border-t-4 border-blue-500 border-opacity-25 rounded-full animate-spin"
            style={{ borderTopColor: '#3B82F6' }} // Mavi tonu
        ></div>
    </div>
);

export default function Loading() {
  return (
    // Bu, Dashboard düzenini taklit eden bir kapsayıcıdır.
    <div className="flex flex-col min-h-screen bg-gray-50 pt-16 md:pl-64"> 
      
      {/* 1. Dashboard Başlık Alanı */}
      <div className="p-6">
          <h1 className="text-3xl font-extrabold mb-8 text-gray-400 animate-pulse">
            Dashboard Özeti Yükleniyor...
          </h1>
      </div>

      {/* 2. Ana İçerik Alanı - Yükleniyor Efekti */}
      <div className="p-6 flex-1 flex flex-col gap-6">
        
        {/* Kartlar için Placeholder (Yer Tutucu) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
          <div className="h-24 bg-gray-200 rounded-xl animate-pulse"></div>
        </div>

        {/* Ana İçerik Kutusu için Placeholder */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-100 min-h-[400px] flex items-center justify-center">
            <Spinner />
        </div>
      </div>
    </div>
  );
}