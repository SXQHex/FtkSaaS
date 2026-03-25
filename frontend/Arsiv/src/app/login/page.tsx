// src/app/login/page.tsx
// Bu sayfa, etkileşimli olduğu için İstemci Bileşenidir.
"use client"; 

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Yönlendirme için
import { signIn } from 'next-auth/react';     // Auth.js'in login fonksiyonu
import { ChevronRight, Zap } from 'lucide-react'; 

export default function LoginPage() {
  
  const router = useRouter();
  
  // State Tanımlamaları
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // 1. Frontend Doğrulaması
    if (!emailOrUsername || !password) {
        setError('Lütfen Kullanıcı Adı veya E-posta ve şifrenizi girin.');
        return;
    }
    
    setLoading(true);
    
    try {
      // 2. Auth.js signIn Fonksiyonu Kullanımı
      // credentials: 'route.ts' dosyasında tanımladığımız Provider'ın adıdır.
      const result = await signIn('credentials', { 
          username: emailOrUsername, // Backend'e gönderilecek alan
          password: password,
          redirect: false, // Otomatik yönlendirmeyi devre dışı bırak
      });
      
      if (result?.error) {
        // Auth.js route.ts'den gelen hatayı göster
        setError(result.error);
        
      } else if (result?.ok) {
        // 🔥 GÜNCEL DÜZELTME: Giriş başarılı, ana rotaya yönlendiriliyor
        router.push('/'); 
        
      } else {
        // Diğer beklenmedik hatalar
        setError('Bilinmeyen bir hata oluştu. Lütfen tekrar deneyin.');
      }
        
    } catch (err) {
        // Ağ hataları veya kritik hatalar
        setError('Sunucuya erişim sağlanamadı.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen font-sans bg-gray-50">
        
        {/* 1. Sol Panel: Marka ve Görsel Alanı */}
        <div className="hidden lg:flex w-1/2 bg-indigo-700 items-center justify-center p-16 relative overflow-hidden">
            <div className="z-10 text-white text-left max-w-lg">
                <div className="flex items-center mb-4 text-4xl font-extrabold tracking-tighter">
                    <Zap className="w-10 h-10 mr-3 text-yellow-300"/>
                    FTK Studio Yönetimi
                </div>
                <h1 className="text-3xl font-bold mb-4">
                    Tüm Operasyonunuz Tek Bir Yerde
                </h1>
                <p className="text-lg font-light opacity-90 leading-relaxed">
                    Ders planlamadan üye takibine, maliyet yönetiminden eğitmen koordinasyonuna kadar tüm süreçleri kolaylıkla yönetin.
                </p>
                <Link href="#" className="mt-6 inline-flex items-center text-sm font-semibold text-white/90 hover:text-white transition duration-200 border-b border-transparent hover:border-white">
                    Sistem Özelliklerini Keşfet
                    <ChevronRight className="w-4 h-4 ml-1" />
                </Link>
            </div>
              
        </div>

        {/* 2. Sağ Panel: Giriş Formu */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12">
            <div className="max-w-md w-full bg-white p-8 sm:p-10 rounded-xl shadow-2xl">
                
                {/* Başlık */}
                <div className="mb-8 text-center">
                    <h2 className="text-3xl font-extrabold text-gray-900">
                        Yönetici Panel Girişi
                    </h2>
                </div>
                
                {/* Hata Mesajı */}
                {error && (
                    <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg relative mb-6 text-sm" role="alert">
                        {error}
                    </div>
                )}
                
                {/* Giriş Formu */}
                <form className="space-y-6" onSubmit={handleSubmit}>
                    
                    {/* Email/Kullanıcı Adı Alanı */}
                    <div>
                        <label htmlFor="email-address" className="block text-sm font-medium text-gray-700 mb-1">
                            Kullanıcı Adı veya E-posta
                        </label>
                        <input
                            id="email-address"
                            name="emailOrUsername" 
                            type="text" 
                            autoComplete="off"
                            required
                            className="appearance-none block w-full px-4 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150"
                            placeholder="Kullanıcı Adı yada E-posta"
                            value={emailOrUsername} 
                            onChange={(e) => setEmailOrUsername(e.target.value)} 
                            disabled={loading}
                        />
                    </div>
                    
                    {/* Şifre Alanı */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                            Şifre
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            className="appearance-none block w-full px-4 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150"
                            placeholder="Şifre"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            disabled={loading}
                        />
                    </div>

                    {/* Şifremi Unuttum */}
                    <div className="flex items-center justify-end">
                        <div className="text-sm">
                            <Link href="/forgot-password" className="font-medium text-indigo-600 hover:text-indigo-500">
                                Şifremi unuttum?
                            </Link>
                        </div>
                    </div>

                    {/* Giriş Butonu */}
                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`group relative w-full flex justify-center py-2.5 px-4 border border-transparent text-sm font-medium rounded-lg text-white ${
                                loading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'
                            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-200`}
                        >
                            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                            {!loading && <ChevronRight className="w-5 h-5 ml-1" />}
                        </button>
                    </div>
                </form>
                
                {/* Kayıt Ol Linki */}
                <div className="text-center text-sm mt-6 pt-4 border-t border-gray-100">
                    <p className="text-gray-600">
                        Hesabın yok mu?{' '}
                        <Link href="/register" className="font-semibold text-indigo-600 hover:text-indigo-500">
                            Yeni Hesap Oluştur
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    </div>
  );
}