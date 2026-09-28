import type { components } from "./api";

export type Register = components["schemas"]["RegisterIn"];

// POST /register answers with the new user's id and no token, so registering
// does not sign anyone in.
export type RegisterResult = components["schemas"]["RegisterOut"];

// The sign-in pair is LoginIn/LoginOut on the wire. The names here are the
// ones the screens import.
export type SignIn = components["schemas"]["LoginIn"];

export type SignInResult = components["schemas"]["LoginOut"];
