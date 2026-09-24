import { Link, NavLink, Outlet } from "react-router";

import { PATHS } from "../routes";

// The signed-in shell, over the seven protected addresses. Everything it
// draws is reachable without the API — six links and a form — which is what
// keeps C4 (#169) free of the dependency on C3 (#168) that eleven other
// screens carry. Naming the signed-in user here would mean GET /profile.
export default function AppLayout() {
  // Built inside the component, not at module level, and the reason is not
  // style. routes.tsx imports this file, and this file imports PATHS back
  // from it, so while the modules are evaluating PATHS is still in its
  // temporal dead zone and reading it would throw. Inside the function body
  // it is read at render, by which time both modules have finished.
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
      </header>
      <Outlet />
    </>
  );
}
