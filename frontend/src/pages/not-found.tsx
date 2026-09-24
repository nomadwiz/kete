import { Link } from "react-router";

import { PATHS } from "../routes";

// Sits outside both layouts, because at an unmatched address the application
// cannot tell which state the visitor is in. That leaves it with no
// navigation around it, so it carries one link of its own rather than being
// a dead end.
export default function NotFound() {
  return (
    <main>
      <h1>Page not found</h1>
      <p>
        <Link to={PATHS.home}>Go to the home page</Link>
      </p>
    </main>
  );
}
