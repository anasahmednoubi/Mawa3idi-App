import React, { useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Download,
  ExternalLink,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react';
import { Appointment } from '../types/schedule';
import {
  GoogleCalendarListItem,
  isGoogleOAuthProvisioned,
} from '../services/googleCalendar';
import { downloadICS, parseICS } from '../utils/icsExport';

interface GoogleCalendarModalProps {
  isOpen: boolean;
  appointments: Appointment[];
  googleAccessToken: string | null;
  googleUserEmail: string | null;
  googleCalendars: GoogleCalendarListItem[];
  isSyncing: boolean;
  syncError: string | null;
  onClose: () => void;
  onImportAppointments: (imported: Omit<Appointment, 'id' | 'createdAt'>[]) => void;
  onSyncFromGoogle?: (calendarId: string) => Promise<void>;
  onPushLocalToGoogle?: (calendarId: string) => Promise<void>;
}

export const GoogleCalendarModal: React.FC<GoogleCalendarModalProps> = ({
  isOpen,
  appointments,
  googleAccessToken,
  googleUserEmail,
  googleCalendars,
  isSyncing,
  syncError,
  onClose,
  onImportAppointments,
  onSyncFromGoogle,
  onPushLocalToGoogle,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCalId, setSelectedCalId] = useState('primary');
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [confirmPushOpen, setConfirmPushOpen] = useState(false);

  if (!isOpen) return null;

  const oauthProvisioned = isGoogleOAuthProvisioned();
  const localCount = appointments.filter((a) => a.calendarSource !== 'google').length;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = parseICS(text);
      if (parsed.length === 0) {
        setImportFeedback('لم يتم العثور على مواعيد صالحة داخل ملف التقويم.');
      } else {
        onImportAppointments(parsed);
        setImportFeedback(`تم استيراد ${parsed.length} موعد بنجاح إلى جدولك اليومي.`);
      }
    } catch {
      setImportFeedback('تعذر قراءة ملف .ics. تأكد من صحة صيغة الملف.');
    }
    e.target.value = '';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-sync-title"
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2
              id="google-sync-title"
              className="text-base font-bold text-slate-900 dark:text-slate-100"
            >
              ربط ومزامنة Google Calendar
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {syncError && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
              {syncError}
            </div>
          )}

          {importFeedback && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{importFeedback}</span>
            </div>
          )}

          {/* Direct Google Account Connection */}
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                الربط المباشر مع حساب Google
              </h3>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {googleAccessToken ? `متصل (${googleUserEmail || 'Google'})` : 'غير متصل حالياً'}
              </span>
            </div>

            {oauthProvisioned && googleAccessToken ? (
              <div className="space-y-3">
                {googleCalendars.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                      التقويم المستهدف
                    </label>
                    <select
                      value={selectedCalId}
                      onChange={(e) => setSelectedCalId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
                    >
                      {googleCalendars.map((cal) => (
                        <option key={cal.id} value={cal.id}>
                          {cal.summary} {cal.primary ? '(الأساسي)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isSyncing}
                    onClick={() => onSyncFromGoogle?.(selectedCalId)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>جلب المواعيد من جوجل</span>
                  </button>

                  <button
                    type="button"
                    disabled={isSyncing || localCount === 0}
                    onClick={() => setConfirmPushOpen(true)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer disabled:opacity-50"
                  >
                    رفع المواعيد المحلية ({localCount})
                  </button>
                </div>

                {confirmPushOpen && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 space-y-2">
                    <p className="text-xs text-amber-900 dark:text-amber-200 font-medium">
                      هل تريد تأكيد إضافة {localCount} موعد محلي (مع قواعد التكرار والتنبيهات) إلى حساب Google Calendar الخاص بك؟
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          setConfirmPushOpen(false);
                          await onPushLocalToGoogle?.(selectedCalId);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                      >
                        تأكيد الإرسال
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmPushOpen(false)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                للمزامنة التلقائية المباشرة مع حسابك، يرجى قبول بطاقة تفعيل صلاحية Google Calendar في الواجهة أولاً. وحتى ذلك الحين، يمكنك التصدير والاستيراد الفوري عبر ملفات التقويم القياسية (.ics) أو إضافة أي موعد مباشرة لـ Google Calendar.
              </p>
            )}
          </div>

          {/* Standard ICS Export & Import (Works 100% with Google Calendar) */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              التصدير والاستيراد المتوافق مع Google Calendar (.ics)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              يحفظ ملف <span className="font-mono-nums">.ics</span> جميع مواعيدك مع تفاصيل التكرار (يومي، أسبوعي، شهري، سنوي وتاريخ الانتهاء) والتنبيهات لفتحها أو استيرادها في Google Calendar بضغطة واحدة.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={appointments.length === 0}
                onClick={() => downloadICS(appointments)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/70 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>تصدير الجدول ({appointments.length})</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/70 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Upload className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>استيراد ملف .ics من جوجل</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ics,text/calendar"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <a
              href="https://calendar.google.com/calendar/u/0/r/settings/export"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline pt-1"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح صفحة الاستيراد والتصدير في Google Calendar</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
