import React, { useMemo } from 'react';
import { Repeat } from 'lucide-react';
import { Appointment, CATEGORIES, OccurrenceInstance } from '../types/schedule';
import {
  expandAppointmentsForDates,
  formatTime12Or24,
  getTodayStr,
  getWeekDates,
  getWeekdayName,
  layoutOverlappingEvents,
  minutesToTime,
  parseLocalDate,
} from '../utils/recurrence';

interface WeekGridViewProps {
  selectedDate: string;
  appointments: Appointment[];
  use24Hour: boolean;
  workStartHour: number;
  workEndHour: number;
  onSelectDateAndDayView: (dateStr: string) => void;
  onSlotClick: (dateStr: string, startTime: string, endTime: string) => void;
  onSelectOccurrence: (occ: OccurrenceInstance) => void;
}

const WEEK_HOUR_HEIGHT = 56;

export const WeekGridView: React.FC<WeekGridViewProps> = ({
  selectedDate,
  appointments,
  use24Hour,
  workStartHour,
  workEndHour,
  onSelectDateAndDayView,
  onSlotClick,
  onSelectOccurrence,
}) => {
  const todayStr = getTodayStr();
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const weekMap = useMemo(
    () => expandAppointmentsForDates(appointments, weekDates),
    [appointments, weekDates]
  );

  const startHour = Math.max(0, Math.min(20, workStartHour));
  const endHour = Math.max(startHour + 1, Math.min(23, workEndHour));
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour]
  );
  const visibleStartMin = startHour * 60;
  const totalHeight = hours.length * WEEK_HOUR_HEIGHT;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Week Header Row */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90">
        <div className="w-16 sm:w-20 shrink-0 border-e border-slate-200 dark:border-slate-800" />
        <div className="flex-1 grid grid-cols-7 min-w-[640px]">
          {weekDates.map((d) => {
            const dt = parseLocalDate(d);
            const isToday = d === todayStr;
            const isSelected = d === selectedDate;
            const count = weekMap.get(d)?.length ?? 0;

            return (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDateAndDayView(d)}
                className={`py-2.5 px-2 text-center border-e last:border-e-0 border-slate-200 dark:border-slate-800 transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/30'
                    : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {getWeekdayName(d)}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1.5">
                  <span
                    className={`font-mono-nums text-sm font-semibold w-7 h-7 rounded-lg inline-flex items-center justify-center ${
                      isToday
                        ? 'bg-blue-600 text-white'
                        : isSelected
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {dt.getDate()}
                  </span>
                  {count > 0 && (
                    <span className="font-mono-nums text-[11px] text-slate-400 dark:text-slate-500">
                      ({count})
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Week Hourly Columns */}
      <div className="flex-1 overflow-auto timeline-scroll">
        <div className="flex min-w-[704px]" style={{ height: `${totalHeight}px` }}>
          {/* Hours Rail */}
          <div className="w-16 sm:w-20 shrink-0 border-e border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/30">
            {hours.map((h, idx) => (
              <div
                key={h}
                style={{ height: `${WEEK_HOUR_HEIGHT}px` }}
                className="flex items-start justify-end pe-2 pt-1"
              >
                <span
                  className={`font-mono-nums text-[11px] text-slate-500 dark:text-slate-400 ${
                    idx === 0 ? '' : '-translate-y-2.5'
                  }`}
                >
                  {formatTime12Or24(`${String(h).padStart(2, '0')}:00`, use24Hour)}
                </span>
              </div>
            ))}
          </div>

          {/* 7 Day Columns */}
          <div className="flex-1 grid grid-cols-7">
            {weekDates.map((d) => {
              const dayOccs = weekMap.get(d) || [];
              const positioned = layoutOverlappingEvents(dayOccs);
              const isToday = d === todayStr;

              return (
                <div
                  key={d}
                  className={`relative border-e last:border-e-0 border-slate-200 dark:border-slate-800 ${
                    isToday ? 'bg-blue-50/15 dark:bg-blue-950/10' : ''
                  }`}
                >
                  {hours.map((h) => {
                    const startStr = `${String(h).padStart(2, '0')}:00`;
                    const endStr = minutesToTime((h + 1) * 60);
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => onSlotClick(d, startStr, endStr)}
                        style={{ height: `${WEEK_HOUR_HEIGHT}px` }}
                        className="block w-full border-b border-slate-100 dark:border-slate-800/70 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
                        aria-label={`إضافة موعد ${d} ${startStr}`}
                      />
                    );
                  })}

                  {positioned.map(({ occurrence, colIndex, totalCols, startMin, endMin }) => {
                    const clampedStart = Math.max(visibleStartMin, startMin);
                    const clampedEnd = Math.min((endHour + 1) * 60, endMin);
                    if (clampedEnd <= visibleStartMin || clampedStart >= (endHour + 1) * 60) {
                      return null;
                    }

                    const topPx = ((clampedStart - visibleStartMin) / 60) * WEEK_HOUR_HEIGHT + 1;
                    const heightPx = Math.max(
                      24,
                      ((clampedEnd - clampedStart) / 60) * WEEK_HOUR_HEIGHT - 2
                    );
                    const widthPct = 100 / totalCols;
                    const startOffsetPct = colIndex * widthPct;
                    const cat = CATEGORIES[occurrence.category];

                    return (
                      <button
                        key={`${occurrence.id}-${d}`}
                        type="button"
                        onClick={() => onSelectOccurrence(occurrence)}
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                          insetInlineStart: `calc(${startOffsetPct}% + 2px)`,
                          width: `calc(${widthPct}% - 4px)`,
                        }}
                        className={`absolute z-10 rounded-md border px-1.5 py-1 text-start overflow-hidden transition-shadow hover:shadow-sm cursor-pointer ${
                          cat.surfaceClass
                        } ${cat.borderClass} ${cat.textClass} ${
                          occurrence.isCompleted ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-xs shrink-0 ${cat.swatchClass}`} />
                          <span className="text-[11px] font-semibold truncate">
                            {occurrence.title}
                          </span>
                          {occurrence.isRecurring && (
                            <Repeat className="w-2.5 h-2.5 shrink-0 opacity-75" />
                          )}
                        </div>
                        {heightPx >= 38 && (
                          <div className="font-mono-nums text-[10px] opacity-75 truncate mt-0.5">
                            {formatTime12Or24(occurrence.startTime, use24Hour)}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
