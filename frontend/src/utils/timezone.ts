/**
 * Timezone Utility Functions
 * Converts UTC timestamps to user's local timezone
 */

/**
 * Get user's timezone from preferences or browser default
 */
export const getUserTimezone = async (): Promise<string> => {
    try {
        const { getUserPreferences } = await import('../services/api');
        const prefs = await getUserPreferences();
        return (prefs as any).timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
        console.error('Failed to get user timezone:', error);
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }
};

/**
 * Format timestamp with user's timezone
 * @param timestamp - ISO timestamp string or Date object
 * @param timezone - User's timezone (defaults to UTC)
 * @param options - Intl.DateTimeFormat options
 */
export const formatTimestamp = (
    timestamp: string | Date | null | undefined,
    timezone?: string,
    options?: Intl.DateTimeFormatOptions
): string => {
    if (!timestamp) return '-';
    
    try {
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
        
        const defaultOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZone: timezone || 'UTC',
            hour12: false
        };
        
        return new Intl.DateTimeFormat('de-DE', { ...defaultOptions, ...options }).format(date);
    } catch (error) {
        console.error('Failed to format timestamp:', error);
        return String(timestamp);
    }
};

/**
 * Format timestamp for agent logs (HH:mm:ss)
 */
export const formatLogTimestamp = (timestamp: string | Date, timezone?: string): string => {
    return formatTimestamp(timestamp, timezone, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
};

/**
 * Format date only (DD.MM.YYYY)
 */
export const formatDate = (timestamp: string | Date, timezone?: string): string => {
    return formatTimestamp(timestamp, timezone, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
};

/**
 * React Hook for timezone-aware formatting
 */
export const useTimezone = () => {
    const [timezone, setTimezone] = React.useState<string>('UTC');
    
    React.useEffect(() => {
        getUserTimezone().then(setTimezone);
    }, []);
    
    return {
        timezone,
        formatTimestamp: (ts: string | Date, opts?: Intl.DateTimeFormatOptions) => 
            formatTimestamp(ts, timezone, opts),
        formatLogTimestamp: (ts: string | Date) => 
            formatLogTimestamp(ts, timezone),
        formatDate: (ts: string | Date) => 
            formatDate(ts, timezone)
    };
};

// Re-export React for the hook
import React from 'react';
