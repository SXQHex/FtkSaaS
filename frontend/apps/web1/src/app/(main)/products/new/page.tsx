// src/app/products/new/page.tsx
import { PackageType } from '@/types/packages';
import PackageWizard from './_components/PackageWizard';
import { fetchInitialDataForWizard } from '@/lib/dataService';
import { Discipline, Level, Style } from '@/types/courses';

// Bu tip, sihirbazın başlangıçta ihtiyacı olan tüm statik verileri tutar
export interface WizardInitialData {
  disciplines: Discipline[];
  levels: Level[];
  styles: Style[];
}

// Next.js Sunucu Bileşeni: Statik verileri çeker ve istemci bileşenine iletir.
export default async function NewProductPage() {
  let initialData: WizardInitialData | null = null;
  let error: string | null = null;

  try {
    // Statik disiplin, seviye ve stil verilerini çekiyoruz
    // (Bu fonksiyon src/lib/dataService.ts içinde tanımlı)
    initialData = await fetchInitialDataForWizard();
  } catch (e) {
    console.error("Paket sihirbazı başlangıç verileri yüklenirken hata oluştu:", e);
    error = "Paket oluşturma formunun başlatılması için gerekli veriler yüklenemedi.";
  }

  // Varsayılan boş paket durumu
  const initialPackage: PackageType = {
    id: 'temp-new',
    name: '',
    description: '',
    price: 0,
    currency: 'TRY',
    isActive: true,
    // Adım 2'deki default değeri: Kontör bazlı, 10 ders hakkı
    usage: { model: 'CLASS_BASED', totalCredits: 10 }, 
    classInclusions: [],
    serviceInclusions: [],
    allowedPaymentMethods: ['Cash', 'CreditCard'], // Adım 4 default değeri
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-2 text-gray-800">
        📦 Yeni Paket Tanımlama Sihirbazı
      </h1>
      <p className="text-gray-600 mb-6">
        Ders grupları, seviyeler ve ödeme modelleri ile kısıtlanmış yeni bir paket oluşturun.
      </p>

      {error ? (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">
          {error}
        </div>
      ) : (
        <PackageWizard 
          initialPackage={initialPackage} 
          initialData={initialData!} 
        />
      )}
    </div>
  );
}