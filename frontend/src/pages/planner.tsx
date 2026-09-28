import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { datesOf, isoWeek, shiftWeek } from "../api/week";
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

  // Whether anything is in flight. Both kinds of submit below are disabled
  // while it is: a second click on Add places the same recipe again and is
  // answered 409, a second Remove is answered 404, and either way the person
  // is shown a failure for an operation that in fact succeeded.
  //
  // The path alone, not the whole formAction, and account.tsx says why: a
  // <Form> declaring no action prop does not submit to the bare path, because
  // useFormAction in react-router 8.4.0 copies the current query string into
  // it. This is the screen that puts the week in the query string, so the
  // equality against the whole thing would be false for every submission this
  // page ever makes. C25 (nomadwiz/kete#277) is landing a shared helper; take
  // it when it does.
  const busy = navigation.formAction?.split("?")[0] === PATHS.planner;

  // One pass over the answer rather than a scan of it in each of twenty-one
  // cells. The key pairs the two axes because neither identifies a position on
  // its own, and a PlanSlotOut carries no week -- every slot in this array is
  // in the week that was asked for, by construction.
  const placed = new Map(
    slots.map((slot) => [`${slot.day_of_week}|${slot.meal_position}`, slot]),
  );

  const dates = datesOf(week);
  const library = recipes.length > 0;

  // The two sentences put in front of the whole-week actions, written here
  // rather than inside the handlers so the pair can be read against each
  // other. Both are the platform's own confirmation rather than a <dialog>:
  // window.confirm is modal, focus-trapped and dismissible from the keyboard
  // for no code at all, and jsdom 30 implements no showModal, so a <dialog>
  // here would be exercised against a polyfill instead of against the element.
  // C11 (nomadwiz/kete#176) is landing a <dialog> modal on /recipes; when it
  // does, this is the application's second confirmation and the two should
  // become one.
  //
  // What the first of them has to say is the whole reason the action is
  // confirmed at all. backend/main.py empties the week before it deals, and
  // answers created: 21 whichever week it was given, so a planned week is
  // discarded by a button whose label otherwise reads like an addition. And it
  // deals the library out in turn without reading the targets -- the
  // 15-09-2026 decision puts choosing recipes to hit them out of scope, and
  // product.md section 5 says the built version does not -- so any word here
  // suggesting the week is balanced, optimised or chosen for the person would
  // be a claim about a system that does not do it.
  const replacesTheWeek = `Fill every position in ${week} from your library?\n\nWhatever is already planned for this week is replaced. Recipes are dealt out from your library in turn, and none is chosen to meet your targets.`;

  // Clearing destroys as much as filling does and has no undo either, and the
  // API offers no way back, so it is asked the same question rather than a
  // lighter one. What differs is what survives it, which the server's own
  // description of that route says: "Recipes themselves are untouched."
  const emptiesTheWeek = `Clear everything planned for ${week}?\n\nThe whole week is emptied and there is no undo. Your recipes are not touched.`;

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
            {/* formatRange rather than two formats and a hand-written "to":
                the same formatter elides the parts the two dates share, and
                keeps the month and the year when the week crosses one. */}
            {WEEK_RANGE.formatRange(dates[0], dates[6])}
          </span>

          {/* Always, rather than only when you have wandered off. A link back
              to the week you are already on costs nothing and does nothing,
              and the branch that hides it would have to ask what day it is
              during a render -- which is a second place computing the current
              week, and the one thing this screen has to get right. */}
          <Link
            className="planner__today"
            to={{ search: `?${QUERY.week}=${isoWeek(new Date())}` }}
          >
            This week
          </Link>
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

      {/* Both of these act on the whole week rather than on a position, so
          they sit above the grid rather than in it.

          Only when there is a library. With none there is nothing to fill the
          week from, nothing can have been placed in it to clear, and the
          paragraph above already says where to go instead. Nothing here reads
          the library a second time to disable the button, though: the loader's
          copy of it can be stale, and a library emptied in another tab is
          precisely what the 400 answers.

          "Fill the week from your library" and not "Generate": the label says
          where the recipes come from, which is the library and not a
          calculation, and it is read by everyone who never opens the
          confirmation. */}
      {library ? (
        <div className="planner__actions">
          <Form
            method="post"
            onSubmit={(event) => {
              // react-router's Form runs this handler first and stops on a
              // prevented default, so a declined confirmation sends no
              // request at all rather than one that is thrown away.
              if (!window.confirm(replacesTheWeek)) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="generate" />
            <input type="hidden" name="week" value={week} />
            <button className="planner__fill" type="submit" disabled={busy}>
              Fill the week from your library
            </button>
          </Form>

          <Form
            method="post"
            onSubmit={(event) => {
              if (!window.confirm(emptiesTheWeek)) {
                event.preventDefault();
              }
            }}
          >
            <input type="hidden" name="intent" value="clear" />
            <input type="hidden" name="week" value={week} />
            <button className="planner__clear" type="submit" disabled={busy}>
              Clear the week
            </button>
          </Form>
        </div>
      ) : null}

      <table className="planner__grid" aria-busy={busy}>
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
                            disabled={busy}
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
                          disabled={busy}
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
