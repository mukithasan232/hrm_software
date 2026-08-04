import { differenceInMinutes } from 'date-fns';

// Helper to format minutes into "Xh Ym"
export function formatMinutes(minutes: number | null | undefined): string {
    if (!minutes || minutes <= 0) return '0h 0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
}

// Robust duration string generator that strictly handles time boundaries
export function calculateDurationString(checkInDate: Date | string | number | null | undefined, checkOutDate: Date | string | number | null | undefined): string {
    if (!checkOutDate || !checkInDate) return "0h 0m";
    const inDate = new Date(checkInDate);
    const outDate = new Date(checkOutDate);
    
    // Check if dates are valid
    if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return "0h 0m";

    const diffInMinutes = differenceInMinutes(outDate, inDate);
    if (diffInMinutes < 0) return "0h 0m"; // Failsafe for invalid chronological order
    
    const hours = Math.floor(diffInMinutes / 60);
    const minutes = diffInMinutes % 60;
    return `${hours}h ${minutes}m`;
}
