// src/types/auth.ts

import { UserRole } from './common'; 
import 'next-auth';
import 'next-auth/jwt';


/**
 * ----------------------------------------------------
 * 1. API PAYLOAD VE RESPONSE TİPLERİ (DEĞİŞMEDİ)
 * ----------------------------------------------------
 */

export interface AuthPayload {
    username: string;
    password: string; 
}

export interface AuthResponse {
    access: string; 
    refresh: string; 
    role: UserRole; 
    user_id: string; 
    username: string; // ✅ Backend'den geliyor
}

/**
 * ----------------------------------------------------
 * 2. NEXTAUTH TİP GENİŞLETMELERİ (HATA ÇÖZÜMÜ)
 * ----------------------------------------------------
*/

declare module 'next-auth' {
    /**
     * User tipini genişletme (Authorize callback'inden dönen objenin tipi)
     */
    interface User {
        role: UserRole;             
        accessToken: string;        
        refreshToken: string;       
        // 🔥 EKLEME: Header.tsx'teki hatayı çözmek için eklendi
        username: string;           
    }

    /**
     * Oturum objesini genişletme (Frontend'de useSession hook'undan döner)
     */
    interface Session {
        accessToken?: string;        
        user: {
            id: string;             
            role: UserRole;         
            // 🔥 EKLEME: Session içindeki user objesine de ekliyoruz
            username: string;
            // NextAuth'un varsayılan alanlarını koruyoruz
            name?: string | null;
            email?: string | null;
            image?: string | null;
        };
    }
}

declare module 'next-auth/jwt' {
    /**
     * JWT (JSON Web Token) tipini genişletme
     */
    interface JWT {
        id?: string;
        role?: UserRole;            
        accessToken?: string;       
        refreshToken?: string;      
        // 🔥 EKLEME: JWT payload'a da ekliyoruz
        username?: string;
    }
}


/**
 * ----------------------------------------------------
 * 3. KULLANICI PROFİL TİPİ (Opsiyonel - Front-end kullanımı)
 * ----------------------------------------------------
 * Bu tip, Session.user'dan gelen veriyi yansıtır.
 */
export interface UserProfile { 
    id: string; 
    username: string;
    role: UserRole;
}