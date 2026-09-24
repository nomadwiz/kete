import { Link, Outlet } from "react-router";

import { PATHS } from "../routes";
import "./public-layout.css";

export default function PublicLayout() {
  return (
    <>
      <header className="public-shell">
        <Link className="public-shell__brand" to={PATHS.home}>
          Kete
        </Link>
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
      </header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
