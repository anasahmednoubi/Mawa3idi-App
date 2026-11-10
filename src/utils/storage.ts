import { Appointment } from '../types/schedule';
import { addDays, getTodayStr } from './recurrence';

const STORAGE_KEY = 'miqat_appointments_v1';
const SETTINGS_KEY = 'miqat_settings_v1';

export interface AppSettings {
  darkMode: boolean;
  soundEnabled: boolean;
  use24Hour: boolean;
  workStartHour: number;
  workEndHour: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  soundEnabled: true,
  use24Hour: false,
  workStartHour: 6,
  workEndHour: 23,
};

function createInitialSeedAppointments(): Appointment[] {
  const today = getTodayStr();
  const nextMonthEnd = addDays(today, 30);

  return [
    {
      id: 'seed-1',
      title: 'اجتماع المزامنة الصباحي',
      description: 'مراجعة أولويات اليوم وتوزيع المهام العاجلة مع الفريق.',
      location: 'غرفة الاجتماعات / أونلاين',
      date: today,
      startTime: '09:00',
      endTime: '09:30',
      category: 'meeting',
      recurrence: { frequency: 'daily' },
      reminders: [10, 0],
      calendarSource: 'local',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'seed-2',
      title: 'جلسة عمل وتركيز عميق',
      description: 'إنجاز المهام التحليلية والبرمجية دون مقاطعة.',
      date: today,
      startTime: '10:00',
      endTime: '12:00',
      category: 'focus',
      recurrence: { frequency: 'weekly' },
      reminders: [15],
      calendarSource: 'local',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'seed-3',
      title: 'مراجعة العرض التنفيذي للعميل',
      description: 'مناقشة المخرجات النهائية واعتماد الجدول الزمني.',
      location: 'مقر الشركة — قاعة 2',
      date: today,
      startTime: '13:30',
      endTime: '14:30',
      category: 'work',
      recurrence: { frequency: 'none' },
      reminders: [30, 5],
      calendarSource: 'local',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'seed-4',
      title: 'نشاط رياضي مسائي',
      description: 'تمرين لياقة ومشي لمدة ساعة.',
      location: 'النادي الرياضي',
      date: today,
      startTime: '18:00',
      endTime: '19:00',
      category: 'health',
      recurrence: { frequency: 'daily', endDate: nextMonthEnd },
      reminders: [15],
      calendarSource: 'local',
      createdAt: new Date().toISOString(),
    },
  ];
}

export function loadAppointments(): Appointment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      const seed = createInitialSeedAppointments();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
      return seed;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAppointments(appointments: Appointment[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appointments));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}
