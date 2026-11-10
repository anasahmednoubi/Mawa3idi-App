import {
  Appointment,
  OccurrenceInstance,
  RECURRENCE_LABELS,
  RecurrenceRule,
} from '../types/schedule';

/** Parse YYYY-MM-DD into local Date at midnight (no UTC shift) */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0);
}

/** Format local Date into YYYY-MM-DD */
export function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayStr(): string {
  return formatLocalDate(new Date());
}

export function addDays(dateStr: string, days: number): string {
  const dt = parseLocalDate(dateStr);
  dt.setDate(dt.getDate() + days);
  return formatLocalDate(dt);
}

export function addMonths(dateStr: string, months: number): string {
  const dt = parseLocalDate(dateStr);
  dt.setMonth(dt.getMonth() + months);
  return formatLocalDate(dt);
}

export function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function minutesToTime(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.round(totalMinutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatTime12Or24(timeStr: string, use24h = false): string {
  if (use24h) return timeStr;
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatDurationAr(startTime: string, endTime: string): string {
  const diff = Math.max(0, timeToMinutes(endTime) - timeToMinutes(startTime));
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0 && mins > 0) return `${hours} س ${mins} د`;
  if (hours > 0) return hours === 1 ? 'ساعة واحدة' : hours === 2 ? 'ساعتان' : `${hours} ساعات`;
  return `${mins} دقيقة`;
}

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

const ARABIC_WEEKDAYS = [
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

const ARABIC_WEEKDAYS_SHORT = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export function formatArabicDateFull(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  const weekday = ARABIC_WEEKDAYS[dt.getDay()];
  const day = dt.getDate();
  const month = ARABIC_MONTHS[dt.getMonth()];
  const year = dt.getFullYear();
  return `${weekday}، ${day} ${month} ${year}`;
}

export function formatArabicDateShort(dateStr: string): string {
  const dt = parseLocalDate(dateStr);
  return `${dt.getDate()} ${ARABIC_MONTHS[dt.getMonth()]} ${dt.getFullYear()}`;
}

export function formatArabicMonthYear(year: number, monthZeroIndexed: number): string {
  return `${ARABIC_MONTHS[monthZeroIndexed]} ${year}`;
}

export function getWeekdayName(dateStr: string): string {
  return ARABIC_WEEKDAYS[parseLocalDate(dateStr).getDay()];
}

export function getWeekdayShort(dayIndex: number): string {
  return ARABIC_WEEKDAYS_SHORT[dayIndex % 7];
}

/**
 * Returns 7 YYYY-MM-DD strings starting from Saturday (Arabic standard week start)
 * containing `anchorDateStr`.
 */
export function getWeekDates(anchorDateStr: string): string[] {
  const dt = parseLocalDate(anchorDateStr);
  const dayOfWeek = dt.getDay(); // 0=Sun..6=Sat
  // Distance back to Saturday (6)
  const diffToSaturday = (dayOfWeek + 1) % 7;
  const start = new Date(dt);
  start.setDate(dt.getDate() - diffToSaturday);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return formatLocalDate(d);
  });
}

/**
 * Returns 42 cells (6 weeks x 7 days, Saturday-first) for a given month grid.
 */
export function getMonthGridDates(year: number, monthZeroIndexed: number): { dateStr: string; inMonth: boolean }[] {
  const firstOfMonth = new Date(year, monthZeroIndexed, 1);
  const firstDayOfWeek = firstOfMonth.getDay();
  const diffToSaturday = (firstDayOfWeek + 1) % 7;
  const gridStart = new Date(year, monthZeroIndexed, 1 - diffToSaturday);

  const cells: { dateStr: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({
      dateStr: formatLocalDate(d),
      inMonth: d.getMonth() === monthZeroIndexed,
    });
  }
  return cells;
}

/**
 * Determines whether an appointment's recurrence rule lands on `targetDate`.
 */
export function doesRuleMatchDate(
  anchorDate: string,
  rule: RecurrenceRule,
  targetDate: string,
  excludedDates?: string[]
): boolean {
  if (excludedDates && excludedDates.includes(targetDate)) {
    return false;
  }

  if (rule.frequency === 'none') {
    return targetDate === anchorDate;
  }

  if (targetDate < anchorDate) {
    return false;
  }

  if (rule.endDate && targetDate > rule.endDate) {
    return false;
  }

  if (targetDate === anchorDate) {
    return true;
  }

  const anchor = parseLocalDate(anchorDate);
  const target = parseLocalDate(targetDate);

  switch (rule.frequency) {
    case 'daily':
      return true;

    case 'weekly':
      return anchor.getDay() === target.getDay();

    case 'monthly': {
      const anchorDay = anchor.getDate();
      const targetMonthDays = getDaysInMonth(target.getFullYear(), target.getMonth());
      const effectiveDay = Math.min(anchorDay, targetMonthDays);
      return target.getDate() === effectiveDay;
    }

    case 'yearly': {
      if (anchor.getMonth() !== target.getMonth()) return false;
      const targetMonthDays = getDaysInMonth(target.getFullYear(), target.getMonth());
      const effectiveDay = Math.min(anchor.getDate(), targetMonthDays);
      return target.getDate() === effectiveDay;
    }

    default:
      return false;
  }
}

export function expandAppointmentsForDate(
  appointments: Appointment[],
  targetDate: string
): OccurrenceInstance[] {
  const occurrences: OccurrenceInstance[] = [];

  for (const appt of appointments) {
    if (doesRuleMatchDate(appt.date, appt.recurrence, targetDate, appt.excludedDates)) {
      occurrences.push({
        ...appt,
        occurrenceDate: targetDate,
        isRecurring: appt.recurrence.frequency !== 'none',
        isCompleted: Boolean(appt.completedDates?.includes(targetDate)),
      });
    }
  }

  return occurrences.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

export function expandAppointmentsForDates(
  appointments: Appointment[],
  dates: string[]
): Map<string, OccurrenceInstance[]> {
  const map = new Map<string, OccurrenceInstance[]>();
  for (const dateStr of dates) {
    map.set(dateStr, expandAppointmentsForDate(appointments, dateStr));
  }
  return map;
}

export function formatRecurrenceSummary(rule: RecurrenceRule, anchorDate?: string): string {
  if (rule.frequency === 'none') {
    return 'بدون تكرار';
  }

  const freqLabel = `تكرار ${RECURRENCE_LABELS[rule.frequency]}`;
  if (rule.endDate) {
    return `${freqLabel} · حتى ${formatArabicDateShort(rule.endDate)}`;
  }

  if (anchorDate && rule.frequency === 'weekly') {
    return `${freqLabel} (كل ${getWeekdayName(anchorDate)}) · مفتوح`;
  }

  return `${freqLabel} · مفتوح`;
}

export function toRRuleString(rule: RecurrenceRule): string | null {
  if (rule.frequency === 'none') return null;

  const freqMap: Record<Exclude<RecurrenceRule['frequency'], 'none'>, string> = {
    daily: 'DAILY',
    weekly: 'WEEKLY',
    monthly: 'MONTHLY',
    yearly: 'YEARLY',
  };

  let rrule = `FREQ=${freqMap[rule.frequency]}`;
  if (rule.endDate) {
    const compact = rule.endDate.replace(/-/g, '');
    rrule += `;UNTIL=${compact}T235959Z`;
  }
  return rrule;
}

export interface PositionedOccurrence {
  occurrence: OccurrenceInstance;
  colIndex: number;
  totalCols: number;
  startMin: number;
  endMin: number;
}

/**
 * Partitions overlapping events into non-overlapping side-by-side columns
 * for the hourly timeline.
 */
export function layoutOverlappingEvents(occurrences: OccurrenceInstance[]): PositionedOccurrence[] {
  if (occurrences.length === 0) return [];

  const sorted = [...occurrences]
    .map((occ) => {
      const startMin = timeToMinutes(occ.startTime);
      const rawEnd = timeToMinutes(occ.endTime);
      const endMin = Math.max(startMin + 20, rawEnd);
      return { occ, startMin, endMin };
    })
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);

  // Build connected clusters of overlapping events
  const clusters: typeof sorted[] = [];
  let currentCluster: typeof sorted = [];
  let clusterEnd = -1;

  for (const item of sorted) {
    if (currentCluster.length === 0 || item.startMin < clusterEnd) {
      currentCluster.push(item);
      clusterEnd = Math.max(clusterEnd, item.endMin);
    } else {
      clusters.push(currentCluster);
      currentCluster = [item];
      clusterEnd = item.endMin;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const results: PositionedOccurrence[] = [];

  for (const cluster of clusters) {
    const columnEnds: number[] = [];
    const placed: { item: (typeof sorted)[number]; colIndex: number }[] = [];

    for (const item of cluster) {
      let assignedCol = -1;
      for (let c = 0; c < columnEnds.length; c++) {
        if (columnEnds[c] <= item.startMin) {
          assignedCol = c;
          columnEnds[c] = item.endMin;
          break;
        }
      }
      if (assignedCol === -1) {
        assignedCol = columnEnds.length;
        columnEnds.push(item.endMin);
      }
      placed.push({ item, colIndex: assignedCol });
    }

    const totalCols = Math.max(1, columnEnds.length);
    for (const p of placed) {
      results.push({
        occurrence: p.item.occ,
        colIndex: p.colIndex,
        totalCols,
        startMin: p.item.startMin,
        endMin: p.item.endMin,
      });
    }
  }

  return results;
}
