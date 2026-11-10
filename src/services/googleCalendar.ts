import { Appointment, AppointmentCategory, RecurrenceFrequency } from '../types/schedule';
import { toRRuleString } from '../utils/recurrence';

export const GOOGLE_CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
];

const configModules = import.meta.glob('/firebase-applet-config.json', { eager: true });

export function isGoogleOAuthProvisioned(): boolean {
  return Object.keys(configModules).length > 0;
}

export interface GoogleCalendarListItem {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
}

interface GoogleEventResource {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  recurrence?: string[];
  reminders?: {
    useDefault?: boolean;
    overrides?: { method: string; minutes: number }[];
  };
}

export async function fetchGoogleCalendars(accessToken: string): Promise<GoogleCalendarListItem[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`فشل جلب قائمة التقويمات (${res.status})`);
  }
  const data = await res.json();
  return (data.items || []) as GoogleCalendarListItem[];
}

export async function fetchGoogleEvents(
  accessToken: string,
  calendarId = 'primary',
  timeMinIso?: string,
  timeMaxIso?: string
): Promise<Appointment[]> {
  const params = new URLSearchParams({
    singleEvents: 'false',
    maxResults: '100',
  });
  if (timeMinIso) params.set('timeMin', timeMinIso);
  if (timeMaxIso) params.set('timeMax', timeMaxIso);

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok) {
    throw new Error(`فشل مزامنة المواعيد من Google Calendar (${res.status})`);
  }

  const data = await res.json();
  const items = (data.items || []) as GoogleEventResource[];

  return items
    .filter((ev) => ev.start?.dateTime || ev.start?.date)
    .map((ev) => mapGoogleEventToAppointment(ev));
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  appt: Appointment,
  calendarId = 'primary'
): Promise<string> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const rrule = toRRuleString(appt.recurrence);

  const body: Record<string, unknown> = {
    summary: appt.title,
    description: appt.description || undefined,
    location: appt.location || undefined,
    start: {
      dateTime: `${appt.date}T${appt.startTime}:00`,
      timeZone: tz,
    },
    end: {
      dateTime: `${appt.date}T${appt.endTime}:00`,
      timeZone: tz,
    },
    reminders: {
      useDefault: false,
      overrides: appt.reminders.map((minutes) => ({ method: 'popup', minutes })),
    },
  };

  if (rrule) {
    body.recurrence = [`RRULE:${rrule}`];
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    throw new Error(`تعذر إنشاء الموعد في Google Calendar (${res.status})`);
  }

  const created = await res.json();
  return created.id as string;
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  googleEventId: string,
  calendarId = 'primary'
): Promise<void> {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(`تعذر حذف الموعد من Google Calendar (${res.status})`);
  }
}

function mapGoogleEventToAppointment(ev: GoogleEventResource): Appointment {
  const startRaw = ev.start?.dateTime || ev.start?.date || '';
  const endRaw = ev.end?.dateTime || ev.end?.date || '';

  const startDate = startRaw.slice(0, 10);
  const startTime = startRaw.includes('T') ? startRaw.slice(11, 16) : '09:00';
  const endTime = endRaw.includes('T') ? endRaw.slice(11, 16) : '10:00';

  let frequency: RecurrenceFrequency = 'none';
  let endDate: string | undefined;

  const rruleEntry = ev.recurrence?.find((r) => r.startsWith('RRULE:'));
  if (rruleEntry) {
    const freqMatch = rruleEntry.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i);
    if (freqMatch) {
      frequency = freqMatch[1].toLowerCase() as RecurrenceFrequency;
    }
    const untilMatch = rruleEntry.match(/UNTIL=(\d{4})(\d{2})(\d{2})/i);
    if (untilMatch) {
      endDate = `${untilMatch[1]}-${untilMatch[2]}-${untilMatch[3]}`;
    }
  }

  const reminders =
    ev.reminders?.overrides?.map((o) => o.minutes) ?? [15];

  const category: AppointmentCategory = 'meeting';

  return {
    id: `gcal_${ev.id}`,
    googleEventId: ev.id,
    calendarSource: 'google',
    title: ev.summary || 'موعد بدون عنوان',
    description: ev.description,
    location: ev.location,
    date: startDate,
    startTime,
    endTime,
    category,
    recurrence: { frequency, endDate },
    reminders,
    createdAt: new Date().toISOString(),
  };
}
