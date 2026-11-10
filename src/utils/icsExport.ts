import { Appointment, AppointmentCategory, RecurrenceFrequency } from '../types/schedule';
import { toRRuleString } from './recurrence';

function toIcsDateTime(dateStr: string, timeStr: string): string {
  const d = dateStr.replace(/-/g, '');
  const [hh, mm] = timeStr.split(':');
  return `${d}T${(hh || '00').padStart(2, '0')}${(mm || '00').padStart(2, '0')}00`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

export function generateICS(appointments: Appointment[]): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Miqat Schedule App//AR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  const stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  for (const appt of appointments) {
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${appt.id}@miqat.local`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART:${toIcsDateTime(appt.date, appt.startTime)}`);
    lines.push(`DTEND:${toIcsDateTime(appt.date, appt.endTime)}`);
    lines.push(`SUMMARY:${escapeIcsText(appt.title)}`);

    if (appt.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(appt.description)}`);
    }
    if (appt.location) {
      lines.push(`LOCATION:${escapeIcsText(appt.location)}`);
    }

    const rrule = toRRuleString(appt.recurrence);
    if (rrule) {
      lines.push(`RRULE:${rrule}`);
    }

    if (appt.excludedDates && appt.excludedDates.length > 0) {
      const exdates = appt.excludedDates.map((d) => toIcsDateTime(d, appt.startTime)).join(',');
      lines.push(`EXDATE:${exdates}`);
    }

    for (const mins of appt.reminders) {
      lines.push('BEGIN:VALARM');
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeIcsText(appt.title)}`);
      lines.push(`TRIGGER:-PT${Math.max(0, mins)}M`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(appointments: Appointment[], filename = 'miqat-schedule.ics'): void {
  const ics = generateICS(appointments);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/** Parse basic VEVENT entries from an exported .ics file (e.g. from Google Calendar) */
export function parseICS(icsContent: string): Omit<Appointment, 'id' | 'createdAt'>[] {
  const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const rawEvents = unfolded.split('BEGIN:VEVENT').slice(1);
  const parsed: Omit<Appointment, 'id' | 'createdAt'>[] = [];

  for (const raw of rawEvents) {
    const block = raw.split('END:VEVENT')[0] || '';
    const lines = block.split(/\r?\n/);

    let summary = '';
    let description = '';
    let location = '';
    let dtStart = '';
    let dtEnd = '';
    let rruleRaw = '';

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).split(';')[0].toUpperCase();
      const val = line.slice(colonIdx + 1).trim();

      if (key === 'SUMMARY') summary = val.replace(/\\n/g, '\n').replace(/\\,/g, ',');
      if (key === 'DESCRIPTION') description = val.replace(/\\n/g, '\n').replace(/\\,/g, ',');
      if (key === 'LOCATION') location = val.replace(/\\,/g, ',');
      if (key === 'DTSTART') dtStart = val;
      if (key === 'DTEND') dtEnd = val;
      if (key === 'RRULE') rruleRaw = val;
    }

    if (!summary || !dtStart) continue;

    const parseIcsDate = (rawDt: string): { date: string; time: string } => {
      const clean = rawDt.replace('Z', '');
      const y = clean.slice(0, 4);
      const m = clean.slice(4, 6);
      const d = clean.slice(6, 8);
      if (clean.includes('T') && clean.length >= 13) {
        const hh = clean.slice(9, 11);
        const mm = clean.slice(11, 13);
        return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}` };
      }
      return { date: `${y}-${m}-${d}`, time: '09:00' };
    };

    const startParsed = parseIcsDate(dtStart);
    const endParsed = dtEnd ? parseIcsDate(dtEnd) : { date: startParsed.date, time: '10:00' };

    let frequency: RecurrenceFrequency = 'none';
    let endDate: string | undefined;

    if (rruleRaw) {
      const freqMatch = rruleRaw.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/i);
      if (freqMatch) {
        frequency = freqMatch[1].toLowerCase() as RecurrenceFrequency;
      }
      const untilMatch = rruleRaw.match(/UNTIL=(\d{4})(\d{2})(\d{2})/i);
      if (untilMatch) {
        endDate = `${untilMatch[1]}-${untilMatch[2]}-${untilMatch[3]}`;
      }
    }

    const category: AppointmentCategory = 'meeting';

    parsed.push({
      title: summary,
      description: description || undefined,
      location: location || undefined,
      date: startParsed.date,
      startTime: startParsed.time,
      endTime: endParsed.time === startParsed.time ? '10:00' : endParsed.time,
      category,
      recurrence: { frequency, endDate },
      reminders: [15],
      calendarSource: 'google',
    });
  }

  return parsed;
}

/** Build a direct Google Calendar "Add Event" link preserving recurrence RRULE */
export function buildGoogleCalendarTemplateUrl(
  appt: Appointment,
  occurrenceDate?: string
): string {
  const dateToUse = occurrenceDate || appt.date;
  const startDt = toIcsDateTime(dateToUse, appt.startTime);
  const endDt = toIcsDateTime(dateToUse, appt.endTime);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: appt.title,
    dates: `${startDt}/${endDt}`,
  });

  if (appt.description) params.set('details', appt.description);
  if (appt.location) params.set('location', appt.location);

  const rrule = toRRuleString(appt.recurrence);
  if (rrule && !occurrenceDate) {
    params.set('recur', `RRULE:${rrule}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
