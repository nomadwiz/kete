// What stands where figures would have been when no measurements are saved:
// what is missing, and the one link that fixes it. doc/design/visual-language.md
// section 3.4 draws it -- between the same rules the figures use, no panel, no
// icon. /dashboard, /targets and /planner all draw it, so it is written once.
//
// PATHS is read inside the component, not at module level: routes.tsx imports
// the pages, the pages import this, and this imports PATHS back, so at
// evaluation time PATHS is still undefined. dashboard.tsx says more.
import { Link } from "react-router";

import { PATHS } from "../../routes";

export function NoMeasurements() {
  return (
    <div className="border-t border-rule pt-4">
      <p className="max-w-(--measure) text-sm text-muted-foreground">
        Five figures — weight, height, age, sex and activity level — and Kete
        works out the rest.
      </p>
      <Link
        className="mt-4 inline-block font-semibold underline decoration-accent decoration-2 underline-offset-4"
        to={PATHS.measurements}
      >
        Add your measurements
      </Link>
    </div>
  );
}
