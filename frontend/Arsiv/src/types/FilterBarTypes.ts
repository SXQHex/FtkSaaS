// src/types/FilterBarTypes.ts

export type SortOrder = 'asc' | 'desc';

export interface Option {
    value: string;
    label: string;
}

// Dropdown Filtreleri için Tip
export interface FilterDropdownConfig {
    name: string; // URL parametre adı (örn: disciplineId)
    label: string; // Dropdown'ın üst başlığı
    currentValue: string; // Mevcut seçili değer
    options: Option[];
}

export interface FilterBarProps {
    currentSearch?: string;
    dropdownConfigs: FilterDropdownConfig[];
    // Ekstra özel bileşenler için (örn: Date Picker)
    children?: React.ReactNode; 
}

export interface SortableHeaderProps {
    label: string;
    sortKey: string;
    currentKey: string;
    currentOrder: SortOrder;
}