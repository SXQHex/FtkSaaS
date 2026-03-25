// src/app/memberships/modals/RequestManagementModal.tsx (GELİŞTİRİLMİŞ SÜRÜM)
import React, { FC } from 'react';
import BaseModal from '@/components/modals/BaseModal'; 
import { XCircleIcon, CheckCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { RequestData } from '@/types/memberships'; // Merkezi tip kullanıldı

interface RequestManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    requests: RequestData[];
    onApprove: (requestId: string) => void;
    onRejectStart: (request: RequestData) => void;
    isProcessing: boolean; // Yeni eklendi
}

const RequestManagementModal: FC<RequestManagementModalProps> = ({ isOpen, onClose, requests, onApprove, onRejectStart, isProcessing }) => {
    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title="Bekleyen Üyelik İstekleri"
            maxWidth="xl" 
        >
            {isProcessing && (
                <div className="flex items-center justify-center p-3 bg-indigo-100 text-indigo-700 text-sm font-medium rounded-t-lg">
                    <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                    İstekler İşleniyor... Lütfen bekleyiniz.
                </div>
            )}
            
            {requests.length === 0 ? (
                <div className="text-center p-6 text-gray-500">
                    Şu anda bekleyen üyelik isteği bulunmamaktadır.
                </div>
            ) : (
                 <div className="max-h-96 overflow-y-auto pr-2">
                     <ul role="list" className="divide-y divide-gray-200">
                        {requests.map((request: RequestData) => (
                            <li key={request.id} className="py-3 flex items-center justify-between hover:bg-gray-50 px-2 rounded-lg transition-colors">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900">{request.member_name}</p>
                                    <p className="text-md font-bold text-indigo-600 truncate">{request.package_name}</p>
                                    <p className="text-xs text-gray-400 mt-1">İstek Tarihi: {request.requested_date}</p>
                                </div>
                                
                                {/* BUTONLAR */}
                                <div className="ml-4 shrink-0 space-x-2 flex">
                                    <button
                                        onClick={() => onApprove(request.id)}
                                        disabled={isProcessing}
                                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
                                    >
                                        <CheckCircleIcon className="w-4 h-4 mr-1" /> Onayla
                                    </button>
                                    <button
                                        onClick={() => onRejectStart(request)}
                                        disabled={isProcessing}
                                        className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
                                    >
                                        <XCircleIcon className="w-4 h-4 mr-1" /> Reddet
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </BaseModal>
    );
};

export default RequestManagementModal;