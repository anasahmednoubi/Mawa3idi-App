import React from 'react';
import {
  AlarmClock,
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  Clock,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { ActiveAlert, Appointment, CATEGORIES } from '../types/schedule';
import {
  formatReminderMinutes,
  getBrowserNotificationPermission,
} from '../utils/notifications';
import {
  expandAppointmentsForDate,
  formatTime12Or24,
  getTodayStr,
  timeToMinutes,
} from '../utils/recurrence';

interface ReminderToastsProps {
  alerts: ActiveAlert[];
  use24Hour: boolean;
  onDismiss: (alertKey: string) => void;
  onSnooze: (alertKey: string, snoozeMinutes: number) => void;
}

export const ReminderToasts: React.FC<ReminderToastsProps> = ({
  alerts,
  use24Hour,
  onDismiss,
  onSnooze,
}) => {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-4 start-4 z-50 flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm">
      {alerts.map((alert) => {
        const cat = CATEGORIES[alert.category];
        return (
          <div
            key={alert.alertKey}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0 text-blue-600 dark:text-blue-400">
                  <BellRing className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    <span>تذكير موعد</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatReminderMinutes(alert.offsetMinutes)}</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                    {alert.title}
                  </h4>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono-nums">
                    <span className={`w-2 h-2 rounded-xs ${cat.swatchClass}`} />
                    <span>
                      {formatTime12Or24(alert.startTime, use24Hour)} –{' '}
                      {formatTime12Or24(alert.endTime, use24Hour)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onDismiss(alert.alertKey)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                aria-label="إغلاق التنبيه"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => onSnooze(alert.alertKey, 5)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1 cursor-pointer"
              >
                <AlarmClock className="w-3.5 h-3.5" />
                <span>تأجيل 5 د</span>
              </button>
              <button
                type="button"
                onClick={() => onSnooze(alert.alertKey, 15)}
                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                تأجيل 15 د
              </button>
              <button
                type="button"
                onClick={() => onDismiss(alert.alertKey)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                حسناً
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface ReminderDrawerProps {
  isOpen: boolean;
  appointments: Appointment[];
  soundEnabled: boolean;
  use24Hour: boolean;
  onClose: () => void;
  onToggleSound: () => void;
  onRequestBrowserPermission: () => void;
  onTriggerTestAlert: () => void;
}

export const ReminderDrawer: React.FC<ReminderDrawerProps> = ({
  isOpen,
  appointments,
  soundEnabled,
  use24Hour,
  onClose,
  onToggleSound,
  onRequestBrowserPermission,
  onTriggerTestAlert,
}) => {
  if (!isOpen) return null;

  const today = getTodayStr();
  const todayOccs = expandAppointmentsForDate(appointments, today);
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const permission = getBrowserNotificationPermission();

  const scheduledReminders = todayOccs
    .flatMap((occ) => {
      const startMin = timeToMinutes(occ.startTime);
      return occ.reminders.map((offset) => {
        const triggerMin = startMin - offset;
        return {
          key: `${occ.id}-${offset}`,
          title: occ.title,
          startTime: occ.startTime,
          offset,
          triggerMin,
          category: occ.category,
          passed: triggerMin < nowMinutes,
        };
      });
    })
    .sort((a, b) => a.triggerMin - b.triggerMin);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="مركز التنبيهات والتذكيرات"
    >
      <div className="w-full max-w-md bg-white dark:bg-slate-900 border-s border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              التنبيهات والتذكيرات
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

        <div className="p-5 space-y-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
          {/* Browser Notification Permission */}
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                إشعارات سطح المكتب والمتصفح
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {permission === 'granted'
                  ? 'مفعّلة — ستصلك إشعارات تلقائية قبل كل موعد'
                  : permission === 'denied'
                    ? 'تم حظر الإشعارات من إعدادات المتصفح'
                    : permission === 'unsupported'
                      ? 'المتصفح الحالي لا يدعم إشعارات النظام (التنبيهات الداخلية نشطة)'
                      : 'فعّل الإشعارات لاستلام تنبيه حتى عند تصغير الصفحة'}
              </div>
            </div>

            {permission === 'default' && (
              <button
                type="button"
                onClick={onRequestBrowserPermission}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shrink-0 cursor-pointer"
              >
                تفعيل الآن
              </button>
            )}
            {permission === 'granted' && (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            )}
          </div>

          {/* Sound Toggle & Test Button */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onToggleSound}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>صوت التنبيه: مفعّل</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  <span>صوت التنبيه: صامت</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onTriggerTestAlert}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
            >
              اختبار التنبيه
            </button>
          </div>
        </div>

        {/* Today's Scheduled Reminders List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
            <span>جدول تنبيهات اليوم</span>
            <span className="font-mono-nums text-slate-400">{scheduledReminders.length}</span>
          </div>

          {scheduledReminders.length === 0 ? (
            <div className="py-10 text-center space-y-2 text-slate-500 dark:text-slate-400">
              <BellOff className="w-8 h-8 mx-auto opacity-40" />
              <p className="text-xs">لا توجد تنبيهات مجدولة لليوم.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {scheduledReminders.map((item) => {
                const cat = CATEGORIES[item.category];
                const triggerHours = Math.max(0, Math.floor(item.triggerMin / 60));
                const triggerMins = Math.max(0, item.triggerMin % 60);
                const triggerTimeStr = `${String(triggerHours).padStart(2, '0')}:${String(triggerMins).padStart(2, '0')}`;

                return (
                  <div
                    key={item.key}
                    className={`py-3 flex items-start justify-between gap-3 ${
                      item.passed ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span className={`w-2 h-2 rounded-xs mt-1.5 shrink-0 ${cat.swatchClass}`} />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {item.title}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>{formatReminderMinutes(item.offset)}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-nums">
                            الموعد {formatTime12Or24(item.startTime, use24Hour)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-end shrink-0">
                      <div className="font-mono-nums text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>
                          {item.triggerMin < 0
                            ? 'اليوم السابق'
                            : formatTime12Or24(triggerTimeStr, use24Hour)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {item.passed ? 'انتهى وقته' : 'قادم'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
