// src/components/modals/BaseModal.tsx
import React, { FC, ReactNode } from 'react';
import { XCircleIcon } from '@heroicons/react/24/outline';
import Portal from '@/components/Portal'; // Portal'ı BaseModal'a eklediyseniz, bu import'u koruyun.

const maxWidthClasses = {
    'sm': 'sm:max-w-sm', 'md': 'sm:max-w-md', 'lg': 'sm:max-w-lg', 'xl': 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl', '3xl': 'sm:max-w-3xl', '4xl': 'sm:max-w-4xl',
};

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    maxWidth?: keyof typeof maxWidthClasses; 
}

const BaseModal: FC<BaseModalProps> = ({ isOpen, onClose, title, children, maxWidth = 'sm' }) => {
    if (!isOpen) return null;
    const widthClass = maxWidthClasses[maxWidth] || maxWidthClasses['sm'];

    const modalContent = (
        // Ana Kapsayıcı: Yüksek Z-index ve Tam Ekran Sabitleme
        <div 
            className="fixed inset-0 z-50 backdrop-blur-xs bg-black/75 transition-opacity duration-300" 
            aria-labelledby="modal-title" 
            role="dialog" 
            aria-modal="true"
            onClick={onClose} // Gölgeliğe tıklayınca kapanma
        >
            
            {/* Ortalamayı ve Kaydırmayı Sağlayan İç Taşıyıcı */}
            <div 
                className="flex items-center justify-center min-h-screen p-4 overflow-y-auto"
                onClick={(e) => e.stopPropagation()} // Modal kutusuna tıklamayı engelle
            >
                
                {/* Modal Kutusu */}
                <div className={`inline-block align-bottom bg-white rounded-3xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle ${widthClass} sm:w-full`}>
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="flex justify-between items-start border-b pb-2 mb-4">
                            <h3 className="text-xl leading-6 font-bold text-gray-900" id="modal-title">
                                {title}
                            </h3>
                            {/* Kapatma Butonu */}
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                                <XCircleIcon className="h-7 w-7" />
                            </button>
                        </div>
                        <div className="mt-4">
                            {children}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
    
    return <Portal wrapperId="modal-root">{modalContent}</Portal>; // Eğer Portal kullanıyorsanız
    return modalContent; // Eğer BaseModal'ı doğrudan kullanıyorsanız
};

export default BaseModal;