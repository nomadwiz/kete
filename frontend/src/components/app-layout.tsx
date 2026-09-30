import { Form, Link, NavLink, Outlet } from "react-router";

import { PATHS } from "../routes";
import { Button } from "./ui/button";
import "./app-layout.css";

export default function AppLayout() {
  const areas = [
    { to: PATHS.dashboard, label: "Dashboard" },
    { to: PATHS.measurements, label: "Measurements" },
    { to: PATHS.targets, label: "Targets" },
    { to: PATHS.recipes, label: "Recipes" },
    { to: PATHS.planner, label: "Planner" },
    { to: PATHS.account, label: "Account" },
  ];

  return (
    // The shell draws the page column as two vertical rules, so every signed-in
    // screen sits inside a frame rather than floating in the viewport. It is the
    // warp; the header's rule and each screen's own rules are the weft.
    <div className="app-shell">
      <header className="app-shell__bar">
        <Link className="app-shell__brand" to={PATHS.dashboard}>
          Kete
        </Link>

        <nav className="app-shell__nav" aria-label="Main">
          <ul>
            {areas.map((area) => (
              <li key={area.to}>
                {/* NavLink already sets aria-current="page", so the kowhai bar
                    below is the second carrier of the same fact rather than the
                    only one. */}
                <NavLink className="app-shell__link" to={area.to}>
                  {area.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <Form method="post" action={PATHS.sign_out}>
          <Button type="submit" size="xs">
            Sign out
          </Button>
        </Form>
      </header>
      <main className="app-shell__main">
        <Outlet />
      </main>
    </div>
  );
}
