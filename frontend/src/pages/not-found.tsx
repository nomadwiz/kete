import { Link } from "react-router";

import { PATHS } from "../routes";

// Carries its own <main>, because it sits outside both layouts and so inherits
// no landmark from one -- doc/design/implementation.md section 2 in
// nomadwiz/kete-doc. It takes the same column, gutter and display setting as
// every other screen, so a wrong address does not land somewhere that looks
// like a different application.
export default function NotFound() {
  return (
    <main className="mx-auto grid w-full max-w-(--column) gap-4 px-(--gutter) py-16 lg:py-24">
      <h1 className="text-title leading-[0.95] font-semibold tracking-tight [font-stretch:var(--stretch-display)]">
        Page not found
      </h1>
      <p className="max-w-(--measure) text-muted-foreground">
        The address does not match anything in Kete. It may have been mistyped,
        or the recipe it named may have been deleted.
      </p>
      <p>
        <Link
          className="font-semibold underline decoration-accent decoration-2 underline-offset-4"
          to={PATHS.home}
        >
          Go to the home page
        </Link>
      </p>
    </main>
  );
}
