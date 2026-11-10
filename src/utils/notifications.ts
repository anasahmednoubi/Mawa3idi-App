export interface ReminderPreset {
  value: number;
  label: string;
}

export const REMINDER_PRESETS: ReminderPreset[] = [
  { value: 0, label: 'عند بدء الموعد' },
  { value: 5, label: 'قبل 5 دقائق' },
  { value: 10, label: 'قبل 10 دقائق' },
  { value: 15, label: 'قبل 15 دقيقة' },
  { value: 30, label: 'قبل 30 دقيقة' },
  { value: 60, label: 'قبل ساعة' },
  { value: 1440, label: 'قبل يوم' },
];

export function formatReminderMinutes(minutes: number): string {
  const found = REMINDER_PRESETS.find((p) => p.value === minutes);
  if (found) return found.label;
  if (minutes < 60) return `قبل ${minutes} دقيقة`;
  const hrs = Math.round(minutes / 60);
  return hrs === 1 ? 'قبل ساعة' : `قبل ${hrs} ساعات`;
}

/** Play a clean, subtle Web Audio chime without external audio assets */
export function playReminderChime(): void {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [587.33, 880]; // D5 -> A5 gentle fifth interval
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.14 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.14 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.48);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1200);
  } catch {
    // Ignore audio context restrictions
  }
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function sendBrowserNotification(title: string, body: string, tag?: string): void {
  if (!isBrowserNotificationSupported()) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, {
      body,
      tag,
      dir: 'rtl',
      lang: 'ar',
    });
  } catch {
    // Fallback silently if environment blocks Notification constructor
  }
}
