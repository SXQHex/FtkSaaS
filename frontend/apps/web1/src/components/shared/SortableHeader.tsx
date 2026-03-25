// src/components/shared/SortableHeader.tsx
'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { SortableHeaderProps, SortOrder } from '@/types/FilterBarTypes';

export default function SortableHeader({ label, sortKey, currentKey, currentOrder }: SortableHeaderProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isPending, startTransition] = useTransition();

    const isCurrent = currentKey === sortKey;
    const nextOrder: SortOrder = isCurrent && currentOrder === 'asc' ? 'desc' : 'asc';
    const chevron = isCurrent ? (currentOrder === 'asc' ? '▲' : '▼') : '';

    const handleSort = () => {
        const params = new URLSearchParams(searchParams.toString());
        
        // Sıralama parametrelerini güncelle
        params.set('sortBy', sortKey);
        params.set('sortOrder', nextOrder);
        
        // Diğer filtrelerin korunması için params.toString() kullanılır.

        startTransition(() => {
            router.push(`${pathname}?${params.toString()}`, { scroll: false });
        });
    };

    return (
        <th 
            scope="col" 
            className={`
                px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider 
                ${isPending ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:text-gray-900 transition'}
            `}
            onClick={!isPending ? handleSort : undefined}
            aria-sort={isCurrent ? (currentOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
        >
            {label} {chevron}
        </th>
    );
}