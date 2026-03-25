// src/app/page.tsx
// ❗ BU SAYFA ARTIK İSTEMCİ BİLEŞENİDİR (useAuthGuard kullandığı için) ❗
"use client"; 

import MobileMenuProvider from '@/components/MobileMenuProvider';
import DashboardLayout from '@/components/DashboardLayout'; 
import DashboardCard from '@/components/DashboardCard'; 
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { 
    BookmarkIcon, 
    CurrencyDollarIcon, 
    UserPlusIcon, 
    MegaphoneIcon 
} from '@heroicons/react/24/outline'; 

// --- Mock Data ---
const mockDashboardData = {
    totalClasses: 24,
    monthlyRevenue: "₺45.000",
    newRegistrations: 12,
    newAnnouncements: 3,
};

export default function DashboardPage() {
    
    const { isLoadingAuth, isAuthorized } = useAuthGuard(['ADMIN', 'STAFF']);

    if (isLoadingAuth) {
        return (
             <div className="min-h-screen flex items-center justify-center text-gray-700">
                <svg className="animate-spin h-5 w-5 text-indigo-600 mr-3" viewBox="0 0 24 24"></svg>
                Yetki kontrolü yapılıyor...
            </div>
        );
    }
    
    if (!isAuthorized) {
        return null;
    }

    // DashboardLayout, Sidebar ve Main içeriğinin akışını doğru yönetmelidir.
    return (
        <DashboardLayout>
            <div className="p-6 md:p-10">
                <h1 className="text-3xl font-extrabold mb-8 text-gray-800">
                    Dashboard Özeti
                </h1>
                
                {/* İstatistik Kartları */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    
                    {/* Toplam Sınıf */}
                    <DashboardCard 
                        title="Toplam Sınıf" 
                        value={mockDashboardData.totalClasses} 
                        icon={<BookmarkIcon className="w-6 h-6" />} 
                        color="indigo" 
                    />
                    
                    {/* Aylık Gelir */}
                    <DashboardCard 
                        title="Aylık Gelir" 
                        value={mockDashboardData.monthlyRevenue} 
                        icon={<CurrencyDollarIcon className="w-6 h-6" />} 
                        color="green" 
                    />
                    
                    {/* Yeni Kayıtlar */}
                    <DashboardCard 
                        title="Yeni Kayıtlar" 
                        value={mockDashboardData.newRegistrations} 
                        icon={<UserPlusIcon className="w-6 h-6" />} 
                        color="yellow" 
                    />
                    
                    {/* Duyurular */}
                    <DashboardCard 
                        title="Yeni Duyurular" 
                        value={mockDashboardData.newAnnouncements} 
                        icon={<MegaphoneIcon className="w-6 h-6" />} 
                        color="red" 
                    />
                </div>
                
                {/* Ana Gövde Alanı */}
                <div className="mt-8 bg-white p-6 rounded-xl shadow-lg border border-gray-100 min-h-[400px]">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Son Aktiviteler ve Duyurular</h2>
                    <p className="text-gray-500">
                        Bu alandaki veriler backend hazır olduğunda API üzerinden çekilecektir. Şu an mock data ile görüntülenmektedir.
                    </p>
                </div>

            </div>

        </DashboardLayout>
    );
}