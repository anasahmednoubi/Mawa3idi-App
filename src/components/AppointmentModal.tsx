import React, { useEffect, useState } from 'react';
import {
  Bell,
  CalendarPlus,
  Clock,
  ExternalLink,
  MapPin,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';
import {
  Appointment,
  AppointmentCategory,
  CATEGORIES,
  OccurrenceInstance,
  RECURRENCE_LABELS,
  RecurrenceFrequency,
} from '../types/schedule';
import { buildGoogleCalendarTemplateUrl } from '../utils/icsExport';
import { REMINDER_PRESETS } from '../utils/notifications';
import {
  formatArabicDateShort,
  formatRecurrenceSummary,
  minutesToTime,
  timeToMinutes,
} from '../utils/recurrence';

interface AppointmentModalProps {
  isOpen: boolean;
  initialDate: string;
  initialStartTime: string;
  initialEndTime: string;
  editingOccurrence: OccurrenceInstance | null;
  onClose: () => void;
  onSave: (
    data: Omit<Appointment, 'id' | 'createdAt'>,
    editingId?: string,
    editScope?: 'series' | 'single',
    occurrenceDate?: string
  ) => void;
  onDelete: (
    appointmentId: string,
    scope: 'series' | 'single',
    occurrenceDate?: string
  ) => void;
}

const FREQUENCIES: RecurrenceFrequency[] = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

const DURATION_PRESETS = [
  { label: '30 د', minutes: 30 },
  { label: '45 د', minutes: 45 },
  { label: '1 س', minutes: 60 },
  { label: '2 س', minutes: 120 },
];

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  initialDate,
  initialStartTime,
  initialEndTime,
  editingOccurrence,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [category, setCategory] = useState<AppointmentCategory>('work');
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('none');
  const [hasEndDate, setHasEndDate] = useState(false);
  const [endDate, setEndDate] = useState('');
  const [reminders, setReminders] = useState<number[]>([15]);
  const [error, setError] = useState('');
  const [confirmDeleteMode, setConfirmDeleteMode] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError('');
    setConfirmDeleteMode(false);

    if (editingOccurrence) {
      setTitle(editingOccurrence.title);
      setDescription(editingOccurrence.description || '');
      setLocation(editingOccurrence.location || '');
      setDate(editingOccurrence.date);
      setStartTime(editingOccurrence.startTime);
      setEndTime(editingOccurrence.endTime);
      setCategory(editingOccurrence.category);
      setFrequency(editingOccurrence.recurrence.frequency);
      setHasEndDate(Boolean(editingOccurrence.recurrence.endDate));
      setEndDate(editingOccurrence.recurrence.endDate || '');
      setReminders(editingOccurrence.reminders);
    } else {
      setTitle('');
      setDescription('');
      setLocation('');
      setDate(initialDate);
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setCategory('work');
      setFrequency('none');
      setHasEndDate(false);
      setEndDate('');
      setReminders([15]);
    }
  }, [isOpen, editingOccurrence, initialDate, initialStartTime, initialEndTime]);

  if (!isOpen) return null;

  const isEditing = Boolean(editingOccurrence);
  const isRecurringSeries = Boolean(
    editingOccurrence && editingOccurrence.recurrence.frequency !== 'none'
  );

  const toggleReminder = (mins: number) => {
    setReminders((prev) =>
      prev.includes(mins) ? prev.filter((m) => m !== mins) : [...prev, mins].sort((a, b) => b - a)
    );
  };

  const applyDuration = (minutes: number) => {
    const startMin = timeToMinutes(startTime);
    setEndTime(minutesToTime(Math.min(23 * 60 + 55, startMin + minutes)));
  };

  const validateAndBuildPayload = (): Omit<Appointment, 'id' | 'createdAt'> | null => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('يرجى إدخال عنوان الموعد.');
      return null;
    }
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setError('يجب أن يكون وقت الانتهاء بعد وقت البدء.');
      return null;
    }
    if (frequency !== 'none' && hasEndDate) {
      if (!endDate) {
        setError('يرجى تحديد تاريخ انتهاء التكرار أو اختيار تكرار مفتوح.');
        return null;
      }
      if (endDate < date) {
        setError('تاريخ انتهاء التكرار يجب أن يكون مساوياً أو بعد تاريخ بدء الموعد.');
        return null;
      }
    }

    return {
      title: trimmedTitle,
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      date,
      startTime,
      endTime,
      category,
      recurrence: {
        frequency,
        endDate: frequency !== 'none' && hasEndDate && endDate ? endDate : undefined,
      },
      reminders,
      excludedDates: editingOccurrence?.excludedDates,
      completedDates: editingOccurrence?.completedDates,
      calendarSource: editingOccurrence?.calendarSource || 'local',
      googleEventId: editingOccurrence?.googleEventId,
    };
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = validateAndBuildPayload();
    if (!payload) return;
    onSave(
      payload,
      editingOccurrence?.id,
      'series',
      editingOccurrence?.occurrenceDate
    );
    onClose();
  };

  const handleSaveSingleOccurrence = () => {
    const payload = validateAndBuildPayload();
    if (!payload || !editingOccurrence) return;
    onSave(payload, editingOccurrence.id, 'single', editingOccurrence.occurrenceDate);
    onClose();
  };

  const previewRule = {
    frequency,
    endDate: frequency !== 'none' && hasEndDate && endDate ? endDate : undefined,
  };

  const googleQuickAddUrl = editingOccurrence
    ? buildGoogleCalendarTemplateUrl(editingOccurrence)
    : title.trim()
      ? buildGoogleCalendarTemplateUrl({
          id: 'preview',
          title: title.trim(),
          description: description.trim() || undefined,
          location: location.trim() || undefined,
          date,
          startTime,
          endTime,
          category,
          recurrence: previewRule,
          reminders,
          createdAt: '',
        })
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="appointment-modal-title"
    >
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <CalendarPlus className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2
              id="appointment-modal-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              {isEditing ? 'تعديل الموعد' : 'إضافة موعد جديد'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="px-4 py-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              عنوان الموعد
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: اجتماع مراجعة المشروع الأسبوعي"
              className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              autoFocus
            />
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                تاريخ البدء
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                من الساعة
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                إلى الساعة
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono-nums bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Quick Duration Buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              <span>مدة سريعة:</span>
            </span>
            <div className="flex items-center gap-1.5">
              {DURATION_PRESETS.map((preset) => (
                <button
                  key={preset.minutes}
                  type="button"
                  onClick={() => applyDuration(preset.minutes)}
                  className="px-2.5 py-1 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              التصنيف
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {Object.values(CATEGORIES).map((cat) => {
                const active = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-2.5 py-2 rounded-lg border text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? `${cat.surfaceClass} ${cat.borderClass} ${cat.textClass} ring-1 ring-blue-600/30`
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-xs shrink-0 ${cat.swatchClass}`} />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Recurrence Configuration */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <Repeat className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>تكرار الموعد</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatRecurrenceSummary(previewRule, date)}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-lg">
              {FREQUENCIES.map((freq) => {
                const active = frequency === freq;
                return (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setFrequency(freq)}
                    className={`py-1.5 px-2 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {RECURRENCE_LABELS[freq]}
                  </button>
                );
              })}
            </div>

            {frequency !== 'none' && (
              <div className="pt-1 space-y-2.5">
                <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  نهاية التكرار
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
                  <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setHasEndDate(false)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        !hasEndDate
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      مفتوح (بدون انتهاء)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHasEndDate(true)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        hasEndDate
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      تاريخ انتهاء محدد
                    </button>
                  </div>

                  {hasEndDate && (
                    <input
                      type="date"
                      min={date}
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-1.5 text-sm font-mono-nums bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Reminders Configuration */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Bell className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>التنبيهات والتذكيرات على الموعد</span>
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {reminders.length === 0 ? 'بدون تذكير' : `${reminders.length} تنبيه مفعّل`}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {REMINDER_PRESETS.map((preset) => {
                const selected = reminders.includes(preset.value);
                return (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => toggleReminder(preset.value)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                      selected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Location & Notes */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>المكان أو رابط الاجتماع (اختياري)</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثال: Google Meet أو قاعة الاجتماعات"
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                ملاحظات إضافية (اختياري)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="أضف تفاصيل أو أجندة الموعد..."
                className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 resize-none"
              />
            </div>
          </div>

          {/* Delete Confirmation Box */}
          {isEditing && confirmDeleteMode && editingOccurrence && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-3">
              <p className="text-xs font-semibold text-rose-900 dark:text-rose-200">
                {isRecurringSeries
                  ? `هل تريد حذف هذا الموعد (${formatArabicDateShort(editingOccurrence.occurrenceDate)}) فقط أم حذف سلسلة التكرار بالكامل؟`
                  : `هل أنت متأكد من حذف الموعد "${editingOccurrence.title}"؟ لا يمكن التراجع عن هذا الإجراء.`}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {isRecurringSeries && (
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(
                        editingOccurrence.id,
                        'single',
                        editingOccurrence.occurrenceDate
                      );
                      onClose();
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/40 cursor-pointer"
                  >
                    حذف هذا اليوم فقط
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onDelete(editingOccurrence.id, 'series');
                    onClose();
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                >
                  {isRecurringSeries ? 'حذف السلسلة بالكامل' : 'تأكيد الحذف'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteMode(false)}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isEditing && !confirmDeleteMode && (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteMode(true)}
                  className="px-3 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف</span>
                </button>
              )}

              {googleQuickAddUrl && (
                <a
                  href={googleQuickAddUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>إضافة لـ Google Calendar</span>
                </a>
              )}
            </div>

            <div className="flex items-center gap-2 ms-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                إلغاء
              </button>

              {isEditing && isRecurringSeries && (
                <button
                  type="button"
                  onClick={handleSaveSingleOccurrence}
                  className="px-3.5 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  تعديل هذا اليوم فقط
                </button>
              )}

              <button
                type="submit"
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {isEditing
                  ? isRecurringSeries
                    ? 'حفظ لكل السلسلة'
                    : 'حفظ التعديلات'
                  : 'حفظ الموعد'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
