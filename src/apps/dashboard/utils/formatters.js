/**
 * Dashboard Formatting Utilities
 * 
 * 공통적으로 사용되는 포맷팅 함수들을 모아둔 파일입니다.
 */

export function formatMinutes(ms) {
    if (!Number.isFinite(ms)) return '-';
    const minutes = Math.round(ms / 60000);
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const rem = minutes % 60;
        return `${hours}h ${String(rem).padStart(2, '0')}m`;
    }
    return `${minutes}m`;
}

export function formatPercent(ratio) {
    return Number.isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : '-';
}

export function formatValue(value) {
    return Number.isFinite(value) ? value.toFixed(1) : '-';
}

export function formatHour(hour) {
    return Number.isFinite(hour) ? `${hour}h` : '-';
}

export function formatCount(value) {
    return Number.isFinite(value) ? String(Math.round(value)) : '-';
}

export function formatDays(value) {
    return Number.isFinite(value) ? `${value}d` : '-';
}

export function formatRange(startDateStr, startHour, endDateStr, endHour) {
    if (!startDateStr || !endDateStr) return '-';
    if (!Number.isFinite(startHour) || !Number.isFinite(endHour)) return '-';
    return `${startDateStr} ${startHour}h -> ${endDateStr} ${endHour}h`;
}

export function formatWindowRange(window) {
    if (!window) return '-';
    return formatRange(
        window.startDateStr,
        window.startHour,
        window.endDateStr,
        window.endHour,
    );
}

export function getScoreStatus(value) {
    if (!Number.isFinite(value)) return 'neutral';
    if (value >= 90) return 'good';
    if (value >= 70) return 'ok';
    if (value >= 50) return 'mid';
    return 'bad';
}
