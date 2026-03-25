// src/mocks/handlers.ts

import { http, HttpResponse } from 'msw';
// Auth tiplerini içe aktarın (AuthPayload ve AuthResponse)
import { AuthPayload, AuthResponse } from '@/types/auth'; 

// Yeni merkezi veri deposundan okuyun.
import { 
    MOCK_AUTH_CREDENTIALS, 
    MOCK_LOGIN_RESPONSE, 
    dataStore, // Tüm veri setleri (users, rooms, vs.)
    ALL_USERS // dataStore içinde ayrı ayrı kullanılabilecek ALL_USERS
} from './dataStore'; 

// API'nin temel URL'ini bir sabit (constant) olarak tanımlıyoruz.
const BASE_URL = 'http://127.0.0.1:8000/api'; 

export const handlers = [

    // 1. Yetkilendirme (Auth) Handler: POST /account/token/
    http.post(`${BASE_URL}/account/token/`, async ({ request }) => {
        
        // KRİTİK: İsteğin JSON gövdesini asenkron olarak oku (MSW hatası düzeltildi)
        const { username, password } = (await request.json()) as AuthPayload;
        
        // MOCK_AUTH_CREDENTIALS kullan
        const mockUser = MOCK_AUTH_CREDENTIALS.find(u => 
            u.username === username && u.password === password
        );

        if (!mockUser) {
            // Başarısız yanıt (401 Unauthorized)
            return HttpResponse.json({ 
                detail: 'Giriş bilgileri hatalı veya hesap aktif değil.'
            }, { status: 401 });
        }
        
        console.warn(`[MSW] MOCK LOGIN BAŞARILI: ${mockUser.role} (Kullanıcı: ${username})`);

        // Başarılı giriş yanıtını (AuthResponse tipine uygun) döndür.
        const responseData: AuthResponse = {
            // Temel veriyi MOCK_LOGIN_RESPONSE'dan alıp, role'ü dinamikleştiriyoruz.
            ...MOCK_LOGIN_RESPONSE,
            access: `mock_access_token_${username}`,
            role: mockUser.role, 
            user_id: mockUser.id,
            username: mockUser.username,
        };
        
        return HttpResponse.json(responseData, { status: 200 });
    }),
    
    // 2. Üye Listesi (Users) Handler: GET /v1/users/members
    http.get(`${BASE_URL}/v1/users/members`, () => {
        console.log("[MSW] MOCK Üye Listesi çekiliyor.");
        
        // ALL_USERS'ı kullanarak Üye Listesi yapısına dönüştürüyoruz.
        const members = ALL_USERS
            .filter(u => u.mock_role_type === 'MEMBER') // Sadece üyeleri listele
            .map(u => ({ 
                id: u.id,
                full_name: `${u.first_name} ${u.last_name}`,
                email: u.email,
                role: u.mock_role_type, // Dönüştürülmüş rolü kullan
                is_active: u.is_active, 
                current_status: u.is_active ? 'Aktif' : 'Pasif', 
                phone_number: 'N/A', // Gerçek veride olmalı, şimdilik sabit
            }));
            
        return HttpResponse.json(members, { status: 200 });
    }),

    // --- Gelecekteki Diğer Handler'lar için Placeholder ---
    
    // http.get(`${BASE_URL}/v1/rooms`, () => { ... }),
    // http.get(`${BASE_URL}/v1/courses`, () => { ... }),
];