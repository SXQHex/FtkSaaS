// src/components/ui/StatusBadge.tsx
import { CourseStatus } from '@/types/courses'; // Status tipini import edin

interface StatusBadgeProps {
    status: CourseStatus;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
    let colorClass: string;

    switch (status) {
        case 'Active':
            colorClass = 'bg-green-100 text-green-800';
            break;
        case 'Planned':
            colorClass = 'bg-blue-100 text-blue-800';
            break;
        case 'Completed':
            colorClass = 'bg-purple-100 text-purple-800';
            break;
        case 'Cancelled':
            colorClass = 'bg-red-100 text-red-800';
            break;
        default:
            colorClass = 'bg-gray-100 text-gray-800';
    }

    return (
        <span 
            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${colorClass}`}
        >
            {status}
        </span>
    );
}