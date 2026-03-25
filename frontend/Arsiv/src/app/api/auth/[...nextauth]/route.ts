// src/app/api/auth/[...nextauth]/route.ts

import NextAuth, { type AuthOptions, User } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { AuthResponse } from '@/types/auth'; 

/**
 * 1. ADIM: Backend API'ye Login İsteği Gönderme Fonksiyonu
 */
async function authenticateUser(credentials: any): Promise<AuthResponse> {
    const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    
    // Login API endpoint'i (örneğin: Django, NestJS, vs.)
    const response = await fetch(`${BASE_URL}/account/token/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            username: credentials.username,
            password: credentials.password,
        }),
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        // Hata durumunda NextAuth'un yakalaması için hata fırlatılır
        throw new Error(errorData.detail || 'Giriş bilgileri hatalı.');
    }
    
    return (await response.json()) as AuthResponse;
}


/**
 * 2. ADIM: Auth.js Yapılandırma Seçenekleri
 */
export const authOptions: AuthOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                username: { label: 'Kullanıcı Adı', type: 'text' },
                password: { label: 'Şifre', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials) return null;
                
                try {
                    const authData = await authenticateUser(credentials);
                    
                    // Auth.js'e geri dönen kullanıcı objesi
                    return {
                        id: authData.user_id, 
                        name: authData.username, 
                        role: authData.role,
                        accessToken: authData.access,
                        refreshToken: authData.refresh,
                        // Diğer standart NextAuth alanları yoksa buraya eklenebilir.
                    } as User;;
                } catch (error: any) {
                    // console.error(error);
                    // Hata mesajını login sayfasına iletmek için fırlatılır
                    throw new Error(error.message);
                }
            },
        }),
    ],
    
    callbacks: {
        // JWT Oluşturma/Güncelleme
        async jwt({ token, user, trigger }) {
            // İlk giriş (signIn) anında kullanıcı verilerini token'a ekle
            if (user && trigger === 'signIn') { 
                token.id = user.id;
                token.role = user.role;
                token.accessToken = (user as any).accessToken; // Token'ı taşı
                token.refreshToken = (user as any).refreshToken;
            }
            
            // Eğer isterseniz, burada token süresi kontrolü ve yenileme mantığı eklenebilir.
            
            return token;
        },
        
        // Session Objesi Oluşturma
        async session({ session, token }) {
            // Token'daki bilgileri istemci tarafında kullanılacak session'a taşı
            session.user.id = token.id as string;
            (session.user as any).role = token.role as string;
            session.accessToken = token.accessToken as string; 
            
            return session;
        },
    },
    
    // Oturum yönetimi için JWT kullan
    session: {
        strategy: 'jwt' as const, // Hata Kodu 2345 çözümü: 'jwt' as const kullanılır.
    },
    
    pages: {
        signIn: '/login', // Login sayfasının rotası
    }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };