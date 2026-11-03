import { DateTime } from 'luxon';

export function isValidTimezone(timeZone: string): boolean {
  return DateTime.now().setZone(timeZone).isValid;
}

export function localToday(timeZone: string, now = new Date()): string {
  return DateTime.fromJSDate(now, { zone: timeZone }).toISODate() ?? '1970-01-01';
}

export function addDays(isoDate: string, days: number, timeZone: string): string {
  const next = DateTime.fromISO(isoDate, { zone: timeZone }).plus({ days }).toISODate();
  if (!next) {
    throw new Error('Invalid date');
  }
  return next;
}

export function diffLocalDays(fromIso: string, toIso: string, timeZone: string): number {
  const from = DateTime.fromISO(fromIso, { zone: timeZone }).startOf('day');
  const to = DateTime.fromISO(toIso, { zone: timeZone }).startOf('day');
  return Math.round(to.diff(from, 'days').days);
}

export function localParts(timeZone: string, now = new Date()) {
  const value = DateTime.fromJSDate(now, { zone: timeZone });
  return {
    date: value.toISODate() ?? '1970-01-01',
    time: value.toFormat('HH:mm'),
    dateTime: value,
  };
}

export function toScheduledDate(isoDate: string, timeZone: string): Date {
  const value = DateTime.fromISO(isoDate, { zone: timeZone }).startOf('day');
  if (!value.isValid) {
    throw new Error('Invalid date');
  }
  return value.toJSDate();
}

export function weekStart(timeZone: string, now = new Date()): string {
  const today = DateTime.fromJSDate(now, { zone: timeZone }).startOf('day');
  return today.minus({ days: today.weekday - 1 }).toISODate() ?? localToday(timeZone, now);
}

export function monthStart(timeZone: string, now = new Date()): string {
  return DateTime.fromJSDate(now, { zone: timeZone }).startOf('month').toISODate() ?? localToday(timeZone, now);
}

export function monthEnd(timeZone: string, now = new Date()): string {
  return DateTime.fromJSDate(now, { zone: timeZone }).endOf('month').toISODate() ?? localToday(timeZone, now);
}
