import { Form, Link, NavLink, Outlet } from "react-router";

import { PATHS } from "../routes";

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
    <>
      <header>
        <Link to={PATHS.dashboard}>Kete</Link>
        <nav aria-label="Main">
          <ul>
            {areas.map((area) => (
              <li key={area.to}>
                <NavLink to={area.to}>{area.label}</NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <Form method="post" action={PATHS.sign_out}>
          <button type="submit">Sign out</button>
        </Form>
      </header>
      <Outlet />
    </>
  );
}
