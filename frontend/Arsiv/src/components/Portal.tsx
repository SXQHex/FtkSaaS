// /src/components/Portal.tsx
import { useState, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
    children: ReactNode;
    wrapperId?: string;
}

function createWrapperAndAppendToBody(wrapperId: string) {
    const wrapperElement = document.createElement('div');
    wrapperElement.setAttribute("id", wrapperId);
    document.body.appendChild(wrapperElement);
    return wrapperElement;
}

const Portal: React.FC<PortalProps> = ({ children, wrapperId = 'portal-wrapper' }) => {
    
    const [wrapperElement, setWrapperElement] = useState<HTMLElement | null>(null);

    useEffect(() => {
        let element = document.getElementById(wrapperId);
        // Wrapper yoksa oluştur ve body'ye ekle
        if (!element) {
            element = createWrapperAndAppendToBody(wrapperId);
        }
        setWrapperElement(element);
        
        // Temizleme fonksiyonu: Bileşen kaldırıldığında wrapper'ı DOM'dan sil
        return () => {
            if (element && element.parentNode === document.body) {
                 // Sadece bileşen kaldırıldığında DOM'dan silmek genellikle gereksizdir, 
                 // bu yüzden silme işlemini yoruma alıyoruz.
                 // document.body.removeChild(element);
            }
        };
    }, [wrapperId]);

    // wrapperElement henüz hazır değilse null döndür
    if (wrapperElement === null) return null;

    // React Portal ile içeriği doğrudan body'nin altındaki wrappera render et
    return createPortal(children, wrapperElement);
};

export default Portal;