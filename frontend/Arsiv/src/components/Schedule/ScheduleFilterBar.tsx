// src/components/Schedule/ScheduleFilterBar.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ScheduleFilters, FilterOption } from '@/types/schedule';
import { 
    fetchFilterDisciplines, fetchFilterLevels, 
    fetchFilterRooms, fetchFilterInstructors 
} from '@/lib/api';
import { AdjustmentsHorizontalIcon, FunnelIcon, PlusIcon } from '@heroicons/react/24/outline';


interface ScheduleFilterBarProps {
    currentFilters: ScheduleFilters;
    onFilterChange: (filters: ScheduleFilters) => void;
}

interface FilterOptionsState {
    disciplines: FilterOption[];
    levels: FilterOption[];
    rooms: FilterOption[];
    instructors: FilterOption[];
    isLoading: boolean;
}

const initialFilterOptions: FilterOptionsState = {
    disciplines: [], levels: [], rooms: [], instructors: [], isLoading: true,
};

const FilterSelect: React.FC<{ 
    label: string, value: string, options: FilterOption[], 
    onChange: (value: string) => void 
}> = ({ label, value, options, onChange }) => (
    <div className="flex flex-col space-y-1 min-w-[150px]">
        <label className="text-xs font-medium text-gray-500">{label}</label>
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
        >
            <option value="all">Tümü</option>
            {options.map(option => (
                // Filtreleme ID üzerinden yapılır
                <option key={option.id} value={option.id}>
                    {option.name}
                </option>
            ))}
        </select>
    </div>
);


export default function ScheduleFilterBar({ currentFilters, onFilterChange }: ScheduleFilterBarProps) {
    const [filterOptions, setFilterOptions] = useState<FilterOptionsState>(initialFilterOptions);

    // Filtre seçeneklerini dinamik olarak API'den çekme
    const loadFilterOptions = useCallback(async () => {
        setFilterOptions(prev => ({ ...prev, isLoading: true }));
        try {
            const [disciplines, levels, rooms, instructors] = await Promise.all([
                fetchFilterDisciplines(), fetchFilterLevels(), fetchFilterRooms(), fetchFilterInstructors(),
            ]);

            // Genel formatlama fonksiyonu
            const formatOptions = (data: any[]): FilterOption[] => data.map(item => ({ 
                id: item.id, 
                // Eğitmenler için Ad+Soyad, diğerleri için 'name' kullanılır
                name: item.name || `${item.first_name} ${item.last_name}`
            }));

            setFilterOptions({
                disciplines: formatOptions(disciplines),
                levels: formatOptions(levels),
                rooms: formatOptions(rooms),
                instructors: formatOptions(instructors),
                isLoading: false,
            });
        } catch (error) {
            console.error("Filtre seçenekleri yüklenirken hata oluştu:", error);
            setFilterOptions(prev => ({ ...prev, isLoading: false }));
        }
    }, []);

    useEffect(() => {
        loadFilterOptions();
    }, [loadFilterOptions]);


    const handleSelectChange = (key: keyof ScheduleFilters, value: string) => {
        const newFilters = { ...currentFilters, [key]: value };
        onFilterChange(newFilters);
    };

    if (filterOptions.isLoading) {
        return (
            <div className="flex items-center space-x-2 p-4 bg-gray-50 rounded-lg shadow-sm">
                <AdjustmentsHorizontalIcon className="w-5 h-5 text-indigo-500 animate-spin" />
                <p className="text-sm text-gray-500">Filtreler yükleniyor...</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col md:flex-row md:items-end space-y-4 md:space-y-0 md:space-x-6 p-4 bg-white rounded-lg shadow-md border-t-4 border-indigo-600">
            <h3 className="text-lg font-semibold text-gray-700 md:self-center flex items-center space-x-2">
                <FunnelIcon className="w-6 h-6 text-indigo-600" />
                <span>Filtreleme:</span>
            </h3>
            
            <FilterSelect
                label="Disiplin"
                options={filterOptions.disciplines}
                value={currentFilters.disciplineId}
                onChange={(v) => handleSelectChange('disciplineId', v)}
            />

            <FilterSelect
                label="Seviye"
                options={filterOptions.levels}
                value={currentFilters.levelId}
                onChange={(v) => handleSelectChange('levelId', v)}
            />

            <FilterSelect
                label="Sınıf/Stüdyo"
                options={filterOptions.rooms}
                value={currentFilters.roomId}
                onChange={(v) => handleSelectChange('roomId', v)}
            />

            <FilterSelect
                label="Eğitmen"
                options={filterOptions.instructors}
                value={currentFilters.instructorId}
                onChange={(v) => handleSelectChange('instructorId', v)}
            />

            <button
                onClick={() => onFilterChange({ disciplineId: 'all', levelId: 'all', roomId: 'all', instructorId: 'all' })}
                className="px-4 py-2 bg-red-100 text-red-600 font-medium rounded-md hover:bg-red-200 transition-colors self-start md:self-end text-sm"
            >
                Filtreleri Temizle
            </button>
            
            <div className="ml-auto">
                <button className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg shadow-md hover:bg-indigo-700 transition-colors">
                    <PlusIcon className="w-5 h-5" />
                    <span>Yeni Ders Ekle</span>
                </button>
            </div>
        </div>
    );
}