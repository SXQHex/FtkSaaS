// src/components/shared/FilterBar.tsx
'use client';

import React, { useState, useEffect, useCallback, useTransition, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { FilterBarProps } from '@/types/FilterBarTypes'; 

// --- Yardımcı Hook ---

/**
 * Arama metnini yerel state'te tutar ve sadece 300ms gecikmeden sonra URL'yi günceller.
 */
const useDebouncedSearch = (initialSearch: string, updateUrl: (updates: Record<string, string | null>) => void) => {
    // 1. Yerel State: Input alanındaki anlık yazıyı tutar.
    const [searchText, setSearchText] = useState(initialSearch);
    
    // 2. Senkronizasyon: Dışarıdan (URL'den) gelen filtre değişirse yerel state'i güncelle (örn: dropdown değişirse)
    useEffect(() => {
        // Sadece yerel state URL'deki değerden farklıysa (yani bir dış güncelleme varsa)
        if (searchText !== initialSearch) {
             setSearchText(initialSearch);
        }
    }, [initialSearch]);
    
    
    // 3. Debounce Mantığı: URL'yi sadece yazma durunca güncelle
    useEffect(() => {
        const handler = setTimeout(() => {
            // Sadece yerel state URL'deki değerden farklıysa güncelle
            if (searchText !== initialSearch) {
                updateUrl({ search: searchText || null }); 
            }
        }, 700); // 700ms gecikme

        return () => clearTimeout(handler);
    }, [searchText, initialSearch, updateUrl]);

    return { searchText, setSearchText };
};

// --- Ana FilterBar Bileşeni ---

export default function FilterBar({ currentSearch = '', dropdownConfigs, children }: FilterBarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    // 1. Ref: Input elementine referans
    const searchInputRef = useRef<HTMLInputElement>(null); 
    
    // 2. State: Güncellemenin arama çubuğundan gelip gelmediğini işaretler
    const [isSearchUpdate, setIsSearchUpdate] = useState(false); 


    /**
     * URL'yi güvenli bir şekilde güncelleyen temel callback fonksiyonu.
     * @param updates - Güncellenecek filtre anahtar/değer çiftleri
     */
    const updateUrl = useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        
        // Güncelleme bir arama değişikliği mi?
        const isSearchChange = 'search' in updates; 
        
        // Mevcut filtreleri güncelleme
        Object.entries(updates).forEach(([key, value]) => {
            if (value && value !== 'all') {
                params.set(key, value);
            } else {
                params.delete(key);
            }
        });

        // Sıralama parametrelerini koruma
        const sortBy = searchParams.get('sortBy');
        const sortOrder = searchParams.get('sortOrder');
        if (sortBy) params.set('sortBy', sortBy);
        if (sortOrder) params.set('sortOrder', sortOrder);

        // Transition içinde URL'yi güncelle (Server Component'i tekrar render eder)
        startTransition(() => {
            // Eğer arama kutusundan geliyorsa, odağı geri getirmek için işaretle
            if (isSearchChange) {
                setIsSearchUpdate(true);
            }
            router.push(`${pathname}?${params.toString()}`, { scroll: false });
        });
    }, [pathname, router, searchParams]);

    // 3. Arama Çubuğu State ve Debounce Yönetimi
    const { searchText, setSearchText } = useDebouncedSearch(currentSearch, updateUrl);


    // --- KRİTİK BÖLÜM: KOŞULLU ODAK YÖNETİMİ ---
    useEffect(() => {
        // KOŞUL:
        // 1. isPending bittiğinde (Yeniden render tamamlandı)
        // 2. Güncelleme, Arama Çubuğundan gelmişse (isSearchUpdate === true)
        if (!isPending && isSearchUpdate && searchInputRef.current) {
            
            // Odağı geri ver
            searchInputRef.current.focus();
            
            // Durumu sıfırla, böylece bir sonraki renderda tekrar odaklanmaz
            setIsSearchUpdate(false);
        }
    }, [isPending, isSearchUpdate]); 
    // isPending, isSearchUpdate'e bağımlı

    // Dropdown Değişikliklerini Yönetme (Anında Güncelleme)
    const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        // Dropdown değişiklikleri için isSearchUpdate default olarak false kalır.
        updateUrl({ [name]: value });
    };

    return (
        <div className="flex flex-col gap-4">
            
            {/* 1. Arama Çubuğu */}
            <div className="relative grow w-full">
                <MagnifyingGlassIcon className="pointer-events-none absolute inset-y-0 left-0 h-5 w-5 translate-x-3 text-gray-400" />
                <input
                    type="search"
                    name="search"
                    ref={searchInputRef} // Ref bağlı
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    placeholder="Aranacak Kelime..."
                    disabled={isPending}
                    className="block w-full rounded-md border-0 py-2 pl-10 pr-4 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                />
                {isPending && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <span className="text-sm text-indigo-500 animate-pulse">Yükleniyor...</span>
                    </div>
                )}
            </div>

            {/* 2. Dinamik Dropdown'lar ve Ek Kontroller */}
            <div className="flex flex-wrap items-center gap-4"> 
                
                {/* Dinamik Dropdown'lar */}
                {dropdownConfigs.map((config) => (
                    <select
                        key={config.name}
                        name={config.name}
                        defaultValue={config.currentValue || 'all'}
                        onChange={handleDropdownChange} // Anında URL güncelle
                        disabled={isPending}
                        className="block w-auto rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    >
                        <option value="all">{config.label}</option>
                        {config.options.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                ))}
                
                {/* Ek Özelleştirilmiş İçerik (Children) */}
                {children}
            </div>
        </div>
    );
}