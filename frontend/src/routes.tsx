import {
  ACCOUNT,
  DASHBOARD,
  HOME,
  MEASUREMENT,
  NOT_FOUND,
  PLANNER,
  RECIPE,
  RECIPES,
  SIGN_IN,
  SIGN_UP,
  TARGETS,
} from "./pages";

const PATHS = {
  home: "/",
  sign_up: "/sign-up",
  sign_in: "/sign-in",
  measurements: "/measurements",
  targets: "/targets",
  dashboard: "/dashboard",
  recipes: "/recipes",
  recipe: "/recipes/:id",
  recipe_create: "/recipe",
  planner: "/planner",
  account: "/account",
  not_found: "*",
} as const;

export const routes = [
  {
    path: PATHS.home,
    Component: HOME,
  },
  {
    path: PATHS.sign_up,
    Component: SIGN_UP,
  },
  {
    path: PATHS.sign_in,
    Component: SIGN_IN,
  },
  {
    path: PATHS.measurements,
    Component: MEASUREMENT,
  },
  {
    path: PATHS.targets,
    Component: TARGETS,
  },
  {
    path: PATHS.dashboard,
    Component: DASHBOARD,
  },
  {
    path: PATHS.recipes,
    Component: RECIPES,
  },
  {
    path: PATHS.recipe,
    Component: RECIPE,
  },

  {
    path: PATHS.planner,
    Component: PLANNER,
  },
  {
    path: PATHS.account,
    Component: ACCOUNT,
  },
  {
    path: PATHS.not_found,
    Component: NOT_FOUND,
  },
];
