import type { components } from "./api";

// POST /profile/metrics takes all five every time; there is no partial update.
// This is the request shape. GET /profile/metrics answers the same five back
// as MetricsOut (B3, nomadwiz/kete#152) and POST answers the computed targets
// rather than the metrics it was given, so neither reply is this type -- alias
// MetricsOut here when a screen needs to read the saved values.
export type Metrics = components["schemas"]["MetricsIn"];

// The two enumerations the API validates, read off the schema rather than
// retyped from it. The activity factors themselves never cross the wire: the
// client sends the word and the server multiplies by it, so a value from
// outside the enumeration is a 422 rather than a target computed from the
// wrong factor.
export type Sex = Metrics["sex"];

export type ActivityLevel = Metrics["activity_level"];
