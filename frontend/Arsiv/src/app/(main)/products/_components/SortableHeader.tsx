// src/app/products/_components/SortableHeader.tsx

'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { PackageSortKey, SortOrder } from '@/lib/dataService'; 

interface SortableHeaderProps {
  label: string;
  sortKey: PackageSortKey;
  currentKey: PackageSortKey;
  currentOrder: SortOrder;
}

export default function SortableHeader({ 
  label, 
  sortKey, 
  currentKey, 
  currentOrder 
}: SortableHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isCurrent = currentKey === sortKey;
  
  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    let newSortOrder: SortOrder = 'asc';

    if (isCurrent) {
      newSortOrder = currentOrder === 'asc' ? 'desc' : 'asc';
    } else {
      newSortOrder = 'asc';
    }

    params.set('sortBy', sortKey);
    params.set('sortOrder', newSortOrder);

    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const IconComponent = isCurrent && currentOrder === 'desc' ? ChevronDownIcon : ChevronUpIcon;
  const iconColor = isCurrent ? 'text-indigo-600' : 'text-gray-300 group-hover:text-gray-500';

  return (
    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
      <button 
        onClick={handleClick}
        className="group flex items-center whitespace-nowrap"
      >
        {label}
        <IconComponent className={`ml-2 h-4 w-4 ${iconColor}`} aria-hidden="true" />
      </button>
    </th>
  );
}