import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
// @ts-expect-error -- jsdom ships no types for its generated internals.
import { implForWrapper } from "jsdom/lib/generated/idl/utils.js";
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

// A form holding a file input cannot be submitted under jsdom 30 without this,
// even with no file chosen -- which is the recipe creation form since C14
// (nomadwiz/kete#184). Vitest 5.0.2 swaps in its own Request, which copies a
// jsdom Blob into a Node one by reading `blob[implSymbol]`, and it finds that
// symbol as the first own symbol of a jsdom Blob. jsdom 30 keeps none, so the
// symbol is undefined, the lookup becomes `blob["undefined"]`, and every
// submission throws reading `_bytes` of undefined. This answers that lookup
// with jsdom's own implementation object, which carries `_bytes`.
//
// The file's name does not survive -- Vitest builds a Node Blob, not a File --
// and nothing here restores it. user-event's upload() never reaches jsdom's
// form entries anyway, so no test can submit a chosen file through a form;
// recipe.test.tsx says so where it tests the actions directly instead.
//
// ponytail: patches Vitest's symbol lookup by its accidental property name;
// delete once Vitest finds jsdom's implementation some other way.
Object.defineProperty(Blob.prototype, "undefined", {
  get(this: Blob) {
    return implForWrapper(this);
  },
});
