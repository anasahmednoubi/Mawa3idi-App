import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Check, Clock, MapPin, Plus, Repeat } from 'lucide-react';
import { CATEGORIES, OccurrenceInstance } from '../types/schedule';
import {
  formatDurationAr,
  formatRecurrenceSummary,
  formatTime12Or24,
  getTodayStr,
  layoutOverlappingEvents,
  minutesToTime,
} from '../utils/recurrence';

interface HourlyTimelineProps {
  dateStr: string;
  occurrences: OccurrenceInstance[];
  use24Hour: boolean;
  showFullDay: boolean;
  workStartHour: number;
  workEndHour: number;
  onToggleFullDay: () => void;
  onSlotClick: (dateStr: string, startTime: string, endTime: string) => void;
  onSelectOccurrence: (occ: OccurrenceInstance) => void;
  onToggleComplete: (occ: OccurrenceInstance) => void;
}

const HOUR_HEIGHT = 72; // px per hour (1.2px per minute)

export const HourlyTimeline: React.FC<HourlyTimelineProps> = ({
  dateStr,
  occurrences,
  use24Hour,
  showFullDay,
  workStartHour,
  workEndHour,
  onToggleFullDay,
  onSlotClick,
  onSelectOccurrence,
  onToggleComplete,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [nowMinutes, setNowMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  const isToday = dateStr === getTodayStr();

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setNowMinutes(now.getHours() * 60 + now.getMinutes());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const startHour = showFullDay ? 0 : Math.max(0, Math.min(22, workStartHour));
  const endHour = showFullDay ? 23 : Math.max(startHour + 1, Math.min(23, workEndHour));
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i),
    [startHour, endHour]
  );

  const visibleStartMin = startHour * 60;
  const totalHeight = hours.length * HOUR_HEIGHT;

  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const targetHour = isToday ? Math.max(startHour, new Date().getHours() - 1) : Math.max(startHour, 8);
    const offset = (targetHour - startHour) * HOUR_HEIGHT;
    scrollContainerRef.current.scrollTo({ top: Math.max(0, offset - 20), behavior: 'smooth' });
  }, [dateStr, isToday, startHour]);

  const positioned = useMemo(() => layoutOverlappingEvents(occurrences), [occurrences]);

  const nowTopPx = ((nowMinutes - visibleStartMin) / 60) * HOUR_HEIGHT;
  const showNowLine = isToday && nowMinutes >= visibleStartMin && nowMinutes <= (endHour + 1) * 60;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      {/* Timeline Subheader */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80">
        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
          <span className="font-medium text-slate-900 dark:text-slate-100">
            الجدول الزمني بالساعة
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {occurrences.length === 0
              ? 'لا توجد مواعيد مجدولة'
              : `${occurrences.length} ${occurrences.length === 1 ? 'موعد' : occurrences.length === 2 ? 'موعدان' : 'مواعيد'}`}
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleFullDay}
          className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          {showFullDay ? `ساعات العمل (${workStartHour}:00 – ${workEndHour}:00)` : 'عرض 24 ساعة كاملة'}
        </button>
      </div>

      {/* Scrollable Hourly Grid */}
      <div
        ref={scrollContainerRef}
        className="relative flex-1 overflow-y-auto timeline-scroll select-none"
      >
        <div className="relative flex" style={{ height: `${totalHeight}px` }}>
          {/* Time Rail (Hours Axis) */}
          <div className="w-20 sm:w-24 shrink-0 border-e border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/30 relative">
            {hours.map((hour, idx) => (
              <div
                key={hour}
                style={{ height: `${HOUR_HEIGHT}px` }}
                className="relative flex items-start justify-end pe-3 pt-1.5"
              >
                <span
                  className={`font-mono-nums text-[11px] font-medium text-slate-500 dark:text-slate-400 ${
                    idx === 0 ? 'translate-y-0' : '-translate-y-3'
                  }`}
                >
                  {formatTime12Or24(`${String(hour).padStart(2, '0')}:00`, use24Hour)}
                </span>
              </div>
            ))}
          </div>

          {/* Interactive Hour Slots & Event Canvas */}
          <div className="relative flex-1 min-w-0">
            {/* Hour Grid Lines & Clickable Half-Hour Slots */}
            {hours.map((hour) => {
              const startStr = `${String(hour).padStart(2, '0')}:00`;
              const midStr = `${String(hour).padStart(2, '0')}:30`;
              const endHourStr = minutesToTime((hour + 1) * 60);
              const endMidStr = minutesToTime(hour * 60 + 90);

              return (
                <div
                  key={hour}
                  style={{ height: `${HOUR_HEIGHT}px` }}
                  className="border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col"
                >
                  {/* First 30 mins */}
                  <button
                    type="button"
                    onClick={() => onSlotClick(dateStr, startStr, endHourStr)}
                    title={`إضافة موعد الساعة ${formatTime12Or24(startStr, use24Hour)}`}
                    className="group flex-1 w-full text-start px-3 flex items-center justify-end border-b border-dashed border-slate-100 dark:border-slate-800/50 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
                  >
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                      <Plus className="w-3 h-3" />
                      <span>إضافة في {formatTime12Or24(startStr, use24Hour)}</span>
                    </span>
                  </button>

                  {/* Second 30 mins */}
                  <button
                    type="button"
                    onClick={() => onSlotClick(dateStr, midStr, endMidStr)}
                    title={`إضافة موعد الساعة ${formatTime12Or24(midStr, use24Hour)}`}
                    className="group flex-1 w-full text-start px-3 flex items-center justify-end hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors cursor-pointer"
                  >
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                      <Plus className="w-3 h-3" />
                      <span>إضافة في {formatTime12Or24(midStr, use24Hour)}</span>
                    </span>
                  </button>
                </div>
              );
            })}

            {/* Live Current Time Indicator */}
            {showNowLine && (
              <div
                style={{ top: `${nowTopPx}px` }}
                className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600 -ms-1.5 shrink-0 ring-2 ring-white dark:ring-slate-900" />
                <div className="h-[1.5px] w-full bg-blue-600" />
              </div>
            )}

            {/* Positioned Appointment Blocks */}
            {positioned.map(({ occurrence, colIndex, totalCols, startMin, endMin }) => {
              const clampedStart = Math.max(visibleStartMin, startMin);
              const clampedEnd = Math.min((endHour + 1) * 60, endMin);
              if (clampedEnd <= visibleStartMin || clampedStart >= (endHour + 1) * 60) {
                return null;
              }

              const topPx = ((clampedStart - visibleStartMin) / 60) * HOUR_HEIGHT + 2;
              const heightPx = Math.max(30, ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT - 4);
              const widthPct = 100 / totalCols;
              const startOffsetPct = colIndex * widthPct;

              const cat = CATEGORIES[occurrence.category];
              const isCompact = heightPx < 54;

              return (
                <div
                  key={`${occurrence.id}-${occurrence.occurrenceDate}`}
                  style={{
                    top: `${topPx}px`,
                    height: `${heightPx}px`,
                    insetInlineStart: `calc(${startOffsetPct}% + 6px)`,
                    width: `calc(${widthPct}% - 12px)`,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectOccurrence(occurrence);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectOccurrence(occurrence);
                    }
                  }}
                  className={`absolute z-10 rounded-lg border px-3 py-1.5 text-start transition-all duration-150 cursor-pointer overflow-hidden hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                    cat.surfaceClass
                  } ${cat.borderClass} ${cat.textClass} ${
                    occurrence.isCompleted ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 h-full">
                    <div className="min-w-0 flex-1 flex flex-col justify-between h-full">
                      <div>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-xs shrink-0 ${cat.swatchClass}`} />
                          <span
                            className={`text-xs sm:text-sm font-semibold truncate ${
                              occurrence.isCompleted ? 'line-through' : ''
                            }`}
                          >
                            {occurrence.title}
                          </span>
                          {occurrence.isRecurring && (
                            <Repeat
                              className="w-3.5 h-3.5 shrink-0 opacity-70"
                              aria-label={formatRecurrenceSummary(occurrence.recurrence, occurrence.date)}
                            />
                          )}
                        </div>

                        {!isCompact && (
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] opacity-80">
                            <span className="font-mono-nums inline-flex items-center gap-1">
                              <Clock className="w-3 h-3 shrink-0" />
                              {formatTime12Or24(occurrence.startTime, use24Hour)} –{' '}
                              {formatTime12Or24(occurrence.endTime, use24Hour)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{formatDurationAr(occurrence.startTime, occurrence.endTime)}</span>
                            {occurrence.reminders.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <Bell className="w-3 h-3 shrink-0" />
                                  <span>{occurrence.reminders.length} تنبيه</span>
                                </span>
                              </>
                            )}
                            {occurrence.location && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 truncate max-w-[180px]">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate">{occurrence.location}</span>
                                </span>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {heightPx >= 90 && occurrence.description && (
                        <p className="text-xs opacity-75 line-clamp-2 mt-1">
                          {occurrence.description}
                        </p>
                      )}
                    </div>

                    {/* Completion toggle button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleComplete(occurrence);
                      }}
                      title={occurrence.isCompleted ? 'إلغاء الإكمال' : 'تحديد كمكتمل'}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                        occurrence.isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'bg-white/80 dark:bg-slate-900/70 border-slate-300 dark:border-slate-600 hover:border-blue-500'
                      }`}
                    >
                      {occurrence.isCompleted && <Check className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
