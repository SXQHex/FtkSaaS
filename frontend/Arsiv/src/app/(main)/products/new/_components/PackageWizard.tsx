// src/app/products/new/_components/PackageWizard.tsx
'use client';

import React, { useState } from 'react';
import { PackageType, UsageModel, PackageUsage, PackageClassInclusion, PackageServiceInclusion } from '@/types/packages';
import { WizardInitialData } from '../page';
import { CheckCircleIcon, ClockIcon, TicketIcon, PlusIcon, TrashIcon, BanknotesIcon, CreditCardIcon } from '@heroicons/react/24/outline'; // Tailwind Iconları

// --- YARDIMCI FONKSİYONLAR ---
const generateTempId = () => Math.random().toString(36).substring(2, 9);
interface StepProps { 
    pkg: PackageType; 
    setPkg: React.Dispatch<React.SetStateAction<PackageType>>;
    initialData: WizardInitialData; // Adım 1 ve 2 kullanmasa bile tip güvenliği için ekliyoruz
}


// --- ADIM 1: TEMEL BİLGİLER ---
const Step1BasicInfo: React.FC<StepProps> = ({ pkg, setPkg }) => {
    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">1. Temel Paket Tanımı</h2>
            
            <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700">Paket Adı <span className="text-red-500">*</span></label>
                <input 
                    type="text" 
                    id="name"
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={pkg.name}
                    onChange={(e) => setPkg(p => ({ ...p, name: e.target.value }))}
                    placeholder="Örn: Yaza Hazırlık Kampı"
                />
            </div>
            <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Açıklama</label>
                <textarea
                    id="description"
                    rows={3}
                    className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    value={pkg.description}
                    onChange={(e) => setPkg(p => ({ ...p, description: e.target.value }))}
                    placeholder="Paketin avantajları ve kapsamı"
                />
            </div>
            <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700">Fiyat <span className="text-red-500">*</span></label>
                    <input
                        type="number"
                        id="price"
                        min="0"
                        className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={pkg.price === 0 ? '' : pkg.price}
                        onChange={(e) => setPkg(p => ({ ...p, price: parseFloat(e.target.value) || 0 }))}
                    />
                </div>
                <div>
                    <label htmlFor="currency" className="block text-sm font-medium text-gray-700">Para Birimi</label>
                    <select
                        id="currency"
                        className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                        value={pkg.currency}
                        onChange={(e) => setPkg(p => ({ ...p, currency: e.target.value as 'TRY' | 'USD' }))}
                    >
                        <option value="TRY">TRY (₺)</option>
                        <option value="USD">USD ($)</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

// --- ADIM 2: KULLANIM MODELİ (Süreli / Kontörlü) ---

const UsageModelCard = ({ title, description, icon: Icon, isSelected, onClick }: { 
    title: string, 
    description: string, 
    icon: React.ElementType, 
    isSelected: boolean, 
    onClick: () => void 
}) => (
    <div 
        onClick={onClick}
        className={`relative p-5 border-2 rounded-lg cursor-pointer transition duration-200 ${
            isSelected 
                ? 'border-indigo-600 bg-indigo-50 shadow-lg' 
                : 'border-gray-200 hover:border-indigo-300'
        }`}
    >
        {isSelected && (
            <CheckCircleIcon className="absolute top-2 right-2 h-6 w-6 text-indigo-600" />
        )}
        <Icon className="h-8 w-8 text-indigo-500 mb-3" />
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
    </div>
);

const Step2UsageModel: React.FC<StepProps> = ({ pkg, setPkg }) => {
    
    const updateUsage = (newUsage: Partial<PackageUsage>) => {
        setPkg(p => ({ 
            ...p, 
            usage: { 
                ...p.usage, 
                ...newUsage 
            } 
        }));
    };

    const handleModelChange = (model: UsageModel) => {
        const resetUsage = model === 'CLASS_BASED' 
            ? { model: 'CLASS_BASED', durationValue: undefined, durationType: undefined, totalCredits: 10 } 
            : { model: 'TIME_BASED', totalCredits: undefined, durationValue: 1, durationType: 'MONTH' };
            
        setPkg(p => ({ ...p, usage: resetUsage as PackageUsage }));
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">2. Kullanım Modeli</h2>
            <p className="text-sm text-gray-600">Bu paketin geçerliliği ders hakkı veya zaman dilimi üzerinden mi belirlenecek?</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <UsageModelCard
                    title="Kontör/Ders Bazlı (CLASS_BASED)"
                    description="Kullanıcı belirli sayıda ders hakkı veya kontör satın alır."
                    icon={TicketIcon}
                    isSelected={pkg.usage.model === 'CLASS_BASED'}
                    onClick={() => handleModelChange('CLASS_BASED')}
                />
                <UsageModelCard
                    title="Süreli/Zaman Bazlı (TIME_BASED)"
                    description="Kullanıcı belirli bir süre (ay, yıl) boyunca geçerli bir hak satın alır."
                    icon={ClockIcon}
                    isSelected={pkg.usage.model === 'TIME_BASED'}
                    onClick={() => handleModelChange('TIME_BASED')}
                />
            </div>
            
            {/* Model Detayları */}
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                {pkg.usage.model === 'CLASS_BASED' ? (
                    <div className="space-y-2">
                        <label htmlFor="credits" className="block text-sm font-medium text-gray-700">Toplam Kontör/Ders Hakkı <span className="text-red-500">*</span></label>
                        <input
                            type="number"
                            id="credits"
                            min="1"
                            value={pkg.usage.totalCredits || ''}
                            onChange={(e) => updateUsage({ totalCredits: parseInt(e.target.value) || undefined })}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 max-w-xs"
                        />
                        <p className="text-xs text-gray-500">Bu paketin üyeye sağlayacağı toplam ders/kontör sayısıdır.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-3 gap-4 max-w-lg">
                        <div className="col-span-1">
                            <label htmlFor="durationValue" className="block text-sm font-medium text-gray-700">Süre Değeri <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                id="durationValue"
                                min="1"
                                value={pkg.usage.durationValue || ''}
                                onChange={(e) => updateUsage({ durationValue: parseInt(e.target.value) || undefined })}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            />
                        </div>
                        <div className="col-span-2">
                            <label htmlFor="durationType" className="block text-sm font-medium text-gray-700">Süre Birimi</label>
                            <select
                                id="durationType"
                                value={pkg.usage.durationType || 'MONTH'}
                                onChange={(e) => updateUsage({ durationType: e.target.value as PackageUsage['durationType'] })}
                                className="mt-1 block w-full rounded-md border border-gray-300 p-2 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                            >
                                <option value="DAY">Gün</option>
                                <option value="WEEK">Hafta</option>
                                <option value="MONTH">Ay</option>
                                <option value="YEAR">Yıl</option>
                            </select>
                        </div>
                        <p className="col-span-3 text-xs text-gray-500">Bu süre sonunda paket otomatik olarak sona erecektir. (Sınırsız ders hakkı bu aşamadan sonra kısıtlanacaktır.)</p>
                    </div>
                )}
            </div>
        </div>
    );
};

// --- ADIM 3: İÇERİK VE KISITLAMALAR ---

const ClassInclusionForm: React.FC<StepProps> = ({ pkg, setPkg, initialData }) => {
    
    // Geçici olarak yeni kısıtlama objesi tutulur
    const [newInclusion, setNewInclusion] = useState<Omit<PackageClassInclusion, 'id'>>({
        credits: 1,
        disciplineRestriction: null,
        styleRestriction: null,
        levelRestriction: null,
        includeLowerLevels: true,
    });

    // Seçilen disipline göre stilleri filtrele
    const filteredStyles = initialData.styles.filter(s => s.disciplineId === newInclusion.disciplineRestriction);

    const handleAddClassInclusion = () => {
        if (!newInclusion.disciplineRestriction || !newInclusion.levelRestriction || newInclusion.credits <= 0) {
            alert("Lütfen bir Disiplin, Seviye seçin ve Ders Hakkını 0'dan büyük yapın.");
            return;
        }

        const inclusionToAdd: PackageClassInclusion = {
            ...newInclusion,
            id: generateTempId(),
        };

        setPkg(p => ({
            ...p,
            classInclusions: [...p.classInclusions, inclusionToAdd]
        }));
        
        // Formu sıfırla
        setNewInclusion({
            credits: 1,
            disciplineRestriction: null,
            styleRestriction: null,
            levelRestriction: null,
            includeLowerLevels: true,
        });
    };

    const handleRemove = (id: string) => {
        setPkg(p => ({
            ...p,
            classInclusions: p.classInclusions.filter(item => item.id !== id)
        }));
    };
    
    // Statik verilerden isim bulucu
    const findDisciplineName = (id: string) => initialData.disciplines.find(d => d.id === id)?.name || 'Bilinmiyor';
    const findLevelName = (id: string) => initialData.levels.find(l => l.id === id)?.name || 'Bilinmiyor';
    
    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-indigo-700 border-b pb-2">Ders Hakkı Kısıtlamaları</h3>
            
            {/* Mevcut Kısıtlamalar Listesi */}
            {pkg.classInclusions.length > 0 && (
                <div className="space-y-3 p-3 bg-indigo-50 rounded-md border border-indigo-200">
                    <p className="text-sm font-medium text-indigo-700">Tanımlanan Kısıtlamalar:</p>
                    {pkg.classInclusions.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded shadow-sm text-sm">
                            <div className="flex-1">
                                <span className="font-bold text-indigo-600">{item.credits} Ders Hakkı</span>
                                <span className="text-gray-600 ml-3">| Disiplin: {findDisciplineName(item.disciplineRestriction!)} </span>
                                <span className="text-gray-600">| Seviye: {findLevelName(item.levelRestriction!)} </span>
                                {item.includeLowerLevels && <span className="text-green-600 text-xs ml-2">(+ Alt Seviyeler)</span>}
                            </div>
                            <button onClick={() => handleRemove(item.id)} className="text-red-500 hover:text-red-700 p-1">
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Yeni Kısıtlama Ekleme Formu */}
            <div className="p-4 border border-dashed border-gray-300 rounded-md bg-white">
                <p className="font-medium mb-3">Yeni Kısıtlama Ekle</p>
                <div className="grid grid-cols-4 gap-3">
                    {/* Ders Hakkı */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700">Ders Hakkı</label>
                        <input
                            type="number"
                            min="1"
                            value={newInclusion.credits}
                            onChange={(e) => setNewInclusion(c => ({ ...c, credits: parseInt(e.target.value) || 1 }))}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm"
                        />
                    </div>
                    {/* Disiplin */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700">Disiplin <span className="text-red-500">*</span></label>
                        <select
                            value={newInclusion.disciplineRestriction || ''}
                            onChange={(e) => setNewInclusion(c => ({ ...c, disciplineRestriction: e.target.value || null, styleRestriction: null }))}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm"
                        >
                            <option value="">Seçiniz</option>
                            {initialData.disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    {/* Seviye */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700">Seviye <span className="text-red-500">*</span></label>
                        <select
                            value={newInclusion.levelRestriction || ''}
                            onChange={(e) => setNewInclusion(c => ({ ...c, levelRestriction: e.target.value || null }))}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm"
                        >
                            <option value="">Seçiniz</option>
                            {initialData.levels.sort((a, b) => a.order - b.order).map(l => <option key={l.id} value={l.id}>{l.order}. {l.name}</option>)}
                        </select>
                    </div>
                    {/* Stil (Opsiyonel) */}
                    <div>
                        <label className="block text-xs font-medium text-gray-700">Stil (Ops.)</label>
                        <select
                            value={newInclusion.styleRestriction || ''}
                            disabled={!newInclusion.disciplineRestriction || filteredStyles.length === 0}
                            onChange={(e) => setNewInclusion(c => ({ ...c, styleRestriction: e.target.value || null }))}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm disabled:bg-gray-50"
                        >
                            <option value="">Tümü / Seçiniz</option>
                            {filteredStyles.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>
                
                <div className="mt-3 flex justify-between items-end">
                    {/* Alt Seviye Kapsaması Checkbox */}
                    <div className="flex items-center">
                        <input
                            id="includeLowerLevels"
                            type="checkbox"
                            checked={newInclusion.includeLowerLevels}
                            onChange={(e) => setNewInclusion(c => ({ ...c, includeLowerLevels: e.target.checked }))}
                            className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                        />
                        <label htmlFor="includeLowerLevels" className="ml-2 block text-sm text-gray-700">
                            Seçilen seviyenin altındaki seviyeleri de kapsa
                        </label>
                    </div>

                    <button
                        onClick={handleAddClassInclusion}
                        className="flex items-center py-2 px-3 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                        <PlusIcon className="h-4 w-4 mr-1" /> Kısıtlamayı Ekle
                    </button>
                </div>
            </div>
        </div>
    );
};

const ServiceInclusionForm: React.FC<StepProps> = ({ pkg, setPkg }) => {
    
    const [newService, setNewService] = useState<Omit<PackageServiceInclusion, 'id'>>({
        serviceName: '',
        benefitType: 'FREE',
        value: 1,
        description: '',
    });

    const handleAddService = () => {
         if (!newService.serviceName) {
            alert("Lütfen bir Hizmet Adı girin.");
            return;
        }

        const serviceToAdd: PackageServiceInclusion = {
            ...newService,
            id: generateTempId(),
        };

        setPkg(p => ({
            ...p,
            serviceInclusions: [...p.serviceInclusions, serviceToAdd]
        }));
        setNewService({ serviceName: '', benefitType: 'FREE', value: 1, description: '' });
    };

    const handleRemove = (id: string) => {
        setPkg(p => ({
            ...p,
            serviceInclusions: p.serviceInclusions.filter(item => item.id !== id)
        }));
    };

    return (
        <div className="space-y-4 pt-8">
             <h3 className="text-lg font-semibold text-teal-700 border-b pb-2">Ek Hizmet ve Faydalar</h3>
             
             {/* Mevcut Hizmetler Listesi */}
             {pkg.serviceInclusions.length > 0 && (
                <div className="space-y-3 p-3 bg-teal-50 rounded-md border border-teal-200">
                    <p className="text-sm font-medium text-teal-700">Tanımlanan Hizmetler:</p>
                    {pkg.serviceInclusions.map(item => (
                        <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded shadow-sm text-sm">
                            <div className="flex-1">
                                <span className="font-bold text-teal-600">{item.serviceName}</span>
                                <span className="text-gray-600 ml-3">
                                    {item.benefitType === 'FREE' ? 'Ücretsiz Dahil' : 
                                     item.benefitType === 'LIMITED_COUNT' ? `${item.value} Kullanım Hakkı` :
                                     `%${item.value} İndirimli`}
                                </span>
                            </div>
                            <button onClick={() => handleRemove(item.id)} className="text-red-500 hover:text-red-700 p-1">
                                <TrashIcon className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Yeni Hizmet Ekleme Formu */}
            <div className="p-4 border border-dashed border-gray-300 rounded-md bg-white">
                <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-700">Hizmet Adı</label>
                        <input
                            type="text"
                            value={newService.serviceName}
                            onChange={(e) => setNewService(s => ({ ...s, serviceName: e.target.value }))}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm"
                        />
                    </div>
                    <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-700">Fayda Tipi</label>
                        <select
                            value={newService.benefitType}
                            onChange={(e) => setNewService(s => ({ ...s, benefitType: e.target.value as PackageServiceInclusion['benefitType'] }))}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm"
                        >
                            <option value="FREE">Ücretsiz</option>
                            <option value="DISCOUNT_PERCENTAGE">% İndirim</option>
                            <option value="LIMITED_COUNT">Sınırlı Adet</option>
                        </select>
                    </div>
                     <div className="col-span-1">
                        <label className="block text-xs font-medium text-gray-700">Değer</label>
                        <input
                            type="number"
                            min="0"
                            value={newService.value}
                            disabled={newService.benefitType === 'FREE'}
                            onChange={(e) => setNewService(s => ({ ...s, value: parseInt(e.target.value) || 0 }))}
                            className="mt-1 block w-full rounded-md border border-gray-300 p-2 text-sm disabled:bg-gray-50"
                        />
                    </div>
                     <div className="col-span-1 flex items-end">
                        <button
                            onClick={handleAddService}
                            className="flex items-center justify-center w-full py-2 px-3 border border-transparent rounded-md shadow-sm text-xs font-medium text-white bg-teal-600 hover:bg-teal-700"
                        >
                            <PlusIcon className="h-4 w-4 mr-1" /> Hizmet Ekle
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Step3Inclusions: React.FC<StepProps> = (props) => (
    <div className="space-y-8">
        <h2 className="text-xl font-semibold text-gray-800">3. İçerik ve Kısıtlamalar</h2>
        <ClassInclusionForm {...props} />
        <ServiceInclusionForm {...props} />
    </div>
);

// --- ADIM 4: ÖDEME YÖNTEMLERİ VE YAYINLAMA ---

const Step4ReviewSave: React.FC<StepProps> = ({ pkg, setPkg }) => {
    
    // Ödeme yöntemlerini yönetme
    const togglePaymentMethod = (method: PackageType['allowedPaymentMethods'][number]) => {
        setPkg(p => {
            const methods = p.allowedPaymentMethods;
            if (methods.includes(method)) {
                return { ...p, allowedPaymentMethods: methods.filter(m => m !== method) };
            } else {
                return { ...p, allowedPaymentMethods: [...methods, method] };
            }
        });
    };

    // Ödeme Yöntemi Kartı
    const PaymentMethodCard = ({ method, label, icon: Icon }: { 
        method: PackageType['allowedPaymentMethods'][number], 
        label: string, 
        icon: React.ElementType 
    }) => {
        const isSelected = pkg.allowedPaymentMethods.includes(method);
        return (
             <div 
                onClick={() => togglePaymentMethod(method)}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition duration-200 ${
                    isSelected 
                        ? 'border-green-600 bg-green-50 shadow-md' 
                        : 'border-gray-200 hover:border-gray-400'
                }`}
            >
                <Icon className={`h-6 w-6 mr-3 ${isSelected ? 'text-green-600' : 'text-gray-500'}`} />
                <span className="font-medium text-sm text-gray-800">{label}</span>
                {isSelected && <CheckCircleIcon className="ml-auto h-5 w-5 text-green-600" />}
            </div>
        );
    };

    return (
        <div className="space-y-8">
            <h2 className="text-xl font-semibold text-gray-800">4. Ödeme Yöntemleri ve Yayınlama</h2>
            
            {/* Ödeme Yöntemleri */}
            <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-700">Kabul Edilen Ödeme Yöntemleri</h3>
                <p className="text-sm text-gray-600">Bu paket hangi yöntemlerle satın alınabilir?</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <PaymentMethodCard method="Cash" label="Nakit Ödeme" icon={BanknotesIcon} />
                    <PaymentMethodCard method="CreditCard" label="Kredi Kartı / POS" icon={CreditCardIcon} />
                    <PaymentMethodCard method="BankTransfer" label="Banka Transferi" icon={BanknotesIcon} /> 
                    {/* Taksitli ödeme (2. katman) şimdilik sadece kredi kartı içinde varsayılabilir */}
                </div>
            </div>

            {/* Yayınlama Durumu */}
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200 flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-700">Yayınlama Durumu</h3>
                    <p className="text-sm text-gray-600">Paket, satışa hazır olduğunda aktif olarak işaretlenmelidir.</p>
                </div>
                
                <div className="flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            checked={pkg.isActive} 
                            onChange={(e) => setPkg(p => ({ ...p, isActive: e.target.checked }))} 
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        <span className="ml-3 text-sm font-medium text-gray-900">
                            {pkg.isActive ? 'Aktif (Yayında)' : 'Pasif (Taslak)'}
                        </span>
                    </label>
                </div>
            </div>
        </div>
    );
};


// --- ANA SİHİRBAZ BİLEŞENİ ---

interface PackageWizardProps {
  initialPackage: PackageType;
  initialData: WizardInitialData;
}

export default function PackageWizard({ initialPackage, initialData }: PackageWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [packageData, setPackageData] = useState<PackageType>(initialPackage);

  const steps = [
    { id: 1, name: 'Temel Bilgiler', component: Step1BasicInfo },
    { id: 2, name: 'Kullanım Modeli', component: Step2UsageModel },
    { id: 3, name: 'İçerik ve Kısıtlamalar', component: Step3Inclusions },
    { id: 4, name: 'Ödeme ve Yayınlama', component: Step4ReviewSave },
  ];

  // TypeScript'in `initialData` prop'unu alt bileşenlere doğru şekilde geçirmek için
  const StepComponent = steps.find(s => s.id === currentStep)?.component;
  const CurrentStepComponent = StepComponent 
    ? (props: any) => <StepComponent {...props} initialData={initialData} /> 
    : () => null;


  // --- Doğrulama (Validation) Fonksiyonu ---
  const validateStep = (step: number, data: PackageType): boolean => {
    if (step === 1) {
      if (!data.name || data.price <= 0) {
        alert('Lütfen Paket Adını girin ve Fiyatı 0\'dan büyük yapın.');
        return false;
      }
    }
    if (step === 2) {
      if (data.usage.model === 'CLASS_BASED') {
        if (!data.usage.totalCredits || data.usage.totalCredits <= 0) {
            alert('Kontör bazlı paket için toplam ders hakkı 0\'dan büyük olmalıdır.');
            return false;
        }
      } else if (data.usage.model === 'TIME_BASED') {
        if (!data.usage.durationValue || data.usage.durationValue <= 0) {
            alert('Süreli paket için geçerlilik süresi belirtilmelidir.');
            return false;
        }
      }
    }
    if (step === 3) {
      if (data.classInclusions.length === 0 && data.serviceInclusions.length === 0) {
        alert('Pakete en az bir Ders Hakkı Kısıtlaması veya Ek Hizmet eklenmelidir.');
        return false;
      }
    }
     if (step === 4) {
        if (data.allowedPaymentMethods.length === 0) {
             alert('Lütfen en az bir kabul edilen ödeme yöntemi seçin.');
             return false;
        }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep, packageData)) {
        if (currentStep < steps.length) {
          setCurrentStep(currentStep + 1);
        }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    // Son adım doğrulaması
    if (validateStep(steps.length, packageData)) {
      console.log('Paket verisi gönderiliyor:', packageData);
      // API Call: packageData'yı backend'e gönder
      alert(`Paket Başarıyla Kaydedildi! Adı: ${packageData.name}`);
      // Başarılı kayıttan sonra listeleme sayfasına yönlendirme yapılabilir.
    }
  };

  return (
    <div className="bg-white shadow-xl rounded-xl p-8 max-w-4xl mx-auto">
      
      {/* İlerleme Çubuğu */}
      <div className="mb-8">
        <nav aria-label="Progress">
          <ol role="list" className="flex items-center justify-between">
            {steps.map((step, index) => (
              <li key={step.name} className={`relative flex-1 ${index !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className={`h-0.5 w-full ${step.id <= currentStep ? 'bg-indigo-600' : 'bg-gray-200'}`} />
                </div>
                <div className="relative flex flex-col items-center">
                    <div 
                        className={`w-8 h-8 flex items-center justify-center rounded-full border-2 ${
                            step.id === currentStep ? 'border-indigo-600 bg-white' : 
                            step.id < currentStep ? 'bg-indigo-600 border-indigo-600' : 
                            'border-gray-300 bg-white'
                        }`}
                    >
                        <span className={`text-sm font-medium ${step.id === currentStep ? 'text-indigo-600' : step.id < currentStep ? 'text-white' : 'text-gray-500'}`}>
                            {step.id}
                        </span>
                    </div>
                    <p className={`mt-2 text-sm text-center ${step.id === currentStep ? 'font-medium text-indigo-600' : 'text-gray-500'}`}>{step.name}</p>
                </div>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Adım İçeriği */}
      <div className="min-h-[350px] border-t pt-6">
        <CurrentStepComponent pkg={packageData} setPkg={setPackageData} />
      </div>

      {/* Navigasyon Butonları */}
      <div className="mt-8 pt-4 border-t flex justify-between">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className={`py-2 px-4 border rounded-md shadow-sm text-sm font-medium transition duration-150 ${
            currentStep === 1 
              ? 'text-gray-400 bg-gray-100 cursor-not-allowed' 
              : 'text-gray-700 bg-white hover:bg-gray-50'
          }`}
        >
          &larr; Geri
        </button>

        {currentStep < steps.length ? (
          <button
            onClick={handleNext}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150"
          >
            İleri &rarr;
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            className="py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150"
          >
            Paketi Kaydet ve Yayınla
          </button>
        )}
      </div>
    </div>
  );
}