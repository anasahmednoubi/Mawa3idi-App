import React, { useMemo, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Link2,
  Repeat,
} from 'lucide-react';
import {
  Appointment,
  AppointmentCategory,
  CATEGORIES,
  OccurrenceInstance,
} from '../types/schedule';
import {
  doesRuleMatchDate,
  formatArabicMonthYear,
  formatTime12Or24,
  getMonthGridDates,
  getTodayStr,
  parseLocalDate,
} from '../utils/recurrence';

interface SidebarProps {
  selectedDate: string;
  appointments: Appointment[];
  dayOccurrences: OccurrenceInstance[];
  activeCategory: AppointmentCategory | 'all';
  use24Hour: boolean;
  googleConnected: boolean;
  onSelectDate: (dateStr: string) => void;
  onSelectCategory: (cat: AppointmentCategory | 'all') => void;
  onSelectOccurrence: (occ: OccurrenceInstance) => void;
  onOpenGoogleSync: () => void;
}

const MINI_WEEKDAYS = ['س', 'ح', 'ن', 'ث', 'ر', 'خ', 'ج'];

export const Sidebar: React.FC<SidebarProps> = ({
  selectedDate,
  appointments,
  dayOccurrences,
  activeCategory,
  use24Hour,
  googleConnected,
  onSelectDate,
  onSelectCategory,
  onSelectOccurrence,
  onOpenGoogleSync,
}) => {
  const todayStr = getTodayStr();
  const initialAnchor = parseLocalDate(selectedDate);
  const [miniYear, setMiniYear] = useState(initialAnchor.getFullYear());
  const [miniMonth, setMiniMonth] = useState(initialAnchor.getMonth());

  const miniCells = useMemo(() => getMonthGridDates(miniYear, miniMonth), [miniYear, miniMonth]);

  const busyDays = useMemo(() => {
    const set = new Set<string>();
    for (const cell of miniCells) {
      if (
        appointments.some((appt) =>
          doesRuleMatchDate(appt.date, appt.recurrence, cell.dateStr, appt.excludedDates)
        )
      ) {
        set.add(cell.dateStr);
      }
    }
    return set;
  }, [appointments, miniCells]);

  const goPrevMonth = () => {
    if (miniMonth === 0) {
      setMiniYear((y) => y - 1);
      setMiniMonth(11);
    } else {
      setMiniMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (miniMonth === 11) {
      setMiniYear((y) => y + 1);
      setMiniMonth(0);
    } else {
      setMiniMonth((m) => m + 1);
    }
  };

  const pendingOccurrences = dayOccurrences.filter((o) => !o.isCompleted);

  return (
    <aside className="w-full lg:w-[272px] shrink-0 flex flex-col gap-5">
      {/* Mini Calendar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
            {formatArabicMonthYear(miniYear, miniMonth)}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={goPrevMonth}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="الشهر السابق"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goNextMonth}
              className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="الشهر التالي"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {MINI_WEEKDAYS.map((w) => (
            <div key={w} className="text-[11px] font-medium text-slate-400 dark:text-slate-500 py-1">
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {miniCells.map(({ dateStr, inMonth }) => {
            const dNum = parseLocalDate(dateStr).getDate();
            const isSelected = dateStr === selectedDate;
            const isToday = dateStr === todayStr;
            const hasEvents = busyDays.has(dateStr);

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => onSelectDate(dateStr)}
                className={`relative h-8 rounded-lg font-mono-nums text-xs flex flex-col items-center justify-center transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white font-semibold'
                    : isToday
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold'
                      : inMonth
                        ? 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                <span>{dNum}</span>
                {hasEvents && (
                  <span
                    className={`w-1 h-1 rounded-full mt-0.5 ${
                      isSelected ? 'bg-white' : 'bg-blue-600 dark:bg-blue-400'
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
        <div className="text-xs font-bold text-slate-900 dark:text-slate-100">تصنيف المواعيد</div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <span>جميع التصنيفات</span>
            <span className="font-mono-nums opacity-75">{appointments.length}</span>
          </button>

          {Object.values(CATEGORIES).map((cat) => {
            const count = appointments.filter((a) => a.category === cat.id).length;
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`w-full px-3 py-2 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-xs shrink-0 ${cat.swatchClass}`} />
                  <span>{cat.label}</span>
                </span>
                <span className="font-mono-nums opacity-75">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Upcoming Today Snapshot */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
            مهام ومواعيد اليوم
          </span>
          <span className="font-mono-nums text-[11px] text-slate-500 dark:text-slate-400">
            {pendingOccurrences.length} متبقي
          </span>
        </div>

        {dayOccurrences.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
            لا توجد مواعيد في هذا التاريخ
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {dayOccurrences.slice(0, 5).map((occ) => {
              const cat = CATEGORIES[occ.category];
              return (
                <button
                  key={`${occ.id}-${occ.occurrenceDate}`}
                  type="button"
                  onClick={() => onSelectOccurrence(occ)}
                  className="w-full py-2.5 text-start flex items-start gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-md px-1 transition-colors cursor-pointer"
                >
                  <span className={`w-2 h-2 rounded-xs mt-1.5 shrink-0 ${cat.swatchClass}`} />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-xs font-semibold truncate text-slate-900 dark:text-slate-100 ${
                        occ.isCompleted ? 'line-through opacity-60' : ''
                      }`}
                    >
                      {occ.title}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono-nums">
                      <span>{formatTime12Or24(occ.startTime, use24Hour)}</span>
                      {occ.isRecurring && <Repeat className="w-3 h-3 text-blue-600 dark:text-blue-400" />}
                      {occ.reminders.length > 0 && <Bell className="w-3 h-3" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Google Calendar Sync Shortcut */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
          <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          <span>مزامنة Google Calendar</span>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
          {googleConnected
            ? 'حساب Google Calendar متصل وجاهز للمزامنة.'
            : 'اربط حسابك أو صدّر جدولك بصيغة ICS المتوافقة مع تقويم جوجل.'}
        </p>
        <button
          type="button"
          onClick={onOpenGoogleSync}
          className="w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
        >
          <Link2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>إدارة الربط والتصدير</span>
        </button>
      </div>
    </aside>
  );
};
