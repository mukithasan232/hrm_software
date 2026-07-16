
// Helper to format minutes into "Xh Ym"
export function formatMinutes(minutes: number) {
    if (!minutes) return '0h 0m';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
}
