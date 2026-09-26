import { Link, useLoaderData } from "react-router";

import { PATHS } from "../routes";
import type { Targets as TargetFigures } from "../types/targets";
import "./dashboard.css";

function Areas() {
  // Built inside the component, not as a module constant. routes.tsx imports
  // this file through the pages barrel and this file imports PATHS back from
  // routes.tsx, so the two modules are circular: at evaluation time PATHS is
  // still undefined, and only code that runs after both modules have settled
  // may read it. app-layout.tsx builds its own list inside its component for
  // the same reason. Moving this to the top level compiles and lints cleanly
  // and crashes the application on load.
  //
  // The three principal areas, in the order report.md section 7.4 names them.
  // Each carries a line saying what the area is for, which is why this screen
  // earns its place beside the navigation in the shell: the shell offers six
  // destinations and explains none of them.
  //
  // The labels match the shell's, deliberately. The wireframe in
  // doc/asset/diagrams.drawio calls the middle one "Weekly planner" while the
  // shell calls it "Planner", and two names for one destination on the same
  // page costs more than the fuller name gains -- so the sense the wireframe
  // wanted is in the description instead.
  const areas = [
    {
      to: PATHS.recipes,
      label: "Recipes",
      blurb:
        "Your own library, with the nutrition you entered for each recipe.",
    },
    {
      to: PATHS.planner,
      label: "Planner",
      blurb: "A week of seven days against breakfast, lunch and dinner.",
    },
    {
      to: PATHS.account,
      label: "Account",
      blurb:
        "Your details, and the measurements your targets are worked out from.",
    },
  ];

  return (
    <nav className="dashboard__areas" aria-label="Areas">
      <ul className="dashboard__area-list">
        {areas.map((area) => (
          <li key={area.to}>
            <Link className="dashboard__area" to={area.to}>
              <span className="dashboard__area-label">{area.label}</span>
              <span className="dashboard__area-blurb">{area.blurb}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function Dashboard() {
  const targets = useLoaderData() as TargetFigures | null;

  // Null is the 404 the loader caught: no measurements saved, so there is
  // nothing to compute a target from. It is not an error and is not announced
  // as one. This is the screen a returning user lands on and the screen a
  // fresh sign-in is now sent to unconditionally, so it is the one place that
  // has to say what is missing -- ADR 004 in nomadwiz/kete-doc.
  //
  // The areas render either way. A user who has not supplied measurements can
  // still write recipes, and a hub that withholds the hub until a form is
  // filled in is a redirect wearing different clothes.
  if (!targets) {
    return (
      <div className="dashboard">
        <h1 className="dashboard__title">Dashboard</h1>

        <p className="dashboard__lede">
          Kete works your daily target out from your body measurements, and
          there are none saved yet.
        </p>

        <Link className="dashboard__link" to={PATHS.measurements}>
          Add your measurements
        </Link>

        <Areas />
      </div>
    );
  }

  // The same four figures the targets screen draws, in the same order and the
  // same wording, with the unit inside the value and no arithmetic here. The
  // fixed en-NZ locale is for the thousands separator, for the reason
  // targets.tsx records about the screenshots that reach the report.
  const rows = [
    {
      label: "Daily energy",
      value: `${targets.energy_kcal.toLocaleString("en-NZ")} kcal`,
    },
    { label: "Protein", value: `${targets.protein_g} g` },
    { label: "Carbs", value: `${targets.carbs_g} g` },
    { label: "Fat", value: `${targets.fat_g} g` },
  ];

  return (
    <div className="dashboard">
      <h1 className="dashboard__title">Dashboard</h1>

      <section className="dashboard__summary" aria-labelledby="daily-target">
        <h2 className="dashboard__heading" id="daily-target">
          Your daily target
        </h2>

        {/* A description list, for the reason targets.tsx gives: four
            label-and-value pairs is what one is for, and the pairing reaches a
            screen reader from the markup rather than from an ARIA attribute. */}
        <dl className="dashboard__figures">
          {rows.map((row) => (
            <div className="dashboard__row" key={row.label}>
              <dt className="dashboard__label">{row.label}</dt>
              <dd className="dashboard__value">{row.value}</dd>
            </div>
          ))}
        </dl>

        {/* Where the figures come from is answered on /targets, at length and
            in plain words. Repeating that note here would put two copies of
            the same explanation in the application, and the copy carries a
            known gap -- the macronutrient proportions, nomadwiz/kete#251 --
            which is worth fixing in one place rather than two. */}
        <Link className="dashboard__link" to={PATHS.targets}>
          How these are worked out
        </Link>
      </section>

      <Areas />
    </div>
  );
}
