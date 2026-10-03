import type { components } from "./api";

// The account details, as GET /profile answers them.
//
// ProfileIn declares the same four fields plus an optional current_password,
// which PUT /profile wants when the username or email changes (#316), so the
// write has its own alias. Nothing checks that the four stay identical on both
// -- a field on one and not the other is absent rather than a type error.
//
// The trap is in the verb: PUT is a full replace and there is no partial
// update, so amending one field means sending all four. A form that posted
// only what changed would blank the rest.
export type Profile = components["schemas"]["ProfileOut"];
export type ProfileIn = components["schemas"]["ProfileIn"];
