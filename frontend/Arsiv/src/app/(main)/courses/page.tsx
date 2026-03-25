// app/courses/page.tsx
// Rota: /courses
'use client'; // Gerekli değil ama hata olursa diye ekleyebiliriz, ancak bu bir Server Component'tir.

import { Suspense } from 'react';
import Link from 'next/link';
import { PlusIcon } from '@heroicons/react/24/outline';

// --- 1. Client Component Importları
import FilterBar from '@/components/shared/FilterBar'; 
import SortableHeader from '@/components/shared/SortableHeader'; 
import StatusBadge from '@/components/ui/StatusBadge'; 

// --- 2. Data Service Importları
import { 
    fetchCourseGroups,
    fetchDisciplines,
    fetchLevels,
    CourseGroupFilter, 
    CourseGroupSortKey, 
    SortOrder, 
    Discipline,
    Level,
} from '@/lib/dataService'; 
import { FilterDropdownConfig, Option } from '@/types/FilterBarTypes'; 
// Güncellenmiş tipler
import { CourseStatus, CourseType } from '@/types/courses'; 

export const dynamic = 'force-dynamic'; 

// --- Yardımcı Fonksiyonlar ---

/**
 * URL'den gelen string değeri CourseStatus enum'a çevirir.
 */
const parseStatus = (status: string | undefined): CourseStatus | 'all' => {
    const validStatuses: (CourseStatus | 'all')[] = ['Active', 'Planned', 'Completed', 'Cancelled', 'all'];
    if (status && validStatuses.includes(status as CourseStatus | 'all')) {
        return status as CourseStatus | 'all';
    }
    return 'all'; 
};

/**
 * URL'den gelen string değeri CourseType'a çevirir.
 */
const parseCourseType = (type: string | undefined): CourseType | 'all' => {
    // Backend GroupTypeDefinition modelindeki olası tiplere uygun varsayılanlar
    const validTypes: (CourseType | 'all')[] = ['Group', 'Private', 'Seminar', 'Workshop', 'Other', 'all']; 
    if (type && validTypes.includes(type as CourseType | 'all')) {
        return type as CourseType | 'all';
    }
    return 'all'; 
};

const mapToOptions = (data: Discipline[] | Level[]): Option[] => 
    data.map(item => ({ value: item.id, label: item.name }));

// --- Ana Sayfa Bileşeni Prop Tipi ---

interface CoursesPageProps {
  searchParams: Promise<{
    search?: string;
    disciplineId?: string;
    levelId?: string;
    status?: string; 
    type?: string; // KURT TİPİ
    sortBy?: string;
    sortOrder?: string;
  }>
}

export default async function CoursesPage(props: CoursesPageProps) {
    const searchParams = await props.searchParams;

    // 1. URL'den Filtreleri ve Sıralamayı Oku
    const search = searchParams.search || '';
    const disciplineId = searchParams.disciplineId || 'all';
    const levelId = searchParams.levelId || 'all';
    const status = searchParams.status || 'all';
    const type = searchParams.type || 'all'; // Tipi okuma

    // Sıralama
    const validSortKeys: CourseGroupSortKey[] = ['group_name', 'start_date', 'price', 'status'];
    const currentSortKey: CourseGroupSortKey = 
        (searchParams.sortBy && validSortKeys.includes(searchParams.sortBy as CourseGroupSortKey))
        ? (searchParams.sortBy as CourseGroupSortKey) : 'start_date';

    const currentSortOrder: SortOrder = 
        (searchParams.sortOrder === 'asc' || searchParams.sortOrder === 'desc')
        ? (searchParams.sortOrder as SortOrder) : 'asc';

    const filters: CourseGroupFilter = { 
        search, 
        disciplineId, 
        levelId, 
        status: parseStatus(status),
        type: parseCourseType(type), // Tipi filtre objesine ekleme
    };

    // 2. Veri Çekme (Paralel İşlem)
    const [courses, disciplines, levels] = await Promise.all([
        fetchCourseGroups(filters, currentSortKey, currentSortOrder), 
        fetchDisciplines(),
        fetchLevels(),
    ]);

    // 3. FilterBar İçin Konfigürasyonları Hazırla
    const dropdownConfigs: FilterDropdownConfig[] = [
        // KURT TİPİ DROPDOWN
        {
            name: 'type',
            label: 'Tüm Tipler',
            currentValue: type,
            options: [
                { value: 'Group', label: 'Grup Dersi' },
                { value: 'Private', label: 'Özel Ders' },
                { value: 'Seminar', label: 'Seminer' },
                { value: 'Workshop', label: 'Atölye' },
                { value: 'Other', label: 'Diğer' },
            ],
        },
        // Mevcut Filtreler
        { name: 'disciplineId', label: 'Tüm Disiplinler', currentValue: disciplineId, options: mapToOptions(disciplines) },
        { name: 'levelId', label: 'Tüm Seviyeler', currentValue: levelId, options: mapToOptions(levels) },
        {
            name: 'status',
            label: 'Durum',
            currentValue: status,
            options: [
                { value: 'Active', label: 'Aktif' },
                { value: 'Planned', label: 'Planlandı' },
                { value: 'Completed', label: 'Tamamlandı' },
                { value: 'Cancelled', label: 'İptal Edildi' },
            ],
        },
    ];

    // Tablo Başlıkları İçin Sıralama Ayarları (Aynı Kalıyor)
    const sortableHeaders: { label: string, sortKey: CourseGroupSortKey }[] = [
        { label: 'Grup Adı', sortKey: 'group_name' },
        { label: 'Başlangıç Tarihi', sortKey: 'start_date' },
        { label: 'Durum', sortKey: 'status' },
        { label: 'Fiyat', sortKey: 'price' },
    ];


    return (
        <div className="p-8">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Kurs Grupları Listesi</h1>
                <Link 
                    href="/courses/new" 
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 transition"
                >
                    <PlusIcon className="-ml-1 mr-2 h-4 w-4" />
                    Yeni Grup Oluştur
                </Link>
            </header>
            
            <div className="mb-6 bg-white p-4 shadow-sm rounded-lg">
                <Suspense fallback={<div>Filtreler yükleniyor...</div>}>
                    <FilterBar 
                        currentSearch={search}
                        dropdownConfigs={dropdownConfigs}
                    />
                </Suspense>
            </div>

            {/* 5. Kurs Listesi Tablosu */}
            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            {/* YENİ: Kurs Tipi Sütun Başlığı */}
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Tipi
                            </th>
                            
                            {sortableHeaders.map(header => (
                                <SortableHeader 
                                    key={header.sortKey}
                                    label={header.label}
                                    sortKey={header.sortKey}
                                    currentKey={currentSortKey} 
                                    currentOrder={currentSortOrder} 
                                />
                            ))}
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Eğitmen / Kapasite
                            </th>
                            <th scope="col" className="relative px-6 py-3"></th> 
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {courses.map((course) => (
                            <tr key={course.id} className="hover:bg-gray-50">
                                {/* YENİ: Kurs Tipi Hücresi (course.group_type alanının geldiği varsayılır) */}
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                                    {course.group_type} 
                                </td>
                                
                                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                    {course.group_name}
                                    <p className="text-xs text-indigo-600 mt-0.5">{course.course_title}</p>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(course.start_date).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                    <StatusBadge status={course.status} />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {course.price.toFixed(2)} TL
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {course.instructor_name} ({course.enrolled_count}/{course.capacity})
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <Link href={`/courses/${course.id}`} className="text-indigo-600 hover:text-indigo-900 transition">
                                        Detaylar
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {courses.length === 0 && (
                            <tr><td colSpan={sortableHeaders.length + 3} className="text-center py-12 text-gray-500 italic">
                                Seçilen filtre ve arama kriterlerine uygun kayıt bulunamadı.
                            </td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}