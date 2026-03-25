// src/app/products/_components/ProductsFilter.tsx

'use client';

import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState, useTransition } from 'react';

// PackageFilter'ın düzeltilmiş halini varsayıyoruz
import { PackageFilter } from '@/lib/dataService'; 
// types/packages'ten tip tanımını alıyoruz
import { UsageModel } from '@/types/packages'; 


interface ProductsFilterProps {
  currentFilters: PackageFilter;
}

export default function ProductsFilter({ currentFilters }: ProductsFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // HATA 2345 DÜZELTME: currentFilters.isActive'ın undefined olma ihtimalini ?? 'all' ile yakalıyoruz
  const [searchText, setSearchText] = useState(currentFilters.search || '');
  const [statusFilter, setStatusFilter] = useState<boolean | 'all'>(currentFilters.isActive ?? 'all');
  
  // HATA 2339 DÜZELTME: usageModel'ın PackageFilter'da artık var olduğunu varsayarak undefined'ı ?? 'all' ile yakalıyoruz.
  const [modelFilter, setModelFilter] = useState<UsageModel | 'all'>(
    (currentFilters.usageModel as UsageModel | 'all' | undefined) ?? 'all'
  );


  // URL'yi güncelleme fonksiyonu - Tip tanımı basitleştirildi
  const updateUrl = (search: string, status: boolean | 'all', model: UsageModel | 'all') => {
    const params = new URLSearchParams(searchParams.toString());
    
    // Arama terimi
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }

    // Durum filtresi
    const statusValue = status === true ? 'true' : status === false ? 'false' : 'all';
    if (statusValue !== 'all') {
      params.set('status', statusValue);
    } else {
      params.delete('status');
    }

    // Kullanım Modeli filtresi
    if (model !== 'all') {
      params.set('usageModel', model);
    } else {
      params.delete('usageModel');
    }
    
    // Sıralama parametrelerini koru 
    if (searchParams.get('sortBy')) params.set('sortBy', searchParams.get('sortBy')!);
    if (searchParams.get('sortOrder')) params.set('sortOrder', searchParams.get('sortOrder')!);
    
    // Geçişi başlat
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  // Arama inputu değişikliği
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const search = e.target.value;
    setSearchText(search);
    updateUrl(search, statusFilter, modelFilter); 
  };
  
  // Durum filtresi değişikliği - Tip tanımı düzeltildi
  const handleStatusChange = (newStatus: boolean | 'all') => {
    setStatusFilter(newStatus);
    updateUrl(searchText, newStatus, modelFilter);
  };

  // Kullanım Modeli filtresi değişikliği
  const handleModelChange = (newModel: UsageModel | 'all') => {
    setModelFilter(newModel);
    updateUrl(searchText, statusFilter, newModel);
  };


  return (
    <div className="flex flex-col gap-4">
      {/* 1. Arama Çubuğu */}
      <div className="relative grow w-full">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </div>
        <input
          type="search"
          name="search"
          value={searchText}
          onChange={handleSearchChange}
          placeholder="Paket adına göre arama..."
          className="block w-full rounded-md border-0 py-2 pl-10 pr-4 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
        />
        {isPending && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <span className="text-sm text-indigo-500 animate-pulse">Yükleniyor...</span>
            </div>
        )}
      </div>

      {/* 2. Filtreleme Butonları (Durum ve Model) */}
      <div className="flex flex-wrap items-center gap-4"> 
        
        {/* Durum Filtreleme Butonları */}
        <div className="flex space-x-2 shrink-0">
          {[
            { label: 'Tüm Durumlar', value: 'all' as const },
            { label: 'Yayında', value: true },
            { label: 'Taslak', value: false },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => handleStatusChange(item.value)}
              disabled={isPending}
              className={`
                px-3 py-2 text-sm font-medium rounded-md transition
                ${
                  currentFilters.isActive === item.value
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                }
                ${isPending ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {item.label}
            </button>
          ))}
        </div>
        
        {/* Kullanım Modeli Filtreleme Butonları */}
        <div className="flex space-x-2 shrink-0">
            {[
              { label: 'Tüm Modeller', value: 'all' as const },
              { label: 'Süreli Paket', value: 'TIME_BASED' as const },
              { label: 'Kontör Paket', value: 'CLASS_BASED' as const },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => handleModelChange(item.value)}
                disabled={isPending}
                className={`
                  px-3 py-2 text-sm font-medium rounded-md transition
                  ${
                    currentFilters.usageModel === item.value
                      ? 'bg-indigo-600 text-white shadow-md' 
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
                  }
                  ${isPending ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {item.label}
              </button>
            ))}
          </div>

      </div>
    </div>
  );
}