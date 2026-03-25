// src/types/packages.ts

// --- Adım 2: Kullanım Modeli Tipleri ---

/** Paketin geçerlilik modelini tanımlar: Süreye mi, ders sayısına mı bağlı? */
export type UsageModel = 'CLASS_BASED' | 'TIME_BASED';

/** Süreli paketler için geçerlilik birimi */
export type DurationType = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR';

/** Paketin kullanım hakkı detayları */
export interface PackageUsage {
    model: UsageModel;
    /** CLASS_BASED ise zorunlu: Toplam ders/kontör hakkı */
    totalCredits?: number; 
    /** TIME_BASED ise zorunlu: Süre değeri (örn: 3) */
    durationValue?: number;
    /** TIME_BASED ise zorunlu: Süre birimi (örn: MONTH) */
    durationType?: DurationType; 
}


// --- Adım 3: İçerik Kısıtlama Tipleri ---

/** Paketle dahil edilen bir ders hakkının kısıtlamaları (Örn: 5 adet 'Salsa İleri' dersi) */
export interface PackageClassInclusion {
    id: string; // Geçici ID
    credits: number; // Bu kısıtlamaya ait ders/kontör sayısı
    disciplineRestriction: string | null; // Sadece bu disiplin ID'sine ait dersler
    styleRestriction: string | null; // Sadece bu stil ID'sine ait dersler (opsiyonel)
    levelRestriction: string | null; // Sadece bu seviye ID'sine ait dersler
    /** True ise, belirtilen seviyenin altındaki seviyeleri de kapsar. */
    includeLowerLevels: boolean; 
}

/** Paketle dahil edilen ek hizmet veya fayda (Örn: Ücretsiz havlu kullanımı, %10 indirim) */
export interface PackageServiceInclusion {
    id: string; // Geçici ID
    serviceName: string; // Hizmetin adı (Örn: Özel ders, Kafeterya)
    benefitType: 'FREE' | 'DISCOUNT_PERCENTAGE' | 'LIMITED_COUNT';
    value: number; // Fayda değeri (Örn: FREE için 1, İndirim için 10, Sayı için 3)
    description?: string;
}


// --- Adım 4: Ödeme Tipleri ---

/** Paketin satın alınabileceği ödeme yöntemleri */
export type PaymentMethod = 'Cash' | 'CreditCard' | 'BankTransfer';


// --- ANA PAKET TİPİ ---

/** Tam bir Paket/Üyelik tanımı */
export interface PackageType {
    id: string;
    name: string;
    description: string;
    price: number;
    currency: 'TRY' | 'USD';
    isActive: boolean; // Yayında mı?

    // Kısıtlamalar ve Kullanım
    usage: PackageUsage; // Adım 2
    classInclusions: PackageClassInclusion[]; // Adım 3: Ders kısıtlamaları
    serviceInclusions: PackageServiceInclusion[]; // Adım 3: Ek hizmetler

    // Ödeme
    allowedPaymentMethods: PaymentMethod[]; // Adım 4
    
    // Opsiyonel Tarih & Log Alanları (Gelecekte eklenebilir)
    // createdAt?: string;
    // createdByUserId?: string;
}