import { Link, useLoaderData } from "react-router";

import { Figures } from "../components/ui/figures";
import { Band, Screen } from "../components/ui/screen";
import { PATHS } from "../routes";
import type { Dashboard as DashboardData } from "../types/plan";

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
    <nav aria-label="Areas">
      <ul className="border-b border-rule">
        {areas.map((area) => (
          <li className="border-t border-rule" key={area.to}>
            <Link className="group grid gap-1 py-4 no-underline" to={area.to}>
              <span className="font-semibold underline decoration-rule decoration-2 underline-offset-4 transition-colors duration-200 group-hover:decoration-accent">
                {area.label}
              </span>
              <span className="max-w-(--measure) text-sm text-muted-foreground">
                {area.blurb}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function Dashboard() {
  const { targets } = useLoaderData() as DashboardData;

  // Null is the 404 the loader caught: no measurements saved, so there is
  // nothing to compute a target from. It is not an error and is not announced
  // as one -- ADR 004 in nomadwiz/kete-doc. The areas render either way: a user
  // who has not supplied measurements can still write recipes, and a hub that
  // withholds the hub until a form is filled in is a redirect wearing different
  // clothes.
  if (!targets) {
    return (
      <Screen
        title="Dashboard"
        lede="Kete works your daily target out from your body measurements, and there are none saved yet."
      >
        <div className="grid gap-10">
          {/* The empty state occupies the space the figures would have, between
              the same two rules, so the structure is intact and only the content
              is absent. No icon and no illustration. */}
          <Band heading="Your daily target">
            <div className="border-t border-rule pt-4">
              <p className="max-w-(--measure) text-sm text-muted-foreground">
                Five figures — weight, height, age, sex and activity level — and
                Kete works out the rest.
              </p>
              <Link
                className="mt-4 inline-block font-semibold underline decoration-accent decoration-2 underline-offset-4"
                to={PATHS.measurements}
              >
                Add your measurements
              </Link>
            </div>
          </Band>

          <Band heading="Where to go next">
            <Areas />
          </Band>
        </div>
      </Screen>
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
    <Screen
      title="Dashboard"
      lede="What your body needs each day, and where to go next."
    >
      <div className="grid gap-10">
        <Band heading="Your daily target">
          <Figures className="mt-2" rows={rows} />
          {/* Where the figures come from is answered on /targets, at length and
              in plain words. Repeating that note here would put two copies of
              the same explanation in the application. */}
          <Link
            className="mt-4 inline-block text-sm underline decoration-rule decoration-2 underline-offset-4 transition-colors duration-200 hover:decoration-accent"
            to={PATHS.targets}
          >
            How these are worked out
          </Link>
        </Band>

        <Band heading="Where to go next">
          <Areas />
        </Band>
      </div>
    </Screen>
  );
}
