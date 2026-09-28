import { describe, expect, it } from "vitest";

import { datesOf, isoWeek, shiftWeek } from "./week";

// Every date here is late December or early January, because that is the only
// time of year a wrong answer is visible. The rest of the year the calendar
// year and the ISO week-numbering year agree, so a %Y-shaped implementation
// passes every check anyone would think to write in, say, March.
//
// How the expected values were derived, from the ISO rule rather than from
// intuition. A week runs Monday to Sunday and belongs to the year its Thursday
// falls in; equivalently, week 1 is the week containing 4 January.
//
//   2027-01-01 is a Friday. So the first Thursday of 2027 is 2027-01-07, and
//   2027-W01 begins on Monday 2027-01-04. The week before it runs Monday
//   2026-12-28 to Sunday 2027-01-03 and its Thursday is 2026-12-31, so its
//   year is 2026. 2026 itself begins on a Thursday, which makes it a 53-week
//   year, so that week is 2026-W53 -- and it swallows the first three days of
//   January 2027, which the calendar year would have called 2027-W53. There is
//   no such week.
//
//   The same slip runs the other way at the start of 2026. 2026-01-01 is a
//   Thursday, so 2026-W01 begins on Monday 2025-12-29, and that Monday belongs
//   to 2026 although its calendar year is 2025. The calendar year would have
//   called it 2025-W01, which is a real week and the wrong one -- it is in
//   fact the week of 2024-12-30.
//
// Cross-checked against Python's `date.strftime("%G-W%V")`, which implements
// the same rule and is what backend/openapi.json names as the correct format.

describe("the ISO week a date falls in", () => {
  it("numbers an ordinary week from the Thursday of it", () => {
    expect(isoWeek(new Date(2026, 8, 24))).toBe("2026-W39");
  });

  it("keeps late December in its own year where the two agree", () => {
    expect(isoWeek(new Date(2026, 11, 27))).toBe("2026-W52");
    expect(isoWeek(new Date(2026, 11, 28))).toBe("2026-W53");
    expect(isoWeek(new Date(2026, 11, 31))).toBe("2026-W53");
  });

  // The whole reason this module exists. A calendar-year implementation
  // answers 2027-W53 for all three, which matches the pattern the API
  // enforces, is accepted, and names a week that has never existed.
  it("keeps early January in the previous week-numbering year", () => {
    expect(isoWeek(new Date(2027, 0, 1))).toBe("2026-W53");
    expect(isoWeek(new Date(2027, 0, 2))).toBe("2026-W53");
    expect(isoWeek(new Date(2027, 0, 3))).toBe("2026-W53");
  });

  it("starts the new year on the Monday of its first week", () => {
    expect(isoWeek(new Date(2027, 0, 4))).toBe("2027-W01");
  });

  // The slip in the other direction: a December date whose week belongs to the
  // year after it. A calendar-year implementation answers 2025-W01, which is a
  // real week fifty-two weeks away from the right one.
  it("pulls the end of December into the following year where the week does", () => {
    expect(isoWeek(new Date(2025, 11, 29))).toBe("2026-W01");
    expect(isoWeek(new Date(2026, 0, 1))).toBe("2026-W01");
  });
});

describe("stepping a week forwards and back", () => {
  it("steps through a 53rd week rather than over it", () => {
    expect(shiftWeek("2026-W52", 1)).toBe("2026-W53");
    expect(shiftWeek("2026-W53", 1)).toBe("2027-W01");
    expect(shiftWeek("2027-W01", -1)).toBe("2026-W53");
  });

  // 2025 has 52 weeks and 2026 has 53, so neither the number nor the year can
  // be decremented on its own -- the step has to go through the calendar.
  it("lands on the last week a year actually has", () => {
    expect(shiftWeek("2026-W01", -1)).toBe("2025-W52");
    expect(shiftWeek("2025-W52", 1)).toBe("2026-W01");
  });

  it("returns where it started after a step each way", () => {
    expect(shiftWeek(shiftWeek("2026-W53", 1), -1)).toBe("2026-W53");
  });
});

describe("the seven dates of a week", () => {
  it("runs Monday to Sunday and crosses the new year with the week", () => {
    const dates = datesOf("2026-W53").map((date) => date.toISOString());

    expect(dates[0]).toBe("2026-12-28T00:00:00.000Z");
    expect(dates[6]).toBe("2027-01-03T00:00:00.000Z");
    expect(dates).toHaveLength(7);
  });
});
