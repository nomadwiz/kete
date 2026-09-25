// The two enumerations the API validates, spelled as backend/main.py declares
// them. The activity factors themselves never cross the wire: the client sends
// the word and the server multiplies by it, so a misspelling here is a 422
// rather than a target computed from the wrong factor.
export type Sex = "male" | "female";

export type ActivityLevel =
  "sedentary" | "light" | "moderate" | "active" | "very_active";

// POST /profile/metrics takes all five every time. There is no partial update,
// and nothing reads the saved values back -- GET /profile answers name,
// username and email, and this endpoint answers the computed targets rather
// than the metrics it was given (B3, nomadwiz/kete#152).
export interface Metrics {
  weight_kg: number;
  height_cm: number;
  age: number;
  sex: Sex;
  activity_level: ActivityLevel;
}
