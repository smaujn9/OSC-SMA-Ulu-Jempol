/**
 * Utility functions for date parsing and reverse-chronological sorting (latest date on top)
 */

export function parseDateToMs(dateInput?: string | number | Date | null): number {
  if (!dateInput) return 0;
  if (typeof dateInput === 'number') return dateInput;
  if (dateInput instanceof Date) return dateInput.getTime();

  const str = String(dateInput).trim();
  if (!str) return 0;

  // Relative time checks (e.g. "2 jam yang lalu", "Terkini")
  if (str.toLowerCase().includes('terkini')) {
    return Date.now();
  }
  if (str.toLowerCase().includes('jam yang lalu') || str.toLowerCase().includes('minit yang lalu')) {
    const num = parseInt(str, 10) || 1;
    if (str.toLowerCase().includes('jam')) {
      return Date.now() - num * 3600 * 1000;
    }
    return Date.now() - num * 60 * 1000;
  }
  if (str.toLowerCase().includes('hari yang lalu')) {
    const num = parseInt(str, 10) || 1;
    return Date.now() - num * 86400 * 1000;
  }

  // Handle ISO or YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) return parsed;
  }

  // Handle DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    const year = parseInt(slashMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  // Handle YYYY/MM/DD
  const yearSlashMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (yearSlashMatch) {
    const year = parseInt(yearSlashMatch[1], 10);
    const month = parseInt(yearSlashMatch[2], 10) - 1;
    const day = parseInt(yearSlashMatch[3], 10);
    return new Date(year, month, day).getTime();
  }

  // Handle Malay & English date strings like "15 Jun 2024", "Sabtu, 15 Jun 2024", "1 Julai 2024", "28 September 2026"
  const monthMap: Record<string, number> = {
    jan: 0, januari: 0, january: 0,
    feb: 1, februari: 1, february: 1,
    mac: 2, march: 2,
    apr: 3, april: 3,
    mei: 4, may: 4,
    jun: 5, june: 5,
    jul: 6, julai: 6, july: 6,
    ogos: 7, ogs: 7, aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    okt: 9, oktober: 9, oct: 9, october: 9,
    nov: 10, november: 10,
    dis: 11, disember: 11, dec: 11, december: 11
  };

  const allMalayMatches = Array.from(str.matchAll(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/g));
  if (allMalayMatches.length > 0) {
    // Take the last date match in the string (e.g. end date of a date range like "9 Julai 2026 sehingga 12 Julai 2026")
    const lastMatch = allMalayMatches[allMalayMatches.length - 1];
    const day = parseInt(lastMatch[1], 10);
    const mName = lastMatch[2].toLowerCase();
    const year = parseInt(lastMatch[3], 10);
    const monthIdx = monthMap[mName] ?? 0;
    return new Date(year, monthIdx, day).getTime();
  }

  // Fallback to standard Date.parse
  const directParse = Date.parse(str);
  if (!isNaN(directParse)) {
    return directParse;
  }

  return 0;
}

/**
 * Sorts any list of objects descending by date so that the latest date is always at the top.
 */
export function sortByLatestDate<T>(
  items: T[], 
  getDateVal: (item: T) => string | number | Date | undefined | null
): T[] {
  return [...items].sort((a, b) => {
    const dateA = parseDateToMs(getDateVal(a));
    const dateB = parseDateToMs(getDateVal(b));
    return dateB - dateA;
  });
}

/**
 * Determines whether an event is in the future or ongoing today (Upcoming).
 * Events whose end date or date is in the past will return false.
 */
export function isEventUpcoming(event?: { rawDate?: string; rawEndDate?: string; date?: string } | null): boolean {
  if (!event) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  // If rawEndDate is provided (YYYY-MM-DD or parseable)
  if (event.rawEndDate) {
    const endMs = parseDateToMs(event.rawEndDate);
    if (endMs > 0) {
      const d = new Date(endMs);
      d.setHours(23, 59, 59, 999);
      return d.getTime() >= todayMs;
    }
  }

  // If rawDate is provided (YYYY-MM-DD)
  if (event.rawDate) {
    const startMs = parseDateToMs(event.rawDate);
    if (startMs > 0) {
      const d = new Date(startMs);
      d.setHours(23, 59, 59, 999);
      return d.getTime() >= todayMs;
    }
  }

  // Fallback to event.date (e.g. "Sabtu, 15 Jun 2024", "15 Jun 2024")
  if (event.date) {
    const parsedMs = parseDateToMs(event.date);
    if (parsedMs > 0) {
      const d = new Date(parsedMs);
      d.setHours(23, 59, 59, 999);
      return d.getTime() >= todayMs;
    }
  }

  // If no parseable date is found, do not treat as upcoming
  return false;
}

/**
 * Filters and sorts upcoming events chronologically ascending (earliest/closest upcoming first).
 */
export function getUpcomingEvents<T extends { rawDate?: string; rawEndDate?: string; date?: string }>(events: T[]): T[] {
  if (!Array.isArray(events)) return [];
  return events
    .filter(isEventUpcoming)
    .sort((a, b) => {
      const msA = parseDateToMs(a.rawDate || a.date);
      const msB = parseDateToMs(b.rawDate || b.date);
      return msA - msB;
    });
}

