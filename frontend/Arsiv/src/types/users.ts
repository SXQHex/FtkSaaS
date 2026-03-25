// src/types/users.ts (YENİ)

import { EntityId, UserRole } from './common';

// Kullanıcı Kayıtlarından (users.json) alınan temel User tipi
export interface User {
    id: EntityId;
    username: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string; // Backend'den gelen string rolü (Örn: "Admin")
    is_staff: boolean;
    is_superuser: boolean;
    is_active: boolean;
    mock_role_type: UserRole; // Frontend için dönüştürülmüş UserRole
    date_joined: string;
    last_login: string | null;
}

// Diğer kullanıcıya özel tipler (Örn: UserDetail, TrainerProfile) buraya gelir.