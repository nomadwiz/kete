import { Link, Outlet, useLocation } from "react-router";

import { PATHS } from "../routes";
import "./public-layout.css";

export default function PublicLayout() {
  const { pathname } = useLocation();

  // Each of the two forms already links to the other, under its own button,
  // where someone who has just decided they are on the wrong one will look.
  // Repeating that in the header offers a page you are already reading.
  const onForm = pathname === PATHS.sign_in || pathname === PATHS.sign_up;

  return (
    <>
      <header className="public-shell">
        <Link className="public-shell__brand" to={PATHS.home}>
          Kete
        </Link>
        {onForm ? null : (
          <nav aria-label="Account">
            <ul className="public-shell__nav">
              <li>
                <Link to={PATHS.sign_in}>Sign in</Link>
              </li>
              <li>
                <Link to={PATHS.sign_up}>Sign up</Link>
              </li>
            </ul>
          </nav>
        )}
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
