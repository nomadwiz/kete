import { Form, useActionData, useNavigation } from "react-router";

import { PATHS } from "../routes";
import "./measurement.css";

export default function Measurement() {
  const error = useActionData() as string | undefined;
  const navigation = useNavigation();
  const saving = navigation.formAction === PATHS.measurements;

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
            <select id="sex" name="sex" required>
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
          <select id="activity-level" name="activity_level" required>
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
