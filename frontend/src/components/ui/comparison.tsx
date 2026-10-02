// A week's totals against the daily targets -- C18 (nomadwiz/kete#182), drawn
// on /planner under the grid and on /dashboard for the current week.
//
// EVERY FIGURE HERE WAS COMPUTED BY THE SERVER. GET /mealplan/summary returns
// total, target, difference and percent for each nutrient on each day (ADR
// 001), rounded there (ADR 007), and this component prints them. It adds,
// subtracts and divides nothing -- doc/design/implementation.md section 1 --
// so the figures on screen and the figures from /docs cannot disagree.
//
// FIGURES, NO VERDICT. doc/design/product.md section 3: no met or unmet label
// and no colour against a threshold, because a tolerance band would be a number
// the project invented. A day 300 kcal under says so and nothing more.
//
// PER DAY, NEVER ACROSS THE WEEK. Same section: an empty Monday balanced by a
// doubled Tuesday is what the comparison exists to show, so there is no weekly
// total row, and the API sends none to print.
//
// ONE TABLE PER NUTRIENT, a row per day and a column per figure. Each is a real
// table for the reason planner.tsx gives for the grid: a screen reader moving
// through it announces "Tuesday, Difference, -1,940" from <th scope> alone.
// Four tables of five narrow columns fit a 320px screen without scrolling,
// where one table of sixteen would not. The unit is in the caption rather than
// in every cell, so the cells hold only digits and line up on them.
//
// No `display` is set on a table here. Changing a table's display strips its
// role from the accessibility tree, and with it the headers.
import type { WeekSummary } from "../../types/plan";

type Day = WeekSummary["days"][number];

const NUTRIENTS: { key: Exclude<keyof Day, "day_of_week">; caption: string }[] =
  [
    { key: "energy_kcal", caption: "Energy (kcal)" },
    { key: "protein_g", caption: "Protein (g)" },
    { key: "carbs_g", caption: "Carbohydrate (g)" },
    { key: "fat_g", caption: "Fat (g)" },
  ];

const COLUMNS = ["Total", "Target", "Difference", "% of target"];

const DAY_NAMES: Record<Day["day_of_week"], string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

// The fixed en-NZ locale every other figure in the client uses, for the reason
// targets.tsx gives about the screenshots that reach the report.
function plain(value: number): string {
  return value.toLocaleString("en-NZ");
}

// The difference with its sign always shown, "+120" or "-1,940", and none on
// zero. A bare "120" beside a "-120" would leave the reader to infer that one
// is over -- the sign is the whole message of this column.
function signed(value: number): string {
  return value.toLocaleString("en-NZ", { signDisplay: "exceptZero" });
}

export function Comparison({ summary }: { summary: WeekSummary }) {
  return (
    // A container query rather than a media query: the planner gives this the
    // full column and the dashboard seven twelfths of it, and two tables side
    // by side want the room, not the viewport.
    <div className="@container">
      <div className="grid gap-8 @2xl:grid-cols-2">
        {NUTRIENTS.map((nutrient) => (
          <table className="w-full border-collapse text-sm" key={nutrient.key}>
            <caption className="pb-2 text-left font-semibold">
              {nutrient.caption}
            </caption>
            <thead>
              <tr className="border-b border-rule text-xs text-muted-foreground">
                {/* Empty, and a td: it heads neither axis -- planner.tsx's
                    corner cell, for the same reason. */}
                <td />
                {COLUMNS.map((column) => (
                  <th
                    className="py-2 pl-1.5 text-right font-normal"
                    key={column}
                    scope="col"
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.days.map((day) => {
                const figure = day[nutrient.key];

                return (
                  <tr className="border-b border-rule" key={day.day_of_week}>
                    <th className="py-2 text-left font-normal" scope="row">
                      {DAY_NAMES[day.day_of_week]}
                    </th>
                    <td className="py-2 pl-1.5 text-right">
                      {plain(figure.total)}
                    </td>
                    <td className="py-2 pl-1.5 text-right">
                      {plain(figure.target)}
                    </td>
                    <td className="py-2 pl-1.5 text-right">
                      {signed(figure.difference)}
                    </td>
                    <td className="py-2 pl-1.5 text-right">
                      {plain(figure.percent)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
      </div>
    </div>
  );
}
