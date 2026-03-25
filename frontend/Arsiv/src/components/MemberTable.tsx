// src/components/MemberTable.tsx

import React from 'react';

// students/page.tsx dosyasından taşınan veri tipi tanımı
interface MemberData {
    id: string;
    full_name: string;
    email: string;
    role: string;
    is_active: boolean;
    current_status: string;
    phone_number: string;
}

interface MemberTableProps {
    members: MemberData[];
    // İleride eklenecekler: onEdit, onDelete, onStatusChange
}

const roleMap: Record<string, string> = {
    'ADMIN': 'Yönetici',
    'STAFF': 'Personel',
    'STUDENT': 'Öğrenci',
    'TRAINER': 'Eğitmen',
};

const statusMap: Record<string, string> = {
    'ACTIVE': 'Aktif',
    'SUSPENDED': 'Askıda',
    'EXPIRED': 'Süresi Doldu',
    'PENDING': 'Beklemede',
};

// --- Helper Functions (Yardımcı Fonksiyonlar) ---

const getStatusBadge = (status: string) => {
    let colorClass = '';
    switch (status) {
        case 'ACTIVE':
            colorClass = 'bg-green-100 text-green-800';
            break;
        case 'SUSPENDED':
            colorClass = 'bg-yellow-100 text-yellow-800';
            break;
        case 'EXPIRED':
            colorClass = 'bg-red-100 text-red-800';
            break;
        default:
            colorClass = 'bg-gray-100 text-gray-800';
    }
    return (
        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClass}`}>
            {statusMap[status] || status}
        </span>
    );
};


// --- MEMBER TABLE COMPONENT ---

const MemberTable: React.FC<MemberTableProps> = ({ members }) => {

    if (!members || members.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500">
                Hiç üye kaydı bulunamadı.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
                {/* Başlık (Header) */}
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İsim / E-posta</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                    </tr>
                </thead>
                {/* İçerik (Body) */}
                <tbody className="bg-white divide-y divide-gray-200">
                    {members.map((member) => (
                        <tr key={member.id} className="hover:bg-indigo-50 transition duration-150 ease-in-out">
                            
                            {/* İsim / E-posta */}
                            <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-gray-900">{member.full_name}</div>
                                <div className="text-sm text-gray-500">{member.email}</div>
                            </td>
                            
                            {/* Rol */}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {roleMap[member.role] || member.role}
                            </td>
                            
                            {/* Durum */}
                            <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(member.current_status)}
                            </td>
                            
                            {/* Telefon */}
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {member.phone_number || 'N/A'}
                            </td>
                            
                            {/* İşlemler (Actions) */}
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                <a 
                                    href={`/students/${member.id}`} 
                                    className="text-indigo-600 hover:text-indigo-900 mr-4"
                                    title="Detayları Görüntüle"
                                >
                                    Detay
                                </a>
                                {/* İleride silme/güncelleme butonları buraya gelecek */}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default MemberTable;