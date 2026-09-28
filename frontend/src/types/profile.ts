import type { components } from "./api";

// The account details, as GET /profile answers them.
//
// ProfileIn declares the same four fields, all four required, so this one
// alias serves the read and the write and profileAction in routes.tsx sends
// this shape back. Nothing checks that the two stay identical -- a field on
// one and not the other is absent rather than a type error -- so alias
// ProfileIn separately the moment they differ.
//
// The trap is in the verb: PUT is a full replace and there is no partial
// update, so amending one field means sending all four. A form that posted
// only what changed would blank the rest.
export type Profile = components["schemas"]["ProfileOut"];
