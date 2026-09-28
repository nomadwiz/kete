// The ISO 8601 week the API asks for, and the two steps either side of it.
// GET /mealplan, POST /mealplan and DELETE /mealplan/week/{week} all take a
// week in this shape and all enforce the same pattern, which a wrong answer
// still satisfies: 2027-W53 is well formed, matches, and names seven days that
// do not exist. So the rule lives here rather than at a call site, with a test
// beside it, because the only week of the year it is visibly wrong in is the
// one nobody is looking at.
//
// Two facts decide everything below. An ISO week runs Monday to Sunday, and a
// week belongs to the year its Thursday falls in -- equivalently, week 1 is the
// week containing 4 January. That second year is the ISO week-numbering year
// and it is not always the calendar year: 2027-01-01 is a Friday, so it sits in
// the week beginning Monday 2026-12-28, whose Thursday is 2026-12-31, and the
// week is therefore 2026-W53. Python spells the distinction %G against %Y;
// JavaScript spells it neither, which is why this file exists.
//
// No date library for a dozen lines of arithmetic, and no local-clock
// arithmetic either: a local day is 23 or 25 hours twice a year, so adding
// seven days in milliseconds on a local clock can land on the wrong date. Local
// time is read once, at the door, and everything after that is UTC.

const DAY = 86_400_000;

// The pattern the API enforces, so a week arriving from the address bar can be
// checked against the same rule before it is sent anywhere.
export const WEEK_PATTERN = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;

function weekOf(utcMs: number): string {
  // Move to the Thursday of this week. getUTCDay() numbers Sunday 0, so the
  // `|| 7` restates Sunday as the seventh day and makes Monday the first,
  // which is the order ISO counts in.
  const thursday = new Date(utcMs);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));

  // That Thursday's calendar year is the week-numbering year, by definition,
  // and 1 January of it is always in week 1 -- so the count of whole weeks
  // between the two, plus one, is the week number.
  const year = thursday.getUTCFullYear();
  const elapsed = (thursday.getTime() - Date.UTC(year, 0, 1)) / DAY;
  const week = Math.floor(elapsed / 7) + 1;

  return `${year}-W${String(week).padStart(2, "0")}`;
}

function mondayOfUtc(week: string): number {
  const [year, number] = week.split("-W").map(Number);

  // 4 January is in week 1 whatever day it falls on, so the Monday of week 1
  // is the Monday on or before it, and every later week is a multiple of seven
  // days from there.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday1 = jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * DAY;

  return monday1 + (number - 1) * 7 * DAY;
}

// The week a date falls in. The date is read in the viewer's own calendar --
// `new Date()` on a phone in Auckland means the day it is in Auckland -- and
// converted to a UTC midnight, after which no time zone is involved.
export function isoWeek(date: Date): string {
  return weekOf(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

// The week `by` weeks away, which is how previous and next are built. It goes
// through the calendar rather than through the number, because week 1 does not
// always follow week 52: 2026-W53 exists and 2025-W53 does not.
export function shiftWeek(week: string, by: number): string {
  return weekOf(mondayOfUtc(week) + by * 7 * DAY);
}

// The seven dates of a week, Monday first, as UTC midnights. The grid puts the
// date in each day's column header, so a person navigating weeks is looking at
// something other than a week number.
export function datesOf(week: string): Date[] {
  const monday = mondayOfUtc(week);

  return Array.from({ length: 7 }, (_, day) => new Date(monday + day * DAY));
}

// Whether a string names a week that exists. The pattern is not enough on its
// own: it admits 53 in every year, and only a long year has a 53rd week, so
// 2025-W53 matches it and names the seven days that in fact belong to
// 2026-W01. Stepping zero weeks goes out through the calendar and back, so a
// string that survives the round trip is a week and one that does not is a
// bucket nothing can navigate to a second time.
export function isWeek(week: string): boolean {
  return WEEK_PATTERN.test(week) && shiftWeek(week, 0) === week;
}
