// src/types/memberships.ts

// MembershipData, RequestData gibi tüm merkezi tipler buraya taşınır.

export interface MembershipData {
    id: string;
    member_name: string;
    member_id: string;
    package_name: string;
    start_date: string;
    end_date: string;
    status: 'Aktif' | 'Pasif' | 'Beklemede' | string;
    email: string;
    remaining_sessions: number; // Kalan ders/seans sayısı
    session_type: 'Seans' | 'Ders' | 'Ay';
    notes: string; 
}

export interface RequestData { 
    id: string;
    member_name: string;
    member_id: string;
    package_name: string;
    package_id: string;
    requested_date: string;
    status: 'Beklemede' | 'Onaylandı' | 'Reddedildi';
    rejection_reason?: string;
}

export interface PackageData {
    id: string; 
    name: string; 
    price: number; 
    details: string;
}

export interface UserSelectionData {
    id: string; 
    name: string;
}