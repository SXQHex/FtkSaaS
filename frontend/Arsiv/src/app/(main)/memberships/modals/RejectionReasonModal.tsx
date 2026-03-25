// src/app/memberships/modals/RejectionReasonModal.tsx (TİP ÇAKIŞMASI DÜZELTİLMİŞ NİHAİ SÜRÜM)
"use client";

import React, { FC, useState, useEffect, useCallback } from 'react';
import BaseModal from '@/components/modals/BaseModal';
import { RequestData } from '@/types/memberships'; // MERKEZİ TİP KORUNDU
import { 
    XCircleIcon, PaperAirplaneIcon, ArrowPathIcon, ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

// --------------------------------------------------------------------------------
// ⚠️ DÜZELTME: Yerel interface RequestData tanımı kaldırıldı.
// --------------------------------------------------------------------------------

interface RejectionReasonModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: RequestData | null; 
    onReject: (requestId: string, reason: string) => Promise<void>; 
    isProcessing: boolean; 
}

const RejectionReasonModal: FC<RejectionReasonModalProps> = ({ isOpen, onClose, request, onReject, isProcessing }) => {
    
    const MIN_REASON_LENGTH = 10;
    const [reason, setReason] = useState('');
    const [localError, setLocalError] = useState<string | null>(null); 
    
    useEffect(() => {
        if (isOpen) {
            setReason('');
            setLocalError(null);
        }
    }, [isOpen]);

    const handleRejectSubmit = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        
        setLocalError(null);
        const trimmedReason = reason.trim();

        if (!request) {
            setLocalError("Reddedilecek talep bilgisi bulunamadı.");
            return;
        }

        if (trimmedReason.length < MIN_REASON_LENGTH) {
            setLocalError(`Reddetme nedeni en az ${MIN_REASON_LENGTH} karakter olmalıdır.`);
            return;
        }
        
        if (isProcessing) return; 
        
        try {
            await onReject(request.id, trimmedReason);
        } catch (error) {
            const errorMessage = (error as Error).message || "Reddetme işlemi sırasında beklenmedik bir hata oluştu.";
            setLocalError(errorMessage);
            console.error("Reddetme hatası:", error);
        }
    }, [reason, isProcessing, onReject, request]);
    
    if (!request) return null;

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Talebi Reddetme Nedeni"
            maxWidth="lg" 
        >
            <div className="p-1">
                <div className="p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-lg mb-6">
                    <p className="font-semibold flex items-center mb-1">
                        <ExclamationTriangleIcon className="w-5 h-5 mr-2" /> İşlem Onayı
                    </p>
                    <p className="text-sm">
                        <span className="font-medium text-gray-900">{request.member_name}</span> adlı üyenin
                        <span className="font-bold text-red-800 ml-1">{request.package_name}</span> paket talebini **kesin** olarak reddediyorsunuz.
                    </p>
                </div>

                <form onSubmit={handleRejectSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="rejectionReason" className="block text-sm font-medium text-gray-700">
                            Reddetme Nedeni <span className="text-red-500">*</span> (Min. {MIN_REASON_LENGTH} karakter)
                        </label>
                        <textarea
                            id="rejectionReason"
                            rows={5}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            // Metin rengi düzeltmesi korunmuştur.
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm focus:ring-red-500 focus:border-red-500 sm:text-sm p-3 disabled:bg-gray-50 transition text-gray-900" 
                            placeholder="Reddetme nedenini açıkça belirtiniz (örn: Ödeme eksikliği, yanlış paket seçimi, vb.)"
                            required
                            disabled={isProcessing}
                        />
                        {localError && (
                            <p className="mt-2 text-sm text-red-600 flex items-center">
                                <XCircleIcon className="w-4 h-4 mr-1"/> {localError}
                            </p>
                        )}
                         <p className={`mt-1 text-xs ${reason.length < MIN_REASON_LENGTH ? 'text-red-500' : 'text-gray-500'}`}>
                            {reason.length}/{MIN_REASON_LENGTH} karakter.
                        </p>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-4 border-t">
                         <button
                            type="button"
                            onClick={onClose}
                            disabled={isProcessing}
                            className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-100 disabled:opacity-50 transition"
                        >
                            İptal
                        </button>
                        <button
                            type="submit"
                            disabled={isProcessing || reason.trim().length < MIN_REASON_LENGTH}
                            className="inline-flex items-center justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 transition"
                        >
                            {isProcessing ? (
                                <>
                                    <ArrowPathIcon className="w-5 h-5 mr-2 animate-spin" /> Reddediliyor...
                                </>
                            ) : (
                                <>
                                    <PaperAirplaneIcon className="w-5 h-5 mr-2 -rotate-45" /> Reddet ve Bildir
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </BaseModal>
    );
};

export default RejectionReasonModal;