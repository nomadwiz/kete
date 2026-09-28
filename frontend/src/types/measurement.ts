import type { components } from "./api";

// POST /profile/metrics takes all five every time; there is no partial update.
// This is the request shape, MetricsIn.
//
// GET /profile/metrics answers MetricsOut, which the measurements form
// prefills from (B3, nomadwiz/kete#152). MetricsOut declares the same five
// fields, so metricsLoader in routes.tsx reads the prefill through this type
// rather than a second alias -- but nothing checks that the two stay
// identical, because a field on one and not the other is absent rather than a
// type error. Alias MetricsOut here the moment they differ. POST's own reply
// is the targets it computed rather than the metrics it was given, so that one
// is Targets.
export type Metrics = components["schemas"]["MetricsIn"];

// The two enumerations the API validates, read off the schema rather than
// retyped from it. The activity factors themselves never cross the wire: the
// client sends the word and the server multiplies by it, so a value from
// outside the enumeration is a 422 rather than a target computed from the
// wrong factor.
export type Sex = Metrics["sex"];

export type ActivityLevel = Metrics["activity_level"];
