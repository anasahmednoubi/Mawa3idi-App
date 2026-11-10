export type RecurrenceFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  /** Optional inclusive end date (YYYY-MM-DD). Undefined/empty means open-ended. */
  endDate?: string;
}

export type AppointmentCategory = 'work' | 'meeting' | 'personal' | 'health' | 'focus';

export interface Appointment {
  id: string;
  title: string;
  description?: string;
  location?: string;
  /** Anchor / start date in YYYY-MM-DD */
  date: string;
  /** Start time in HH:mm (24h) */
  startTime: string;
  /** End time in HH:mm (24h) */
  endTime: string;
  category: AppointmentCategory;
  recurrence: RecurrenceRule;
  /** Dates (YYYY-MM-DD) removed from a recurring series */
  excludedDates?: string[];
  /** Dates (YYYY-MM-DD) marked as completed */
  completedDates?: string[];
  /** Reminder offsets in minutes before startTime (e.g. [15, 0]) */
  reminders: number[];
  calendarSource?: 'local' | 'google';
  googleEventId?: string;
  createdAt: string;
}

export interface OccurrenceInstance extends Appointment {
  /** Concrete date of this occurrence (YYYY-MM-DD) */
  occurrenceDate: string;
  /** True if appointment repeats */
  isRecurring: boolean;
  /** True if this specific occurrence is marked completed */
  isCompleted: boolean;
}

export interface ActiveAlert {
  alertKey: string;
  appointmentId: string;
  occurrenceDate: string;
  title: string;
  startTime: string;
  endTime: string;
  category: AppointmentCategory;
  location?: string;
  offsetMinutes: number;
  triggeredAt: number;
  snoozedUntil?: number;
}

export type CalendarViewMode = 'day' | 'week' | 'month';

export interface CategoryMeta {
  id: AppointmentCategory;
  label: string;
  swatchClass: string;
  surfaceClass: string;
  textClass: string;
  borderClass: string;
}

export const CATEGORIES: Record<AppointmentCategory, CategoryMeta> = {
  work: {
    id: 'work',
    label: 'عمل ومهام',
    swatchClass: 'bg-blue-600 dark:bg-blue-500',
    surfaceClass: 'bg-blue-50/90 dark:bg-blue-950/50',
    textClass: 'text-blue-950 dark:text-blue-100',
    borderClass: 'border-blue-200 dark:border-blue-800/80',
  },
  meeting: {
    id: 'meeting',
    label: 'اجتماع',
    swatchClass: 'bg-indigo-600 dark:bg-indigo-400',
    surfaceClass: 'bg-indigo-50/90 dark:bg-indigo-950/50',
    textClass: 'text-indigo-950 dark:text-indigo-100',
    borderClass: 'border-indigo-200 dark:border-indigo-800/80',
  },
  focus: {
    id: 'focus',
    label: 'تركيز عميق',
    swatchClass: 'bg-emerald-600 dark:bg-emerald-400',
    surfaceClass: 'bg-emerald-50/90 dark:bg-emerald-950/50',
    textClass: 'text-emerald-950 dark:text-emerald-100',
    borderClass: 'border-emerald-200 dark:border-emerald-800/80',
  },
  personal: {
    id: 'personal',
    label: 'شخصي',
    swatchClass: 'bg-amber-600 dark:bg-amber-400',
    surfaceClass: 'bg-amber-50/90 dark:bg-amber-950/45',
    textClass: 'text-amber-950 dark:text-amber-100',
    borderClass: 'border-amber-200 dark:border-amber-800/80',
  },
  health: {
    id: 'health',
    label: 'صحة ورياضة',
    swatchClass: 'bg-rose-600 dark:bg-rose-400',
    surfaceClass: 'bg-rose-50/90 dark:bg-rose-950/45',
    textClass: 'text-rose-950 dark:text-rose-100',
    borderClass: 'border-rose-200 dark:border-rose-800/80',
  },
};

export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  none: 'بدون تكرار',
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
  yearly: 'سنوي',
};
