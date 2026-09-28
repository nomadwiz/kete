import { useNavigation, useResolvedPath } from "react-router";

// Whether a submission to this route is in flight, which is the question a
// form's aria-busy and its submit button's disabled state are asking. Call it
// from a page holding a <Form> and pass nothing.
//
// It compares pathnames because the two sides are not the same string. A
// react-router <Form> declaring no `action` prop -- which is every Form in
// this client, because ADR 002 keeps every path string in routes.tsx --
// submits to the current address *including its search*: useFormAction does
// `if (action == null) { path.search = location.search; }`. So on
// /sign-in?created=1, where signUpAction sends a new account, formAction is
// `/sign-in?created=1`, and comparing it to `/sign-in` is false for the whole
// submission -- the button stays live for a second click and aria-busy stays
// off. That was C25 (nomadwiz/kete#277), and ADR 002 addresses two more
// screens with a query string by design.
//
// The route's own pathname comes from useResolvedPath("."), which is where
// useFormAction gets it too, so the two halves are resolved by the same rule
// rather than by one of them being retyped as a constant. That also makes the
// hook take no argument, which matters twice over: no path string leaves
// routes.tsx and nothing here imports from it, so this module stays clear of
// the routes.tsx/pages cycle dashboard.tsx describes; and a caller cannot pass
// PATHS.recipe, which is the pattern `/recipes/:id` and never an address.
//
// `navigation.state !== "idle"` is not this question and will not serve: it is
// also true while a loader runs for an ordinary navigation away from the page,
// so it would disable the button of someone who is leaving rather than
// submitting. A submission to some other route -- the shell's sign-out form --
// is excluded for the same reason, by the pathname rather than by the state.
export function useSubmitting(): boolean {
  const { pathname } = useResolvedPath(".");

  return useNavigation().formAction?.split("?")[0] === pathname;
}
