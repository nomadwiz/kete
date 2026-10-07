import { useEffect, useRef, useState } from "react";
import { useActionData, useLocation, type FormMethod } from "react-router";

import { useSubmitting } from "./use-submitting";
import "./use-write.css";

// Everything a screen needs to know about its own write: whether one is in
// flight, and whether the last one worked. Call it instead of useSubmitting
// wherever a page holds a <Form> that writes: `useWrite("POST")`.
//
// It exists because the same two answers were about to be written once per
// screen across eight of them, and C28 (nomadwiz/kete#285) is the record of
// what they cost when nobody wrote them at all. Both decisions below were
// taken for the whole client rather than per screen, and they are written here
// because this is the file the next person editing a submit button ends up
// in.
//
// DECISION ONE -- THE BUTTON KEEPS `disabled`, AND FOCUS IS PUT BACK
// AFTERWARDS. A submit button stays `disabled` while its own write is in
// flight, and focus is returned to it -- or, when it has gone, to the nearest
// part of the page that is still there -- once the write finishes. It is not
// `aria-disabled`.
//
// `aria-disabled` is the usual recommendation for exactly this defect, and it
// was weighed. It leaves the element focusable and announced, and it moves the
// prevention of a double submit out of the element and into the action, where
// every action would need a guard of its own. planner.tsx already relies on
// the attribute for precisely that: a second Add is answered 409 and a second
// Remove 404, so a second click shows a person a failure for an operation that
// in fact succeeded. Putting focus back fixes the defect that was reported
// without touching a guard that works, and moving that guard is a larger
// change carrying a live correctness risk. The cost of keeping `disabled` is
// that the button's state is not announced while it is dead, which is what the
// in-flight label on every one of them says instead.
//
// DECISION TWO -- ONE `role="status"` PER SCREEN, NOT ONE LIVE REGION IN
// AppLayout. The sentence announcing a write that worked is rendered by the
// screen that performed the write, beside the thing it describes, which is
// what account.tsx has done since it was written. There is no shared live
// region in the layout.
//
// A region in AppLayout would be one element rather than one per screen, but
// every screen would then have to post a sentence to it from a distance, and
// the sentence would be maintained far from the change it reports. Per screen
// is a small region each and no plumbing, and it is the idiom this client
// already has rather than a new one. The region stays mounted, empty, from the
// screen's first render and only its text arrives with a write (StatusRegion,
// C28), because a live region inserted already holding its text is commonly
// not announced. What is genuinely shared is the part that
// could otherwise have been decided once per screen -- when a write counts as
// having succeeded -- and that is what this hook holds.
//
// A string is a refusal and anything else is a success, which is an invariant
// of every action in routes.tsx rather than a guess: profileAction,
// passwordAction, deleteAccountAction, recipesAction, recipeAction,
// plannerAction, measurementsAction, signUpAction and signInAction each return
// the server's message as a string when the form can be retyped to fix it, and
// null or a redirect when the write went through. Change that in one action
// and this reads a refusal as a success.
//
// The address, not a boolean. `succeeded` is held as the location key the
// write landed at, so the sentence clears itself when the person navigates.
// The planner keeps the week in the query string and stays mounted across a
// change of week, so a plain boolean set by the last Add would still be true a
// week later and would announce that a week somebody had only just looked at
// had been updated.
//
// Two things it deliberately does not do. It does not announce a write that
// redirects to another route -- sign-in and measurements both do, and their
// component is unmounted before this could say anything, so what needs
// announcing there is the arrival at the new screen, which is route-change
// announcement and a different problem. And it moves focus only when focus
// has been dropped on the floor: if anything at all holds it when the write
// finishes, this leaves it alone, because the browser restoring focus after a
// <dialog> closes and a person who has clicked elsewhere mid-save are both
// cases where stealing it back would be the defect.
//
// A write posted through a fetcher passes the fetcher as well:
// `useWrite("POST", fetcher)`. The navigation never sees a fetcher, so without
// it `busy` would stay false for the whole write and useActionData would never
// carry its answer -- the busy flag and the result are the fetcher's own, and
// everything below them, the success rule and the focus, is the same.
// recipe.tsx's photograph control is the one that does, C14
// (nomadwiz/kete#184).
export function useWrite(
  method: FormMethod,
  fetcher?: { state: string; data?: unknown },
): {
  busy: boolean;
  succeeded: boolean;
} {
  const submitting = useSubmitting(method);
  const actionData = useActionData();
  const busy = fetcher ? fetcher.state !== "idle" : submitting;
  const result = fetcher ? fetcher.data : actionData;
  const { key } = useLocation();

  // The edge is read during the render that carries it, not in an effect,
  // which is React's own answer for state that follows a changing input and is
  // also what this project's lint rules leave available: setState inside an
  // effect is refused as a cascading render, and a ref cannot be touched while
  // rendering. Both refusals are right here -- the answer is wanted in the
  // render that already knows it, so no second commit is needed to show the
  // sentence.
  //
  // `result` and `key` are read in that same render, which is the one where
  // the navigation has finished: a redirect has already landed, so the address
  // is the destination's and useActionData is the answer for the write just
  // made.
  const [lastBusy, setLastBusy] = useState(busy);
  const [succeededAt, setSucceededAt] = useState<string | null>(null);

  if (busy !== lastBusy) {
    setLastBusy(busy);
    setSucceededAt(busy || typeof result === "string" ? null : key);
  }

  // Where focus was. Written by the listener below and read by the effect, so
  // a ref rather than state -- nothing on the screen depends on it.
  //
  // The listener is not optional and the obvious alternative does not work:
  // reading document.activeElement when the write starts is already too late,
  // because React sets the disabled attribute during the commit and the
  // browser blurs the element there and then, so anything looking afterwards
  // finds <body>. focusin is how the element is known before it is taken away.
  const wasFocused = useRef<HTMLElement | null>(null);
  const trail = useRef<HTMLElement[]>([]);

  useEffect(() => {
    function remember(event: FocusEvent) {
      if (event.target instanceof HTMLElement) {
        wasFocused.current = event.target;
      }
    }

    document.addEventListener("focusin", remember);

    return () => document.removeEventListener("focusin", remember);
  }, []);

  // Driven by the edge above rather than by `busy` itself, so this runs once
  // per transition and not once per render. It runs on mount too, where
  // lastBusy is false and the trail is empty, and does nothing.
  useEffect(() => {
    if (lastBusy) {
      // Taken now rather than when the write finishes, because by then the
      // element may have been unmounted along with everything it sat inside --
      // the planner replaces the contents of a cell, and recipe.tsx swaps the
      // edit form for the read view. A detached node's parentElement chain
      // leads nowhere, so the chain has to be read while it is still attached.
      // Disabled is not detached, so the element itself is still here.
      trail.current = [];

      for (
        let node: HTMLElement | null = wasFocused.current;
        node;
        node = node.parentElement
      ) {
        trail.current.push(node);
      }

      return;
    }

    if (document.activeElement !== document.body) {
      return;
    }

    // Outwards from the element that was focused, until something accepts it.
    // The first entry is the button itself, which is the answer on a refusal
    // and on any write that leaves the page as it was; a container is the
    // answer where the button has gone, and the nearest one gives up the least
    // of the person's place -- the planner's <td> is still the cell they were
    // in, announced with its day and its meal by the table's own headers.
    //
    // The result of focus() is checked rather than assumed. A closed <dialog>
    // is display:none and silently refuses focus, which is the recipe list
    // after a save, and without the check this would stop at an element that
    // never took it and leave focus on <body>.
    for (const node of trail.current) {
      if (!node.isConnected) {
        continue;
      }

      // Containers are not focusable and have to be made so. -1 keeps them out
      // of the tab order, so nobody tabbing through the page ever lands on
      // one; it only makes them a place focus can be put. use-write.css draws
      // the ring, which :focus-visible alone will not.
      if (node.tabIndex < 0) {
        node.setAttribute("tabindex", "-1");
      }

      node.focus();

      if (document.activeElement === node) {
        return;
      }
    }
  }, [lastBusy]);

  return { busy, succeeded: succeededAt === key };
}
