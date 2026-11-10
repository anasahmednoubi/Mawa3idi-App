import React, { useMemo } from 'react';
import { Plus, Repeat } from 'lucide-react';
import { Appointment, CATEGORIES, OccurrenceInstance } from '../types/schedule';
import {
  expandAppointmentsForDates,
  formatTime12Or24,
  getMonthGridDates,
  getTodayStr,
  parseLocalDate,
} from '../utils/recurrence';

interface MonthCalendarViewProps {
  selectedDate: string;
  appointments: Appointment[];
  use24Hour: boolean;
  onSelectDate: (dateStr: string) => void;
  onOpenDayTimeline: (dateStr: string) => void;
  onCreateOnDate: (dateStr: string) => void;
  onSelectOccurrence: (occ: OccurrenceInstance) => void;
}

const WEEKDAY_HEADERS = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

export const MonthCalendarView: React.FC<MonthCalendarViewProps> = ({
  selectedDate,
  appointments,
  use24Hour,
  onSelectDate,
  onOpenDayTimeline,
  onCreateOnDate,
  onSelectOccurrence,
}) => {
  const todayStr = getTodayStr();
  const anchor = parseLocalDate(selectedDate);
  const year = anchor.getFullYear();
  const month = anchor.getMonth();

  const cells = useMemo(() => getMonthGridDates(year, month), [year, month]);
  const occurrencesMap = useMemo(
    () =>
      expandAppointmentsForDates(
        appointments,
        cells.map((c) => c.dateStr)
      ),
    [appointments, cells]
  );

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90">
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className="py-2.5 px-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400 border-e last:border-e-0 border-slate-200 dark:border-slate-800"
          >
            {label}
          </div>
        ))}
      </div>

      {/* 6-Week Grid */}
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-y-auto">
        {cells.map(({ dateStr, inMonth }) => {
          const dayNum = parseLocalDate(dateStr).getDate();
          const dayOccs = occurrencesMap.get(dateStr) || [];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const visibleOccs = dayOccs.slice(0, 3);
          const extraCount = dayOccs.length - visibleOccs.length;

          return (
            <div
              key={dateStr}
              onClick={() => onSelectDate(dateStr)}
              onDoubleClick={() => onOpenDayTimeline(dateStr)}
              className={`group min-h-[104px] p-1.5 sm:p-2 border-b border-e border-slate-200/80 dark:border-slate-800/80 flex flex-col gap-1 transition-colors cursor-pointer ${
                !inMonth
                  ? 'bg-slate-50/60 dark:bg-slate-950/40 text-slate-400 dark:text-slate-600'
                  : isSelected
                    ? 'bg-blue-50/40 dark:bg-blue-950/20'
                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenDayTimeline(dateStr);
                  }}
                  title="عرض الجدول بالساعة لهذا اليوم"
                  className={`font-mono-nums text-xs font-semibold w-6 h-6 rounded-md inline-flex items-center justify-center transition-colors cursor-pointer ${
                    isToday
                      ? 'bg-blue-600 text-white'
                      : isSelected
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                        : inMonth
                          ? 'text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                          : 'text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {dayNum}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateOnDate(dateStr);
                  }}
                  title="إضافة موعد في هذا اليوم"
                  className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                {visibleOccs.map((occ) => {
                  const cat = CATEGORIES[occ.category];
                  return (
                    <button
                      key={`${occ.id}-${dateStr}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectOccurrence(occ);
                      }}
                      className={`w-full text-start px-1.5 py-0.5 rounded border text-[11px] flex items-center gap-1 min-w-0 transition-colors cursor-pointer ${
                        cat.surfaceClass
                      } ${cat.borderClass} ${cat.textClass} ${
                        occ.isCompleted ? 'opacity-55 line-through' : ''
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-xs shrink-0 ${cat.swatchClass}`} />
                      <span className="font-mono-nums text-[10px] opacity-75 shrink-0 hidden sm:inline">
                        {formatTime12Or24(occ.startTime, use24Hour).replace(' ص', '').replace(' م', '')}
                      </span>
                      <span className="truncate font-medium flex-1">{occ.title}</span>
                      {occ.isRecurring && <Repeat className="w-2.5 h-2.5 shrink-0 opacity-70" />}
                    </button>
                  );
                })}

                {extraCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDayTimeline(dateStr);
                    }}
                    className="text-[11px] font-medium text-blue-600 dark:text-blue-400 text-start px-1 hover:underline cursor-pointer"
                  >
                    +{extraCount} مواعيد أخرى
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
