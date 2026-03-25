// src/app/error.tsx
"use client"; // Hata sınırları, etkileşimli oldukları için İstemci Bileşeni olmalıdır

import React, { useEffect } from 'react';
import Link from 'next/link';

// Next.js, hata nesnesini ve "reset" (yeniden dene) işlevini bu bileşene otomatik olarak sağlar
interface ErrorBoundaryProps {
  error: Error & { digest?: string };
  reset: () => void; // Bu işlev, uygulamanın yeniden render edilmesini sağlar
}

export default function ErrorBoundary({ error, reset }: ErrorBoundaryProps) {
  
  // Hata oluştuğunda bu bilgiyi loglamak önemlidir.
  useEffect(() => {
    // Örneğin, bu bilgiyi bir hata izleme servisine (Sentry, LogRocket vb.) gönderebilirsiniz.
    console.error("Dashboard Veri Çekme Hatası:", error);
  }, [error]);

  return (
    // Bu, Dashboard içeriğinin yerini alacak temiz bir hata ekranıdır.
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-white p-8 rounded-xl shadow-lg border border-red-200">
      
      <span className="text-6xl mb-4">⚠️</span>
      
      <h2 className="text-2xl font-bold mb-3 text-red-700">
        Veri Yüklenirken Bir Hata Oluştu!
      </h2>
      
      <p className="text-gray-600 mb-6 text-center max-w-md">
        Yönetim paneli verilerini (API: /api/dashboard) çekerken bir sorun yaşandı.
        Lütfen sunucunuzun (Django) çalıştığından emin olun.
      </p>

      {/* Yeniden Dene Butonu */}
      <button
        onClick={
          // Hata sınırını sıfırlamak ve yeniden denemek için 'reset' işlevini çağır
          () => reset()
        }
        className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors shadow-md"
      >
        Yeniden Dene
      </button>

      {/* Anasayfa Linki */}
      <Link href="/">
        <button className="mt-4 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Anasayfa'ya Git
        </button>
      </Link>
      
      {/* İsteğe bağlı olarak geliştirici için hata detayı gösterilebilir */}
      {process.env.NODE_ENV === 'development' && (
        <pre className="mt-6 p-4 bg-gray-100 rounded text-xs text-gray-800 whitespace-pre-wrap max-w-full overflow-x-auto">
          {error.message}
        </pre>
      )}

    </div>
  );
}