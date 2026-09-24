import { Link, Outlet } from "react-router";

import { PATHS } from "../routes";

// The signed-out shell, over the three public addresses. Static on purpose:
// it offers "Sign in" even to a visitor who already holds a credential,
// because what the public home page owes a signed-in user is C5 (#170)'s
// decision and not this issue's.
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
