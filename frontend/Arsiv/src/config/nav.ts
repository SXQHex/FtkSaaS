// src/config/nav.ts (GÜNCELLEŞTİRİLMİŞ VERSİYON)

import { 
    HomeIcon, 
    UsersIcon, 
    CreditCardIcon, 
    ChartBarIcon, 
    Cog6ToothIcon,
    CalendarDaysIcon, // Ders Programı için
    CurrencyDollarIcon, // Ödeme Takibi için
    UserGroupIcon // Eğitmenler için
} from '@heroicons/react/24/outline';
import React from 'react';

// Menü öğesi için tip tanımı (Roller ve SVG İkonları içerir)
export interface NavItem {
    name: string;
    href: string;
    // icon: SVG bileşenini tutar (Heroicons gibi)
    icon: React.ElementType; 
    // roles: Bu öğeyi kimler görebilir
    roles: ('ADMIN' | 'STAFF' | 'STUDENT')[]; 
}

// --- Ana Navigasyon Menü Yapısı ---
export const NAV_ITEMS: NavItem[] = [
    {
        name: 'Dashboard',
        href: '/',
        icon: HomeIcon,
        roles: ['ADMIN', 'STAFF'], // Yönetim
    },
    {
        name: 'Kişiler',
        href: '/users',
        icon: UsersIcon,
        roles: ['ADMIN', 'STAFF'], 
    },
    {
        name: 'Üyelik Yönetimi', 
        href: '/memberships',    
        icon: CreditCardIcon,
        roles: ['ADMIN', 'STAFF'], 
    },
    {
        name: 'Ödeme Takibi',
        href: '/payments',
        icon: CurrencyDollarIcon,
        roles: ['ADMIN', 'STAFF'],
    },
    {
        name: 'Takvim & Ders Programı',
        href: '/schedule',
        icon: UserGroupIcon,
        roles: ['ADMIN', 'STAFF'],
    },
    {
        name: 'Yoklama & Devam Takibi',
        href: '/attendance',
        icon: ChartBarIcon,
        roles: ['ADMIN', 'STAFF'], // Sadece üst düzey yönetici
    },
];

// --- Ayarlar ve Diğer İkincil Öğeler ---
export const secondaryNavItems: NavItem[] = [
    {
        name: 'Ayarlar',
        href: '/settings',
        icon: Cog6ToothIcon,
        roles: ['ADMIN'],
    },
    // Diğer ikincil öğeler buraya eklenebilir (Örn: Yardım, Profil vb.)
];

// Sidebar bileşeninde kullanılacak tüm öğelerin birleşimi
export const ALL_NAV_ITEMS = [...NAV_ITEMS, ...secondaryNavItems];