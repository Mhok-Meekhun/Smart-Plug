export interface RepeatingSchedule {
  localTime: string;
  weekdays: readonly number[];
  timezone: string;
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute"), second: value("second") };
}

function localDateTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timezone: string) {
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = desired;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const shown = zonedParts(new Date(guess), timezone);
    const shownAsUtc = Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute, shown.second);
    const difference = desired - shownAsUtc;
    if (difference === 0) break;
    guess += difference;
  }
  return new Date(guess);
}

export function nextRepeatingRun(schedule: RepeatingSchedule, after: Date): Date {
  const match = /^(\d{2}):(\d{2})$/.exec(schedule.localTime);
  if (!match) throw new RangeError("localTime must use HH:mm");
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) throw new RangeError("localTime is outside clock range");
  const weekdays = new Set(schedule.weekdays);
  if (!weekdays.size || [...weekdays].some((day) => !Number.isInteger(day) || day < 0 || day > 6)) throw new RangeError("weekdays must contain values from 0 to 6");

  const local = zonedParts(after, schedule.timezone);
  const localMidnight = Date.UTC(local.year, local.month - 1, local.day);
  for (let offset = 0; offset <= 7; offset += 1) {
    const localDate = new Date(localMidnight + offset * 86_400_000);
    if (!weekdays.has(localDate.getUTCDay())) continue;
    const candidate = localDateTimeToUtc(localDate.getUTCFullYear(), localDate.getUTCMonth() + 1, localDate.getUTCDate(), hour, minute, schedule.timezone);
    if (candidate.getTime() > after.getTime()) return candidate;
  }
  throw new RangeError("Could not calculate the next schedule occurrence");
}
