import { Link } from "react-router";

import { PATHS } from "../routes";

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
