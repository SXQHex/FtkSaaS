/** Kursların ana kategorisi (Örn: Salsa, Yoga, Bale) */
export interface Discipline {
    id: string;
    name: string;
    description?: string;
}

/** Kursların zorluk seviyesi (Örn: Yeni Başlayan, Orta, İleri) */
export interface Level {
    id: string;
    name: string;
    order: number; // Sıralama önceliği (1: en kolay)
}

/** Bir disiplin içindeki alt stil/tür (Örn: Salsa içinde LA Style, New York Style) */
export interface Style {
    id: string;
    name: string;
    disciplineId: string; // Ait olduğu disiplin
}

// --- Yeni Kurs ve Grup Yönetimi Tipleri ---

/** Kurs grubunun olası durumları */
export type CourseStatus = 'Planned' | 'Active' | 'Completed' | 'Cancelled';


// YENİ TANIM: Kursun türü (Backend GroupTypeDefinition modelinden gelen varsayımsal değerler)
/** Kursun türü (Örn: Grup Dersi, Özel Ders, Seminer, Atölye) */
export type CourseType = 'Group' | 'Private' | 'Seminar' | 'Workshop' | 'Other'; 


// 1. Course Definition (course_definitions.json'a karşılık gelir)
/** Bir kursun temel tanımı (Başlık, hangi disiplin/seviyeye ait olduğu) */
export interface CourseDefinition {
    id: string;
    title: string;
    description: string;
    discipline_id: string; // Discipline'a referans
    level_id: string;      // Level'a referans
}

// 2. Course Group (course_groups.json'a karşılık gelir)
/** Belirli bir dönemde açılan kurs grubu örneği (Sınıf) */
export interface CourseGroup {
    id: string;
    definition_id: string; // CourseDefinition'a referans
    group_name: string;
    status: CourseStatus;
    
    // YENİ ALAN: Grup Tipi (Backend'deki GroupTypeDefinition'dan gelir)
    group_type: CourseType; 

    start_date: string; // ISO Date string: YYYY-MM-DD
    end_date: string;   // ISO Date string: YYYY-MM-DD
    capacity: number;
    price: string;      // Decimal string (API'den geldiği gibi)
    instructor_id: string; // Eğitmene referans (users.json)

    // ÖZEL DERS PAKETLERİ İÇİN İSTEĞE BAĞLI ALANLAR (Frontend'de detaylı yönetim için)
    package_quantity?: number; // Paketin içerdiği seans/saat sayısı
    session_duration_minutes?: number; // Seans başına varsayılan süre
    validity_period?: string; // Paketin geçerlilik süresi (örn: '6 months')
}

// 3. Zenginleştirilmiş (Aggregated) Kurs Grubu Tipi
// Listeleme sayfasında kullanılacak, tüm bağlı verileri içeren tip
export interface CourseGroupDetailed {
    id: string;
    group_name: string;
    status: CourseStatus;
    start_date: string;
    end_date: string;
    capacity: number;
    price: number; // String'den Number'a dönüştürülmüş fiyat
    
    // YENİ ALAN: Grup Tipi
    group_type: CourseType;

    // Bağlantılı bilgiler
    course_title: string;    // CourseDefinition'dan
    discipline_name: string; // Discipline'dan
    level_name: string;      // Level'dan

    // Eğitmen bilgisi (users.json'dan)
    instructor_id: string;
    instructor_name: string; // Eğitmen adı ve soyadı birleştirilmiş
    
    // Metrikler
    enrolled_count: number;      // Gruba kayıtlı öğrenci sayısı
    remaining_capacity: number;  // Kalan kontenjan
    total_sessions: number;      // Toplam oturum sayısı (course_sessions.json'dan)
}