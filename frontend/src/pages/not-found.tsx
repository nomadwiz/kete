<<<<<<< Updated upstream
=======
<<<<<<< Updated upstream
=======
>>>>>>> Stashed changes
import { Link } from "react-router";

import { PATHS } from "../routes";

<<<<<<< Updated upstream
// Sits outside both layouts, because at an unmatched address the application
// cannot tell which state the visitor is in. That leaves it with no
// navigation around it, so it carries one link of its own rather than being
// a dead end.
=======
>>>>>>> Stashed changes
>>>>>>> Stashed changes
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
