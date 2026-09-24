import { Link, Outlet } from "react-router";

import { PATHS } from "../routes";
export default function PublicLayout() {
  return (
    <>
      <header>
        <Link to={PATHS.home}>Kete</Link>
        <nav aria-label="Account">
          <Link to={PATHS.sign_in}>Sign in</Link>
          <Link to={PATHS.sign_up}>Sign up</Link>
        </nav>
      </header>
      <Outlet />
    </>
  );
}
