import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Each test drives the real route tree from a fresh memory router, so nothing
// may survive between them: a token left in storage would sign the next test
// in, and a mounted tree would leave two copies of the navigation in the DOM.
afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

// jsdom 30 parses <dialog> and gives it no behaviour: HTMLDialogElement
// carries neither showModal nor close, so calling either throws and takes the
// route that called it to the error boundary. The recipe list opens its
// creation modal with showModal(), which is the only way to get the top layer,
// the backdrop, the focus trap and Escape, so without this every test of that
// screen fails for a reason that has nothing to do with the screen.
//
// What this supplies is the open flag and the `close` event, which is the part
// the recipe list's own logic turns on -- it opens and closes the dialog from
// the address and listens for `close` to put the address back. The four things
// showModal() is chosen for are the browser's and are not modelled here, so no
// test in this project asserts them; they stay manual checks.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };

  // The `open` guard matters: the real close() on a dialog that is already
  // shut fires nothing, and a polyfill that fired anyway would let a handler
  // pass here and loop in a browser -- or the reverse.
  HTMLDialogElement.prototype.close = function close() {
    if (!this.open) {
      return;
    }

    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}
