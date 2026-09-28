import { Form, useActionData, useLoaderData } from "react-router";

import type { Metrics } from "../types/measurement";
import { useSubmitting } from "../use-submitting";
import "./measurement.css";

export default function Measurement() {
  // What was saved last time, or null when nothing has been. Either way the
  // same form is drawn, and the five controls take these as defaultValue
  // rather than value, so they stay uncontrolled. React reads a default only
  // at mount, which this screen wants twice over: a figure the person
  // overtypes stays overtyped, and a submission the API refused re-renders
  // this component without remounting it, so what they typed survives above
  // the message saying why. Holding the five in state instead would mean a
  // change handler per field and a second copy of the form to keep in step.
  const saved = useLoaderData() as Metrics | null;
  const error = useActionData() as string | undefined;
  const saving = useSubmitting();

  return (
    <div className="measurement">
      <h1 className="measurement__title">Your measurements</h1>

      <p className="measurement__lede">
        These five figures give Kete your daily targets — energy, protein,
        carbohydrate and fat. Save them again whenever they change and the
        targets are worked out afresh.
      </p>

      {error ? (
        <p className="measurement__error" role="alert">
          {error}
        </p>
      ) : null}

      <Form className="measurement__form" method="post" aria-busy={saving}>
        <div className="measurement__pair">
          <div className="measurement__field">
            <label className="measurement__label" htmlFor="weight-kg">
              Weight (kg)
            </label>
            <input
              id="weight-kg"
              name="weight_kg"
              type="number"
              defaultValue={saved?.weight_kg ?? ""}
              min="0.01"
              max="635"
              step="0.01"
              required
            />
          </div>

          <div className="measurement__field">
            <label className="measurement__label" htmlFor="height-cm">
              Height (cm)
            </label>
            <input
              id="height-cm"
              name="height_cm"
              type="number"
              defaultValue={saved?.height_cm ?? ""}
              min="0.01"
              max="272"
              step="0.01"
              required
            />
          </div>
        </div>

        <div className="measurement__pair">
          <div className="measurement__field">
            <label className="measurement__label" htmlFor="age">
              Age
            </label>
            <input
              id="age"
              name="age"
              type="number"
              defaultValue={saved?.age ?? ""}
              min="1"
              max="129"
              step="1"
              required
            />
          </div>

          <div className="measurement__field">
            <label className="measurement__label" htmlFor="sex">
              Sex
            </label>
            <select
              id="sex"
              name="sex"
              defaultValue={saved?.sex ?? ""}
              required
            >
              <option value="">Choose one</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
            </select>
          </div>
        </div>

        <div className="measurement__field">
          <label className="measurement__label" htmlFor="activity-level">
            Activity level
          </label>
          <select
            id="activity-level"
            name="activity_level"
            defaultValue={saved?.activity_level ?? ""}
            required
          >
            <option value="">Choose one</option>
            <option value="sedentary">Sedentary</option>
            <option value="light">Light</option>
            <option value="moderate">Moderate</option>
            <option value="active">Active</option>
            <option value="very_active">Very active</option>
          </select>
        </div>

        <button className="measurement__submit" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save and compute targets"}
        </button>
      </Form>
    </div>
  );
}
