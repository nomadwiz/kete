import { useFormAction, useNavigation, type FormMethod } from "react-router";

// Whether a submission of `method` to this route is in flight, which is the
// question a form's aria-busy and its submit button's disabled state are
// asking. Call it from a page holding a <Form>: `useSubmitting("POST")`.
//
// This is only the second kind of thing shared out of the pages, and the house
// rule extracts on the third repetition. What is shared is not the line but
// the knowledge of two traps, either of which reads as correct code:
//
// The address, not the path. A react-router <Form> declaring no `action` prop
// -- which is every Form in this client, because ADR 002 keeps every path
// string in routes.tsx -- submits to the current address *including its
// search*: useFormAction does `if (action == null) { path.search =
// location.search; }`. So on /sign-in?created=1, where signUpAction sends a
// new account, formAction is `/sign-in?created=1`, and comparing it to
// `/sign-in` is false for the whole submission -- the button stays live for a
// second click and aria-busy stays off. That was C25 (nomadwiz/kete#277), and
// ADR 002 addresses the recipe modal and the edit switch with a query string
// by design.
//
// The method, not only the route. A page may carry more than one Form, and a
// GET sets formAction as readily as a POST: /recipes has a search beside the
// creation modal, so a check on the address alone reports the modal as saving
// while somebody is merely searching. react-router spells the method
// upper-case at runtime, and a lower-case comparison never matches and looks
// exactly like the defect above -- which is why `method` is typed FormMethod,
// whose members are Uppercase<...>, so "post" fails the build instead.
//
// Both halves of the address comparison go through useFormAction, the same
// public hook <Form> itself uses, so a router basename -- which useFormAction
// joins on and useResolvedPath does not -- cannot make them diverge.
//
// Two things it deliberately does not answer. `navigation.state !== "idle"` is
// a different question and will not serve: it is also true while a loader runs
// for an ordinary navigation away from the page, so it would disable the
// button of someone who is leaving rather than submitting. And where one route
// answers two writes -- /recipes/:id takes a save and a delete -- this is true
// for either, so a caller telling them apart reads the submitted intent as
// well, which recipe-form.tsx describes.
export function useSubmitting(method: FormMethod): boolean {
  const navigation = useNavigation();
  const here = useFormAction();

  return (
    navigation.formMethod === method &&
    navigation.formAction?.split("?")[0] === here.split("?")[0]
  );
}
