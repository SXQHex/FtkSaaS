// src/mock-data/memberships.ts

import { MembershipData, RequestData, PackageData, UserSelectionData } from '@/types/memberships';

// --- MOCK VERİ DEPOLAMA (Global State Simülasyonu) ---
// Bu değişkenler gerçek API'den geliyormuş gibi simüle edilir.

export let MOCK_MEMBERSHIPS: MembershipData[] = [
    { id: 'm1', member_name: 'Ayşe Yılmaz', member_id: 'u1', package_name: 'Premium Fit', start_date: '2025-01-15', end_date: '2026-01-15', status: 'Aktif', email: 'ayse@mail.com', remaining_sessions: 12, session_type: 'Seans', notes: 'Haftada 3 gün özel ders alıyor.' },
    { id: 'm2', member_name: 'Mehmet Kaya', member_id: 'u2', package_name: 'Temel Egzersiz', start_date: '2025-03-01', end_date: '2025-09-01', status: 'Beklemede', email: 'mehmet@mail.com', remaining_sessions: 5, session_type: 'Ders', notes: 'Ödeme onayı bekleniyor.' },
    { id: 'm3', member_name: 'Selin Yıldız', member_id: 'u7', package_name: 'Premium', start_date: '2025-11-22', end_date: '2026-11-22', status: 'Pasif', email: 'selin@mail.com', remaining_sessions: 0, session_type: 'Ay', notes: 'Eski üyelik kaydı.' },
];

export let MOCK_PENDING_REQUESTS: RequestData[] = [ 
    { id: 'req1', member_name: 'Fatma Genç', member_id: 'u4', package_name: 'VIP Yıllık Paket', package_id: 'p3', requested_date: '2025-12-01', status: 'Beklemede' },
    { id: 'req2', member_name: 'Deniz Aksu', member_id: 'u5', package_name: 'Premium 10 Seans', package_id: 'p2', requested_date: '2025-12-05', status: 'Beklemede' },
];

export let MOCK_REQUEST_HISTORY: RequestData[] = [ 
    { id: 'req_h1', member_name: 'Mert Akın', member_id: 'u6', package_name: 'Temel Aylık Abonelik', package_id: 'p1', requested_date: '2025-11-20', status: 'Onaylandı' },
    { id: 'req_h2', member_name: 'Selin Yıldız', member_id: 'u7', package_name: 'Premium', package_id: 'p4', requested_date: '2025-11-22', status: 'Reddedildi', rejection_reason: 'Mevcut üyelik süresi henüz bitmedi.' },
];

export const MOCK_PACKAGES: PackageData[] = [
    { id: 'p1', name: 'Temel Aylık Abonelik', price: 800, details: 'Ayda sınırsız erişim.' },
    { id: 'p2', name: 'Premium 10 Seans', price: 3500, details: '10 adet özel ders/seans hakkı.' },
    { id: 'p3', name: 'VIP Yıllık Paket', price: 10000, details: 'Yıllık sınırsız erişim ve 5 özel seans.' },
    { id: 'p4', name: 'Haftalık Deneme', price: 150, details: '7 günlük deneme paketi.' },
];

export const MOCK_USERS: UserSelectionData[] = [
    { id: 'u1', name: 'Ayşe Yılmaz (MEMBER)' },
    { id: 'u2', name: 'Burak Demir (STAFF)' },
    { id: 'u3', name: 'Cem Kaya (ADMIN)' },
    { id: 'u4', name: 'Fatma Genç (MEMBER)' },
    { id: 'u5', name: 'Deniz Aksu (MEMBER)' },
    { id: 'u6', name: 'Mert Akın (MEMBER)' },
    { id: 'u7', name: 'Selin Yıldız (MEMBER)' },
];