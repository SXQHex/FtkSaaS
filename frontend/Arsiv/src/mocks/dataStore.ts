// src/mocks/dataStore.ts (Düzeltilmiş JSON ve Tip Yolları)

// --- JSON Dosyalarını Doğru Yoldan İçe Aktarma ---
// JSON dosyaları './data/' klasörü içinde olduğu için yol düzeltildi.
import USERS_JSON from './data/users.json';
import ROOMS_JSON from './data/rooms.json';
import ENROLLMENTS_JSON from './data/enrollments.json';
import COURSE_DEFINITIONS_JSON from './data/course_definitions.json';
import COURSE_GROUPS_JSON from './data/course_groups.json';
import COURSE_SESSIONS_JSON from './data/course_sessions.json';
import DISCIPLINES_JSON from './data/disciplines.json';
import LEVELS_JSON from './data/levels.json';


// --- Tipleri Modüler Yoldan İçe Aktarma ---
// User, Room gibi tipler artık common.ts'ten değil, ilgili modül dosyalarından gelir.
// Yeni modüler yapıyı yansıtır.
import { UserRole } from '@/types/common';
import { User } from '@/types/users'; // User artık users.ts'ten
import { Room, Enrollment } from '@/types/schedule'; // Room ve Enrollment schedule.ts'ten
import { AuthResponse } from '@/types/auth'; // LoginResponse (AuthResponse) auth.ts'ten gelmeli


// --- MOCK ROL TANIMLARI --- (Eski authMockData.ts'ten alındı)
export const MOCK_ROLES = {
    ADMIN: 'Admin', 
    STAFF: 'Staff', 
    TRAINER: 'Trainer', 
    ASSISTANT: 'Assistant', 
    MEMBER: 'Member', 
    GUEST: 'Guest', 
};

// --- Role Dönüşüm Yardımcı Fonksiyonu ---
const mapBackendRoleToFrontendRole = (role: string): UserRole => {
    return role.toUpperCase() as UserRole;
};
// ----------------------------------------

// --- 1. TÜM VERİLERİ TANIMLAMA VE DIŞA AKTARMA ---

// Users: Rol dönüşümünü yaparak tek tip olarak dışa aktarılır.
export const ALL_USERS = (USERS_JSON as any[]).map(user => ({
    ...user,
    // JSON'da silinmesini önerdiğimiz mock_role_type alanını burada oluşturuyoruz.
    mock_role_type: mapBackendRoleToFrontendRole(user.role), 
})) as User[];


// Diğer veriler basitçe dışa aktarılır
export const ALL_ROOMS = ROOMS_JSON as Room[];
export const ALL_ENROLLMENTS = ENROLLMENTS_JSON as Enrollment[];
export const ALL_COURSE_DEFINITIONS = COURSE_DEFINITIONS_JSON as any[];
export const ALL_COURSE_GROUPS = COURSE_GROUPS_JSON as any[];
export const ALL_COURSE_SESSIONS = COURSE_SESSIONS_JSON as any[];
export const ALL_DISCIPLINES = DISCIPLINES_JSON as any[];
export const ALL_LEVELS = LEVELS_JSON as any[];


// --- 2. AUTH İÇİN GEREKLİ KREDİ BİLGİLERİ (Login) ---

export interface MockCredentials {
    username: string;
    password: string; 
    id: string;
    role: UserRole; 
}

/**
 * LOGIN İÇİN KULLANILACAK KREDİ BİLGİLERİ (Tüm kullanıcılar için 'sifre123' parolası)
 */
export const MOCK_AUTH_CREDENTIALS: MockCredentials[] = ALL_USERS.map(user => ({
    username: user.username,
    password: 'sifre123', 
    id: user.id,
    role: mapBackendRoleToFrontendRole(user.role), 
}));

// --- 3. LOGIN RESPONSE ve dataStore ---

export const MOCK_LOGIN_RESPONSE: AuthResponse = {
    access: "mock_access_token_default",
    refresh: "mock_refresh_token_default",
    role: mapBackendRoleToFrontendRole(MOCK_ROLES.ADMIN), // ADMIN rolünü döndür
    user_id: ALL_USERS.find(u => u.username === 'admin')?.id || 'mock-admin-id',
    username: 'admin',
};

// Handler'ların kullanacağı eski dataStore yapısını simüle ederiz.
export const dataStore = {
    users: ALL_USERS,
    rooms: ALL_ROOMS,
    enrollments: ALL_ENROLLMENTS,
    // ... diğer veri setleri
};