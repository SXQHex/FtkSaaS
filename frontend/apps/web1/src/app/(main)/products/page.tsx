// src/app/products/page.tsx

import Link from 'next/link';
import { PackageType } from '@/types/packages';
import { fetchPackages, PackageFilter, PackageSortKey, SortOrder } from '@/lib/dataService'; 
import { 
  PlusIcon,       
  PencilSquareIcon, 
  EyeIcon,        
  ArchiveBoxIcon, 
  ClockIcon,      
  DocumentTextIcon,
  ChevronUpIcon, 
  ChevronDownIcon, 
} from '@heroicons/react/24/outline';

import ProductsFilter from './_components/ProductsFilter'; 
import SortableHeader from './_components/SortableHeader'; 

// --- Yardımcı Fonksiyonlar ---
const getUsageText = (pkg: PackageType) => { 
  if (pkg.usage.model === 'TIME_BASED') {
    return `${pkg.usage.durationValue} ${pkg.usage.durationType} Süreli`;
  }
  if (pkg.usage.model === 'CLASS_BASED') {
    return `${pkg.usage.totalCredits} Kontör/Seans`;
  }
  return 'Tanımsız';
};
const StatusBadge = ({ isActive }: { isActive: boolean }) => (
  <span
    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
      isActive
        ? 'bg-green-100 text-green-800'
        : 'bg-yellow-100 text-yellow-800'
    }`}
  >
    {isActive ? 'Yayında' : 'Taslak'}
  </span>
);


// --- Ana Sayfa Bileşeni (searchParams ile Server Component) ---

interface ProductsPageProps {
  searchParams: Promise<{
    search?: string;
    status?: 'all' | 'true' | 'false';
    // usageModel parametresini ekliyoruz
    usageModel?: 'all' | 'CLASS_BASED' | 'TIME_BASED'; 
    sortBy?: PackageSortKey;    
    sortOrder?: SortOrder;      
  }>
}

export default async function ProductsPage(props: ProductsPageProps) {
  const searchParams = await props.searchParams;

  // URL'den filtreleri ve sıralama parametrelerini al
  const filters: PackageFilter = {
    search: searchParams.search || '',
    isActive: searchParams.status === 'true' ? true : searchParams.status === 'false' ? false : 'all',
    // usageModel filtre değerini belirliyoruz
    usageModel: searchParams.usageModel === 'CLASS_BASED' ? 'CLASS_BASED' : searchParams.usageModel === 'TIME_BASED' ? 'TIME_BASED' : 'all',

    sortBy: searchParams.sortBy || 'name', // Varsayılan sıralama: Ad
    sortOrder: searchParams.sortOrder || 'asc', // Varsayılan sıralama: Artan
  };

  const packages = await fetchPackages(filters);
  const currentSortKey = filters.sortBy || 'name';
  const currentSortOrder = filters.sortOrder || 'asc';

  return (
    <div className="p-8">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center">
          <ArchiveBoxIcon className="mr-3 h-8 w-8 text-indigo-600" />
          Paket ve Üyelik Listesi
        </h1>
        <Link 
          href="/products/new" 
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition"
        >
          <PlusIcon className="-ml-1 mr-2 h-4 w-4" />
          Yeni Paket Oluştur
        </Link>
      </header>
      
      {/* Arama ve Filtreleme alanı */}
      <div className="mb-6">
        <ProductsFilter currentFilters={filters} />
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="min-w-full overflow-x-auto">
          {packages.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              {filters.search || filters.isActive !== 'all' || filters.usageModel !== 'all'
                ? "Belirtilen kriterlere uygun paket bulunamadı."
                : "Henüz tanımlanmış bir paket bulunmamaktadır. Lütfen yeni bir paket oluşturun."
              }
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader 
                    label="Paket Adı" 
                    sortKey="name" 
                    currentKey={currentSortKey} 
                    currentOrder={currentSortOrder} 
                  />
                  {/* Model sütunu sıralanamaz, metin olarak kalır */}
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Model
                  </th>
                  <SortableHeader 
                    label="Fiyat" 
                    sortKey="price" 
                    currentKey={currentSortKey} 
                    currentOrder={currentSortOrder} 
                  />
                  <SortableHeader 
                    label="Durum" 
                    sortKey="isActive" 
                    currentKey={currentSortKey} 
                    currentOrder={currentSortOrder} 
                  />
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Eylemler</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {packages.map((pkg) => (
                  <tr key={pkg.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {pkg.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        {pkg.usage.model === 'TIME_BASED' ? (
                            <ClockIcon className="mr-2 h-4 w-4 text-indigo-500" />
                        ) : (
                            <DocumentTextIcon className="mr-2 h-4 w-4 text-indigo-500" />
                        )}
                        {getUsageText(pkg)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-semibold">
                      {pkg.currency === 'TRY' ? '₺' : '$'}
                      {pkg.price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <StatusBadge isActive={pkg.isActive} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <Link
                          href={`/products/edit/${pkg.id}`}
                          className="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-indigo-50 transition"
                          title="Düzenle"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </Link>
                        <Link
                          href={`/products/details/${pkg.id}`}
                          className="text-gray-600 hover:text-gray-900 p-2 rounded-full hover:bg-gray-50 transition"
                          title="Detayları Gör"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}