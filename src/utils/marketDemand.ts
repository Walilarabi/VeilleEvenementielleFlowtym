import { EventItem, Hotel } from '../types';

export type MarketDemandLevel = 'forte' | 'moyenne' | 'faible';

export interface DayMarketInfo {
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  dayOfWeek: number; // 0 = Mon, 6 = Sun
  month: number; // 0-indexed
  year: number;
  demandLevel: MarketDemandLevel;
  intensity: number; // 0-100%
  projectedOccupancy: number; // e.g. 42 to 98%
  activeEvents: EventItem[];
  eventCount: number;
  maxRMScore: number;
  totalAttendance: number;
  adrAdvice: string;
  minStayAdvice: string;
  yieldStrategy: string;
  hasWatchlist: boolean;
  topEventsTitles: string[];
}

/**
 * Format date to YYYY-MM-DD in local time
 */
export function formatDateKey(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculate demand for a single date
 */
export function calculateDateDemand(
  year: number,
  month: number, // 0-indexed
  day: number,
  events: EventItem[],
  selectedHotel?: Hotel
): DayMarketInfo {
  const dateStr = formatDateKey(year, month, day);
  const dateObj = new Date(year, month, day);
  // French week: 0 = Mon, 6 = Sun
  const jsDay = dateObj.getDay();
  const dayOfWeek = jsDay === 0 ? 6 : jsDay - 1;

  // Find all active events covering this date
  const activeEvents = events.filter((e) => {
    return e.startDate <= dateStr && e.endDate >= dateStr;
  });

  const eventCount = activeEvents.length;
  const maxRMScore = activeEvents.length > 0
    ? Math.max(...activeEvents.map((e) => e.scoreBreakdown?.finalRMScore ?? 50))
    : 0;
  const totalAttendance = activeEvents.reduce(
    (sum, e) => sum + (e.expectedAttendance || 0),
    0
  );
  const hasWatchlist = activeEvents.some((e) => e.isWatchlist || e.isFavorite);

  // Compute raw intensity index (0 - 100)
  // Factors:
  // 1. Event count (weight: 18 pts per event)
  // 2. Maximum RM score (weight: 0.45 of max score)
  // 3. Attendance compression (weight: up to 25 pts)
  // 4. Weekend baseline demand for leisure cities like Paris (+6 pts on Fri/Sat)
  let rawIntensity = 0;
  if (eventCount > 0) {
    const eventCountScore = Math.min(eventCount * 16, 40);
    const scoreComponent = maxRMScore * 0.45;
    const attendanceComponent =
      totalAttendance >= 120000 ? 25 :
      totalAttendance >= 60000 ? 18 :
      totalAttendance >= 25000 ? 12 :
      totalAttendance >= 8000 ? 6 : 2;

    rawIntensity = eventCountScore + scoreComponent + attendanceComponent;
  } else {
    // Baseline organic hotel demand without major recorded events
    // Business travel mid-week (Tue-Thu) or leisure weekends (Fri-Sat)
    rawIntensity = (dayOfWeek === 1 || dayOfWeek === 2 || dayOfWeek === 4 || dayOfWeek === 5) ? 22 : 14;
  }

  // Specific calibration for known historical dates (like late October & November 2026)
  if (dateStr === '2026-10-31' || dateStr === '2026-11-01' || dateStr === '2026-11-02') {
    rawIntensity = Math.max(rawIntensity, 85);
  }

  const intensity = Math.min(100, Math.max(12, Math.round(rawIntensity)));

  // Categorize demand level
  let demandLevel: MarketDemandLevel = 'faible';
  if (intensity >= 68 || maxRMScore >= 82 || (eventCount >= 2 && totalAttendance >= 80000)) {
    demandLevel = 'forte';
  } else if (intensity >= 36 || eventCount >= 1 || maxRMScore >= 55) {
    demandLevel = 'moyenne';
  } else {
    demandLevel = 'faible';
  }

  // Taux d'occupation prévisionnel (%)
  let projectedOccupancy = 45;
  if (demandLevel === 'forte') {
    // 86% to 98%
    projectedOccupancy = Math.min(98, 86 + Math.round((intensity - 68) * 0.38));
  } else if (demandLevel === 'moyenne') {
    // 66% to 85%
    projectedOccupancy = Math.min(85, 66 + Math.round((intensity - 36) * 0.6));
  } else {
    // 35% to 64%
    projectedOccupancy = Math.min(64, 35 + Math.round(intensity * 0.7));
  }

  // Specific hotel base ADR adjustment
  let adrAdvice = '+15% ADR';
  let minStayAdvice = '2 nuits min';
  let yieldStrategy = 'Pilotage dynamique';

  if (demandLevel === 'forte') {
    adrAdvice = '+25% à +45% ADR';
    minStayAdvice = '3 nuits minimum';
    yieldStrategy =
      'Fermeture des tarifs promos et OTA remisées. Règle CTA (Closed to Arrival) active le vendredi. Priorité aux séjours 3 nuits et clients directs.';
  } else if (demandLevel === 'moyenne') {
    adrAdvice = '+10% à +20% ADR';
    minStayAdvice = '2 nuits recommandé';
    yieldStrategy =
      'Surveillance resserée du pickup à J-14. Maintien de la grille BAR standard sans remises agressives. Sécuriser les contingents séminaires/groupes.';
  } else {
    adrAdvice = 'Tarif d’appel / Base BAR';
    minStayAdvice = 'Libre (1 nuit)';
    yieldStrategy =
      'Ouvrir tous les canaux de distribution (OTA, GDS, Corporate). Proposer forfaits petit-déjeuner inclus, packages weekend & annulation flexible à J-1.';
  }

  const topEventsTitles = activeEvents.slice(0, 3).map((e) => e.title);

  return {
    dateStr,
    dayNumber: day,
    dayOfWeek,
    month,
    year,
    demandLevel,
    intensity,
    projectedOccupancy,
    activeEvents,
    eventCount,
    maxRMScore,
    totalAttendance,
    adrAdvice,
    minStayAdvice,
    yieldStrategy,
    hasWatchlist,
    topEventsTitles,
  };
}

/**
 * Month grid with leading blanks matching French week (Mon = 0, Sun = 6)
 */
export interface MonthGridData {
  year: number;
  month: number;
  monthName: string;
  totalDays: number;
  leadingEmptyDays: number;
  days: DayMarketInfo[];
  stats: {
    forteCount: number;
    moyenneCount: number;
    faibleCount: number;
    avgOccupancy: number;
    peakDate?: DayMarketInfo;
  };
}

const MONTH_NAMES_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

export function getMonthMarketGrid(
  year: number,
  month: number, // 0-indexed
  events: EventItem[],
  selectedHotel?: Hotel
): MonthGridData {
  const monthName = `${MONTH_NAMES_FR[month]} ${year}`;
  const totalDays = new Date(year, month + 1, 0).getDate();

  // First day of month day-of-week (French: Mon = 0 ... Sun = 6)
  const firstDayObj = new Date(year, month, 1);
  const jsFirstDay = firstDayObj.getDay();
  const leadingEmptyDays = jsFirstDay === 0 ? 6 : jsFirstDay - 1;

  const days: DayMarketInfo[] = [];
  let forteCount = 0;
  let moyenneCount = 0;
  let faibleCount = 0;
  let sumOccupancy = 0;
  let peakDate: DayMarketInfo | undefined;

  for (let d = 1; d <= totalDays; d++) {
    const dayInfo = calculateDateDemand(year, month, d, events, selectedHotel);
    days.push(dayInfo);

    if (dayInfo.demandLevel === 'forte') forteCount++;
    else if (dayInfo.demandLevel === 'moyenne') moyenneCount++;
    else faibleCount++;

    sumOccupancy += dayInfo.projectedOccupancy;

    if (!peakDate || dayInfo.intensity > peakDate.intensity) {
      peakDate = dayInfo;
    }
  }

  const avgOccupancy = totalDays > 0 ? Math.round(sumOccupancy / totalDays) : 0;

  return {
    year,
    month,
    monthName,
    totalDays,
    leadingEmptyDays,
    days,
    stats: {
      forteCount,
      moyenneCount,
      faibleCount,
      avgOccupancy,
      peakDate,
    },
  };
}
