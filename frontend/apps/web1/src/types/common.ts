// src/types/common.ts (GÜNCELLENMİŞ VE SADALAŞTIRILMIŞ)

// --- Genel Tipler --

/**
 * Kullanıcı Rolleri Hiyerarşisi (Yetki zinciri)
 * ADMIN > STAFF > TRAINER > ASSISTANT > MEMBER > GUEST
 */
export type UserRole = 
    'ADMIN' | 
    'STAFF' | 
    'TRAINER' | 
    'ASSISTANT' | 
    'MEMBER' | 
    'GUEST';

export const USER_ROLES = {
    ADMIN: 'ADMIN',
    STAFF: 'STAFF',
    TRAINER: 'TRAINER',
    ASSISTANT: 'ASSISTANT',
    MEMBER: 'MEMBER',
    GUEST: 'GUEST',
} as const;

// API listeleme/filtreleme için standart yanıt yapısı
export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

// Tüm modüllerde kullanılacak genel UUID tipi
export type EntityId = string;

// Standart API CRUD işlemlerinde kullanılan temel entity yapısı
export interface BaseEntity {
    id: EntityId;
}

// API'dan gelen standart tarih formatı
export type ISODateString = string; // YYYY-MM-DDTHH:mm:ss.sssZ

// API'dan gelen string formatındaki sayılar
export type DecimalString = string;