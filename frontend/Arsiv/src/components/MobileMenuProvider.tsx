// src/components/Sidebar.tsx (Güncellenmiş)
"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
    HomeIcon, UserGroupIcon, CalendarDaysIcon, ListBulletIcon, 
    ClipboardDocumentCheckIcon, Cog6ToothIcon, CreditCardIcon 
} from '@heroicons/react/24/outline';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types/auth'; 

// Yeni Prop Tanımı eklendi
interface SidebarProps {
    onLinkClick?: () => void; // Mobil menüyü kapatmak için isteğe bağlı prop
}

// Menü öğelerinin tanımlanması
const menuItems = [
    // Rota, İsim, İkon, Gerekli Roller (boşsa herkes)
    { href: '/', name: 'Dashboard', icon: HomeIcon, roles: ['ADMIN', 'STAFF'] },
    { href: '/schedule', name: 'Takvim', icon: CalendarDaysIcon, roles: [] },
    { href: '/members', name: 'Üyeler', icon: UserGroupIcon, roles: ['ADMIN', 'STAFF'] },
    { href: '/attendance', name: 'Yoklama Panosu', icon: ClipboardDocumentCheckIcon, roles: ['ADMIN', 'TRAINER'] },
    { href: '/memberships', name: 'Üyelikler', icon: CreditCardIcon, roles: ['ADMIN', 'STAFF'] },
    { href: '/reports', name: 'Raporlar', icon: ListBulletIcon, roles: ['ADMIN', 'STAFF'] },
];


// Sidebar bileşeninin prop'u kabul etmesi sağlandı
export default function Sidebar({ onLinkClick }: SidebarProps) {
    const pathname = usePathname();
    const { user } = useAuth();
    const userRole = user?.role as UserRole | undefined;

    // Rol tabanlı filtreleme yapan yardımcı fonksiyon
    const isLinkAllowed = (roles: string[]): boolean => {
        if (roles.length === 0) return true; // Boş rol dizisi herkes için izin verir
        if (!userRole) return false;
        return roles.includes(userRole);
    };

    const LinkItem = ({ href, name, Icon }: { href: string, name: string, Icon: React.ElementType }) => {
        const isActive = pathname === href || (pathname.startsWith(href + '/') && href !== '/');
        const defaultStyle = "flex items-center p-3 rounded-lg transition-colors duration-150 ease-in-out w-full";
        
        return (
            <Link 
                href={href} 
                className={`${defaultStyle} ${isActive ? 'bg-indigo-500 text-white shadow-lg' : 'text-gray-600 hover:bg-gray-100'}`}
                // Linke tıklandığında menüyü kapatma işlevi tetiklenir
                onClick={onLinkClick} 
            >
                <Icon className={`w-6 h-6 mr-3 ${isActive ? 'text-white' : 'text-indigo-500'}`} />
                <span className="font-medium">{name}</span>
            </Link>
        );
    };

    return (
        <nav className="h-full flex flex-col p-4 space-y-2 pt-8">
            {/* Logo/Başlık (Sadece mobil menüde, sabit menüde gizli) */}
            <div className="md:hidden mb-6 flex items-center justify-between">
                <Link href="/" className="text-2xl font-bold text-indigo-600">
                    FTK Yönetim
                </Link>
            </div>
            
            {/* Ana Navigasyon */}
            <div className="space-y-1 flex-1">
                {menuItems
                    .filter(item => isLinkAllowed(item.roles))
                    .map(item => (
                        <LinkItem key={item.href} {...item} Icon={item.icon} />
                    ))}
            </div>

            {/* Ayarlar (En altta) */}
            <div className="pt-4 border-t border-gray-100">
                <LinkItem href="/settings" name="Ayarlar" Icon={Cog6ToothIcon} />
            </div>
        </nav>
    );
}