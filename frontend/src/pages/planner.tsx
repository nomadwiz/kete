import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { datesOf, shiftWeek } from "../api/week";
import { PATHS, QUERY } from "../routes";
import type { DayOfWeek, MealPosition, PlanWeek } from "../types/plan";
import "./planner.css";

// A table, not a grid of divs, and the trade is worth stating because the
// alternative was the instruction. This is two axes with headers on both: a
// screen reader moving between cells announces "Tuesday, lunch" from <th
// scope="row"> and <th scope="col"> with nothing added, which is the whole
// purpose of the element and is not reproducible in divs without a row of ARIA
// attributes that have to be kept in step by hand.
//
// It costs the CSS Grid this screen would otherwise have been laid out with.
// Setting `display: grid` on a table strips the table role from the
// accessibility tree in every browser -- role is mapped from the computed
// display -- so the headers stop being headers and the reason for choosing the
// element is gone. The two cannot be had together, and the pairing is worth
// more here than the layout technique.
//
// Neither list touches PATHS, so both may be module constants. The comment in
// dashboard.tsx explains the rule they are exempt from: routes.tsx imports
// this file through the pages barrel and this file imports PATHS back, so an
// array built at module level that reads PATHS reads undefined and crashes the
// application on load, lint and build both clean.
const DAYS: { code: DayOfWeek; name: string }[] = [
  { code: "Mon", name: "Monday" },
  { code: "Tue", name: "Tuesday" },
  { code: "Wed", name: "Wednesday" },
  { code: "Thu", name: "Thursday" },
  { code: "Fri", name: "Friday" },
  { code: "Sat", name: "Saturday" },
  { code: "Sun", name: "Sunday" },
];

const MEALS: { code: MealPosition; name: string }[] = [
  { code: "breakfast", name: "Breakfast" },
  { code: "lunch", name: "Lunch" },
  { code: "dinner", name: "Dinner" },
];

// Fixed locales, for the reason targets.tsx records about the screenshots that
// reach the report: the machine's own locale would reorder the parts. The UTC
// zone is not decoration -- datesOf answers UTC midnights, and formatting one
// of those on a zone behind UTC prints the day before.
const DAY_DATE = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const WEEK_RANGE = new Intl.DateTimeFormat("en-NZ", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function Planner() {
  const { week, slots, recipes } = useLoaderData() as PlanWeek;
  const error = useActionData() as string | null | undefined;
  const navigation = useNavigation();

  // One pass over the answer rather than a scan of it in each of twenty-one
  // cells. The key pairs the two axes because neither identifies a position on
  // its own, and a PlanSlotOut carries no week -- every slot in this array is
  // in the week that was asked for, by construction.
  const placed = new Map(
    slots.map((slot) => [`${slot.day_of_week}|${slot.meal_position}`, slot]),
  );

  const dates = datesOf(week);
  const library = recipes.length > 0;

  return (
    <div className="planner">
      <h1 className="planner__title">Planner</h1>

      <nav className="planner__weeks" aria-label="Week">
        <Link
          className="planner__step"
          to={{ search: `?${QUERY.week}=${shiftWeek(week, -1)}` }}
        >
          Previous week
        </Link>

        <p className="planner__week">
          {week}
          <span className="planner__range">
            {WEEK_RANGE.format(dates[0])} to {WEEK_RANGE.format(dates[6])}
          </span>
        </p>

        <Link
          className="planner__step"
          to={{ search: `?${QUERY.week}=${shiftWeek(week, 1)}` }}
        >
          Next week
        </Link>
      </nav>

      {error ? (
        <p className="planner__error" role="alert">
          {error}
        </p>
      ) : null}

      {/* Two different empty states, because they want two different answers.
          A week with nothing in it is ordinary and is simply said; a library
          with nothing in it is why every position below is offering no choice,
          and the only thing to do about it is elsewhere. */}
      {!library ? (
        <p className="planner__empty">
          There is nothing to plan with yet.{" "}
          <Link to={PATHS.recipes}>Write your first recipe</Link>, then come
          back and put it in a day.
        </p>
      ) : slots.length === 0 ? (
        <p className="planner__empty">
          Nothing is planned for this week yet. Choose a recipe in any position
          below.
        </p>
      ) : null}

      <table className="planner__grid" aria-busy={navigation.state !== "idle"}>
        {/* The caption is the table's accessible name, given by the element
            rather than by an attribute pointing at it. */}
        <caption className="planner__caption">
          Seven days against breakfast, lunch and dinner, for {week}.
        </caption>

        <thead>
          <tr>
            {/* Empty, and a td rather than a th: it heads neither the row of
                meal names nor the column of days, and a th with nothing in it
                is announced as a header that has no name. */}
            <td className="planner__corner" />
            {MEALS.map((meal) => (
              <th className="planner__meal" scope="col" key={meal.code}>
                {meal.name}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {DAYS.map((day, index) => (
            <tr key={day.code}>
              <th className="planner__day" scope="row">
                {day.name}
                <span className="planner__date">
                  {DAY_DATE.format(dates[index])}
                </span>
              </th>

              {MEALS.map((meal) => {
                const slot = placed.get(`${day.code}|${meal.code}`);
                const position = `${day.name} ${meal.name.toLowerCase()}`;

                return (
                  <td className="planner__cell" key={meal.code}>
                    {slot ? (
                      <>
                        <span className="planner__recipe">
                          {slot.recipe.name}
                        </span>

                        {/* The figure the server computed for one serving of
                            this recipe, printed as sent. Nothing on this
                            screen adds any of them up: the day's and the
                            week's totals against the target are C18
                            (nomadwiz/kete#182), from an endpoint that does the
                            arithmetic. */}
                        <span className="planner__energy">
                          {slot.recipe.energy_kcal.toLocaleString("en-NZ")} kcal
                        </span>

                        <Form method="post">
                          <input type="hidden" name="intent" value="remove" />
                          <input
                            type="hidden"
                            name="slot_id"
                            value={slot.slot_id}
                          />
                          <button
                            className="planner__remove"
                            type="submit"
                            aria-label={`Remove ${slot.recipe.name} from ${position}`}
                          >
                            Remove
                          </button>
                        </Form>
                      </>
                    ) : library ? (
                      <Form className="planner__place" method="post">
                        <input type="hidden" name="intent" value="place" />
                        <input type="hidden" name="week" value={week} />
                        <input
                          type="hidden"
                          name="day_of_week"
                          value={day.code}
                        />
                        <input
                          type="hidden"
                          name="meal_position"
                          value={meal.code}
                        />

                        {/* Uncontrolled, with no onChange and no submit on
                            selection: a select that navigates the moment it
                            changes cannot be corrected by anyone reaching it
                            from the keyboard, who passes through every option
                            on the way to the one they want. */}
                        <select
                          className="planner__choice"
                          name="recipe_id"
                          defaultValue=""
                          aria-label={`Recipe for ${position}`}
                          required
                        >
                          <option value="">Choose a recipe</option>
                          {recipes.map((recipe) => (
                            <option
                              key={recipe.recipe_id}
                              value={recipe.recipe_id}
                            >
                              {recipe.name}
                            </option>
                          ))}
                        </select>

                        <button
                          className="planner__add"
                          type="submit"
                          aria-label={`Add a recipe to ${position}`}
                        >
                          Add
                        </button>
                      </Form>
                    ) : (
                      <span className="planner__vacant">Empty</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
