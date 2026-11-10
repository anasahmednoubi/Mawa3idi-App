import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Menu,
  Moon,
  Plus,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { AppointmentModal } from './components/AppointmentModal';
import { GoogleCalendarModal } from './components/GoogleCalendarModal';
import { HourlyTimeline } from './components/HourlyTimeline';
import { MonthCalendarView } from './components/MonthCalendarView';
import { ReminderDrawer, ReminderToasts } from './components/ReminderCenter';
import { Sidebar } from './components/Sidebar';
import { WeekGridView } from './components/WeekGridView';
import {
  ActiveAlert,
  Appointment,
  AppointmentCategory,
  CalendarViewMode,
  OccurrenceInstance,
} from './types/schedule';
import {
  formatReminderMinutes,
  playReminderChime,
  requestBrowserNotificationPermission,
  sendBrowserNotification,
} from './utils/notifications';
import {
  addDays,
  addMonths,
  expandAppointmentsForDate,
  formatArabicDateFull,
  formatArabicMonthYear,
  formatTime12Or24,
  getTodayStr,
  parseLocalDate,
  timeToMinutes,
} from './utils/recurrence';
import {
  AppSettings,
  loadAppointments,
  loadSettings,
  saveAppointments,
  saveSettings,
} from './utils/storage';

export default function App() {
  const [appointments, setAppointments] = useState<Appointment[]>(() => loadAppointments());
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());

  const [selectedDate, setSelectedDate] = useState<string>(() => getTodayStr());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('day');
  const [showFullDay, setShowFullDay] = useState<boolean>(false);
  const [activeCategory, setActiveCategory] = useState<AppointmentCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  // Modal states
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [modalDate, setModalDate] = useState<string>(() => getTodayStr());
  const [modalStartTime, setModalStartTime] = useState<string>('09:00');
  const [modalEndTime, setModalEndTime] = useState<string>('10:00');
  const [editingOccurrence, setEditingOccurrence] = useState<OccurrenceInstance | null>(null);

  const [googleModalOpen, setGoogleModalOpen] = useState<boolean>(false);
  const [reminderDrawerOpen, setReminderDrawerOpen] = useState<boolean>(false);
  const [, setNotifPermTick] = useState<number>(0);

  // Live alerts state
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const firedKeysRef = useRef<Set<string>>(new Set());
  const snoozedAlertsRef = useRef<Map<string, ActiveAlert>>(new Map());

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (settings.darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    saveSettings(settings);
  }, [settings]);

  // Persist appointments
  useEffect(() => {
    saveAppointments(appointments);
  }, [appointments]);

  // Reminder polling engine (checks every 15 seconds)
  const checkReminders = useCallback(() => {
    const now = new Date();
    const nowMs = now.getTime();
    const todayStr = getTodayStr();
    const todayOccs = expandAppointmentsForDate(appointments, todayStr);

    // 1. Check snoozed alerts
    snoozedAlertsRef.current.forEach((snoozed, key) => {
      if (snoozed.snoozedUntil && nowMs >= snoozed.snoozedUntil) {
        snoozedAlertsRef.current.delete(key);
        const refreshed: ActiveAlert = { ...snoozed, snoozedUntil: undefined, triggeredAt: nowMs };
        setActiveAlerts((prev) =>
          prev.some((a) => a.alertKey === key) ? prev : [...prev, refreshed]
        );
        if (settings.soundEnabled) playReminderChime();
        sendBrowserNotification(
          `تذكير مؤجل: ${snoozed.title}`,
          `الموعد الساعة ${formatTime12Or24(snoozed.startTime, settings.use24Hour)}`,
          key
        );
      }
    });

    // 2. Check upcoming reminders for today's occurrences
    for (const occ of todayOccs) {
      if (occ.isCompleted) continue;

      const [hh, mm] = occ.startTime.split(':').map(Number);
      const startDt = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hh || 0,
        mm || 0,
        0,
        0
      );
      const startMs = startDt.getTime();

      for (const offset of occ.reminders) {
        const triggerMs = startMs - offset * 60_000;
        const alertKey = `${occ.id}_${todayStr}_${offset}`;

        if (firedKeysRef.current.has(alertKey)) continue;

        // Fire if within [triggerMs, triggerMs + 60s]
        if (nowMs >= triggerMs && nowMs < triggerMs + 60_000) {
          firedKeysRef.current.add(alertKey);
          const alert: ActiveAlert = {
            alertKey,
            appointmentId: occ.id,
            occurrenceDate: todayStr,
            title: occ.title,
            startTime: occ.startTime,
            endTime: occ.endTime,
            category: occ.category,
            location: occ.location,
            offsetMinutes: offset,
            triggeredAt: nowMs,
          };

          setActiveAlerts((prev) => [...prev, alert]);
          if (settings.soundEnabled) playReminderChime();
          sendBrowserNotification(
            occ.title,
            `${formatReminderMinutes(offset)} · ${formatTime12Or24(occ.startTime, settings.use24Hour)}`,
            alertKey
          );
        }
      }
    }
  }, [appointments, settings.soundEnabled, settings.use24Hour]);

  useEffect(() => {
    checkReminders();
    const timer = setInterval(checkReminders, 15_000);
    return () => clearInterval(timer);
  }, [checkReminders]);

  // Filtered appointments (category + search)
  const filteredAppointments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return appointments.filter((appt) => {
      if (activeCategory !== 'all' && appt.category !== activeCategory) {
        return false;
      }
      if (q) {
        const haystack = `${appt.title} ${appt.description || ''} ${appt.location || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [appointments, activeCategory, searchQuery]);

  const dayOccurrences = useMemo(
    () => expandAppointmentsForDate(filteredAppointments, selectedDate),
    [filteredAppointments, selectedDate]
  );

  // Summary KPIs for selected date
  const summaryStats = useMemo(() => {
    const completedCount = dayOccurrences.filter((o) => o.isCompleted).length;
    const recurringSeriesCount = appointments.filter((a) => a.recurrence.frequency !== 'none').length;

    const todayStr = getTodayStr();
    const todayOccs = expandAppointmentsForDate(appointments, todayStr);
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

    let nextReminderLabel = 'لا يوجد';
    const upcomingTriggers = todayOccs
      .filter((o) => !o.isCompleted)
      .flatMap((o) => {
        const startMin = timeToMinutes(o.startTime);
        return o.reminders.map((offset) => ({
          triggerMin: startMin - offset,
          title: o.title,
        }));
      })
      .filter((t) => t.triggerMin >= nowMin)
      .sort((a, b) => a.triggerMin - b.triggerMin);

    if (upcomingTriggers.length > 0) {
      const next = upcomingTriggers[0];
      const h = String(Math.floor(next.triggerMin / 60)).padStart(2, '0');
      const m = String(next.triggerMin % 60).padStart(2, '0');
      nextReminderLabel = `${formatTime12Or24(`${h}:${m}`, settings.use24Hour)}`;
    }

    return {
      dayCount: dayOccurrences.length,
      completedCount,
      recurringSeriesCount,
      nextReminderLabel,
    };
  }, [appointments, dayOccurrences, settings.use24Hour]);

  // Handlers
  const openCreateModal = (dateStr = selectedDate, startTime = '09:00', endTime = '10:00') => {
    setEditingOccurrence(null);
    setModalDate(dateStr);
    setModalStartTime(startTime);
    setModalEndTime(endTime);
    setModalOpen(true);
  };

  const openEditModal = (occ: OccurrenceInstance) => {
    setEditingOccurrence(occ);
    setModalDate(occ.date);
    setModalStartTime(occ.startTime);
    setModalEndTime(occ.endTime);
    setModalOpen(true);
  };

  const handleSaveAppointment = (
    data: Omit<Appointment, 'id' | 'createdAt'>,
    editingId?: string,
    editScope: 'series' | 'single' = 'series',
    occurrenceDate?: string
  ) => {
    if (!editingId) {
      const created: Appointment = {
        ...data,
        id: `appt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
      };
      setAppointments((prev) => [...prev, created]);
      return;
    }

    if (editScope === 'single' && occurrenceDate) {
      // Exclude this date from recurring series and add standalone single appointment
      const detached: Appointment = {
        ...data,
        id: `appt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        date: occurrenceDate,
        recurrence: { frequency: 'none' },
        excludedDates: undefined,
        completedDates: undefined,
        createdAt: new Date().toISOString(),
      };

      setAppointments((prev) =>
        prev
          .map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  excludedDates: Array.from(new Set([...(item.excludedDates || []), occurrenceDate])),
                }
              : item
          )
          .concat(detached)
      );
      return;
    }

    // Update entire series / single non-recurring item
    setAppointments((prev) =>
      prev.map((item) =>
        item.id === editingId
          ? {
              ...item,
              ...data,
            }
          : item
      )
    );
  };

  const handleDeleteAppointment = (
    appointmentId: string,
    scope: 'series' | 'single',
    occurrenceDate?: string
  ) => {
    if (scope === 'single' && occurrenceDate) {
      setAppointments((prev) =>
        prev.map((item) =>
          item.id === appointmentId
            ? {
                ...item,
                excludedDates: Array.from(new Set([...(item.excludedDates || []), occurrenceDate])),
              }
            : item
        )
      );
      return;
    }

    setAppointments((prev) => prev.filter((item) => item.id !== appointmentId));
  };

  const handleToggleComplete = (occ: OccurrenceInstance) => {
    setAppointments((prev) =>
      prev.map((item) => {
        if (item.id !== occ.id) return item;
        const current = item.completedDates || [];
        const exists = current.includes(occ.occurrenceDate);
        return {
          ...item,
          completedDates: exists
            ? current.filter((d) => d !== occ.occurrenceDate)
            : [...current, occ.occurrenceDate],
        };
      })
    );
  };

  const handleImportAppointments = (imported: Omit<Appointment, 'id' | 'createdAt'>[]) => {
    const stamped: Appointment[] = imported.map((item, idx) => ({
      ...item,
      id: `imp_${Date.now()}_${idx}`,
      createdAt: new Date().toISOString(),
    }));
    setAppointments((prev) => [...prev, ...stamped]);
  };

  const handleDismissAlert = (alertKey: string) => {
    setActiveAlerts((prev) => prev.filter((a) => a.alertKey !== alertKey));
    snoozedAlertsRef.current.delete(alertKey);
  };

  const handleSnoozeAlert = (alertKey: string, snoozeMinutes: number) => {
    const target = activeAlerts.find((a) => a.alertKey === alertKey);
    if (!target) return;
    setActiveAlerts((prev) => prev.filter((a) => a.alertKey !== alertKey));
    snoozedAlertsRef.current.set(alertKey, {
      ...target,
      snoozedUntil: Date.now() + snoozeMinutes * 60_000,
    });
  };

  const handleTriggerTestAlert = () => {
    const now = new Date();
    const startStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const endDt = new Date(now.getTime() + 30 * 60_000);
    const endStr = `${String(endDt.getHours()).padStart(2, '0')}:${String(endDt.getMinutes()).padStart(2, '0')}`;
    const key = `test_${Date.now()}`;

    const testAlert: ActiveAlert = {
      alertKey: key,
      appointmentId: 'test',
      occurrenceDate: getTodayStr(),
      title: 'تنبيه تجريبي — مراجعة جدول اليوم',
      startTime: startStr,
      endTime: endStr,
      category: 'work',
      offsetMinutes: 0,
      triggeredAt: Date.now(),
    };

    setActiveAlerts((prev) => [...prev, testAlert]);
    if (settings.soundEnabled) playReminderChime();
    sendBrowserNotification(
      testAlert.title,
      `تذكير تجريبي من تطبيق ميقات · ${formatTime12Or24(startStr, settings.use24Hour)}`,
      key
    );
  };

  const navigateStep = (direction: -1 | 1) => {
    if (viewMode === 'day') {
      setSelectedDate((d) => addDays(d, direction));
    } else if (viewMode === 'week') {
      setSelectedDate((d) => addDays(d, direction * 7));
    } else {
      setSelectedDate((d) => addMonths(d, direction));
    }
  };

  const anchorDt = parseLocalDate(selectedDate);
  const headerTitle =
    viewMode === 'month'
      ? formatArabicMonthYear(anchorDt.getFullYear(), anchorDt.getMonth())
      : formatArabicDateFull(selectedDate);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Top Bar Contract: Zone 1 (Brand) — Zone 2 (4 Nav Links) — Zone 3 (1 Primary Action) */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen((v) => !v)}
            className="lg:hidden w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="القائمة الجانبية"
          >
            {mobileSidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setSelectedDate(getTodayStr());
              setViewMode('day');
            }}
            className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            ميقات
          </a>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-400">
          <button
            type="button"
            onClick={() => setViewMode('day')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              viewMode === 'day'
                ? 'border-blue-600 text-slate-900 dark:text-slate-100'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            الجدول بالساعة
          </button>
          <button
            type="button"
            onClick={() => setViewMode('week')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              viewMode === 'week'
                ? 'border-blue-600 text-slate-900 dark:text-slate-100'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            الأسبوع
          </button>
          <button
            type="button"
            onClick={() => setViewMode('month')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors cursor-pointer ${
              viewMode === 'month'
                ? 'border-blue-600 text-slate-900 dark:text-slate-100'
                : 'border-transparent hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            الشهر
          </button>
          <button
            type="button"
            onClick={() => setGoogleModalOpen(true)}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 dark:hover:text-slate-100 transition-colors cursor-pointer"
          >
            ربط Google Calendar
          </button>
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={() => openCreateModal(selectedDate, '09:00', '10:00')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>موعد جديد</span>
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-5 flex flex-col lg:flex-row gap-6">
        {/* Desktop Sidebar & Mobile Collapsible Sidebar */}
        <div className={`${mobileSidebarOpen ? 'block' : 'hidden'} lg:block`}>
          <Sidebar
            selectedDate={selectedDate}
            appointments={appointments}
            dayOccurrences={dayOccurrences}
            activeCategory={activeCategory}
            use24Hour={settings.use24Hour}
            googleConnected={false}
            onSelectDate={(d) => {
              setSelectedDate(d);
              setMobileSidebarOpen(false);
            }}
            onSelectCategory={setActiveCategory}
            onSelectOccurrence={openEditModal}
            onOpenGoogleSync={() => setGoogleModalOpen(true)}
          />
        </div>

        {/* Main Calendar & Hourly Viewport */}
        <main className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Summary Strip (4-column KPI bar) */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                مواعيد التاريخ المحدد
              </div>
              <div className="mt-1 font-mono-nums text-xl font-bold text-slate-900 dark:text-slate-100">
                {summaryStats.dayCount}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                سلاسل التكرار النشطة
              </div>
              <div className="mt-1 font-mono-nums text-xl font-bold text-slate-900 dark:text-slate-100">
                {summaryStats.recurringSeriesCount}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                المنجز في هذا اليوم
              </div>
              <div className="mt-1 font-mono-nums text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {summaryStats.completedCount} / {summaryStats.dayCount}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3">
              <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                التنبيه القادم اليوم
              </div>
              <div className="mt-1 font-mono-nums text-base sm:text-lg font-bold text-blue-600 dark:text-blue-400 truncate">
                {summaryStats.nextReminderLabel}
              </div>
            </div>
          </section>

          {/* Workspace Toolbar */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            {/* Date Navigation */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => navigateStep(-1)}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="السابق"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDate(getTodayStr())}
                  className="px-3 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
                >
                  اليوم
                </button>
                <button
                  type="button"
                  onClick={() => navigateStep(1)}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="التالي"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              <h1 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
                {headerTitle}
              </h1>
            </div>

            {/* Search, View Switch, Time Format, Reminders & Theme */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في المواعيد..."
                  className="w-40 sm:w-48 ps-8 pe-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {/* Segmented View Switcher */}
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                {(
                  [
                    { id: 'day', label: 'يومي' },
                    { id: 'week', label: 'أسبوعي' },
                    { id: 'month', label: 'شهري' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setViewMode(tab.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      viewMode === tab.id
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 12h / 24h Format Button */}
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, use24Hour: !s.use24Hour }))}
                title="تبديل تنسيق الوقت (12 / 24 ساعة)"
                className="px-2.5 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono-nums font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>{settings.use24Hour ? '24س' : '12س'}</span>
              </button>

              {/* Reminder Center Trigger */}
              <button
                type="button"
                onClick={() => setReminderDrawerOpen(true)}
                className="px-2.5 h-8 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Bell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>التنبيهات</span>
              </button>

              {/* Dark/Light Mode Toggle */}
              <button
                type="button"
                onClick={() => setSettings((s) => ({ ...s, darkMode: !s.darkMode }))}
                className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                aria-label="تبديل المظهر الليلي"
              >
                {settings.darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </section>

          {/* Primary Calendar / Timeline Viewport */}
          <section className="flex-1 min-h-[620px] h-[calc(100vh-260px)]">
            {viewMode === 'day' && (
              <HourlyTimeline
                dateStr={selectedDate}
                occurrences={dayOccurrences}
                use24Hour={settings.use24Hour}
                showFullDay={showFullDay}
                workStartHour={settings.workStartHour}
                workEndHour={settings.workEndHour}
                onToggleFullDay={() => setShowFullDay((v) => !v)}
                onSlotClick={openCreateModal}
                onSelectOccurrence={openEditModal}
                onToggleComplete={handleToggleComplete}
              />
            )}

            {viewMode === 'week' && (
              <WeekGridView
                selectedDate={selectedDate}
                appointments={filteredAppointments}
                use24Hour={settings.use24Hour}
                workStartHour={settings.workStartHour}
                workEndHour={settings.workEndHour}
                onSelectDateAndDayView={(d) => {
                  setSelectedDate(d);
                  setViewMode('day');
                }}
                onSlotClick={openCreateModal}
                onSelectOccurrence={openEditModal}
              />
            )}

            {viewMode === 'month' && (
              <MonthCalendarView
                selectedDate={selectedDate}
                appointments={filteredAppointments}
                use24Hour={settings.use24Hour}
                onSelectDate={setSelectedDate}
                onOpenDayTimeline={(d) => {
                  setSelectedDate(d);
                  setViewMode('day');
                }}
                onCreateOnDate={(d) => openCreateModal(d, '09:00', '10:00')}
                onSelectOccurrence={openEditModal}
              />
            )}
          </section>
        </main>
      </div>

      {/* Create / Edit Appointment Modal (with Recurrence & Reminders) */}
      <AppointmentModal
        isOpen={modalOpen}
        initialDate={modalDate}
        initialStartTime={modalStartTime}
        initialEndTime={modalEndTime}
        editingOccurrence={editingOccurrence}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteAppointment}
      />

      {/* Google Calendar Sync & ICS Modal */}
      <GoogleCalendarModal
        isOpen={googleModalOpen}
        appointments={appointments}
        googleAccessToken={null}
        googleUserEmail={null}
        googleCalendars={[]}
        isSyncing={false}
        syncError={null}
        onClose={() => setGoogleModalOpen(false)}
        onImportAppointments={handleImportAppointments}
      />

      {/* Notification & Reminder Center Drawer */}
      <ReminderDrawer
        isOpen={reminderDrawerOpen}
        appointments={appointments}
        soundEnabled={settings.soundEnabled}
        use24Hour={settings.use24Hour}
        onClose={() => setReminderDrawerOpen(false)}
        onToggleSound={() => setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))}
        onRequestBrowserPermission={async () => {
          await requestBrowserNotificationPermission();
          setNotifPermTick((n) => n + 1);
        }}
        onTriggerTestAlert={handleTriggerTestAlert}
      />

      {/* Live Reminder Toast Alerts */}
      <ReminderToasts
        alerts={activeAlerts}
        use24Hour={settings.use24Hour}
        onDismiss={handleDismissAlert}
        onSnooze={handleSnoozeAlert}
      />
    </div>
  );
}
