import { useEffect, useRef } from "react";
import { Outlet, useLocation } from "react-router";

// Where focus goes when the page changes. C38 (nomadwiz/kete#379), ADR 015.
//
// ON EVERY CHANGE OF PATHNAME, focus moves to the new page's <h1>, or to its
// <main> where there is no <h1>, so a keyboard or screen-reader user hears
// where they arrived instead of being left on <body>. That covers the six
// writes that redirect (sign-up, sign-in, measurements, recipe delete, sign-out,
// account deletion) and every link as well, because a page that changed under
// a link is the same arrival.
//
// NOT ON A CHANGE OF QUERY STRING ALONE. The planner's week links, a recipe
// saved in place and a recipe created from the list all stay on one pathname,
// the person is still on the screen they were using, and src/use-write.ts
// already puts focus back after the writes among them. Keying this on the
// location key would take focus from them.
//
// NOT ON THE FIRST PAGE DRAWN. The browser has just loaded it and reads it from
// the top; moving focus there would skip what sits above the heading.
//
// IT SITS ON THE ROOT ROUTE, not in a layout. Sign-in, sign-out and account
// deletion cross between PublicLayout and AppLayout, so the destination's
// layout is mounting for the first time and could not tell an arrival from a
// first load. This is the one component both layouts sit inside.
export default function FocusOnArrival() {
  const { pathname } = useLocation();
  // The pathname focus was last handled for. Starting it at the first one is
  // what skips the first load, and it survives StrictMode's second run of the
  // effect, where a "has mounted" flag would not.
  const handled = useRef(pathname);

  useEffect(() => {
    if (handled.current === pathname) {
      return;
    }

    handled.current = pathname;

    const target =
      document.querySelector<HTMLElement>("main h1") ??
      document.querySelector<HTMLElement>("main");

    if (!target) {
      return;
    }

    // -1 makes it a place focus can be put without adding it to the tab
    // order. src/use-write.css draws the ring for it.
    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }

    target.focus();
  }, [pathname]);

  return <Outlet />;
}
