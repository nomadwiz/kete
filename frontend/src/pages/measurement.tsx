import { Form, useActionData, useLoaderData } from "react-router";

import { Button } from "../components/ui/button";
import { Field, FieldPair } from "../components/ui/field";
import type { Metrics } from "../types/measurement";
import { useWrite } from "../use-write";
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
  // No confirmation on this screen, for sign-in.tsx's reason: a save that
  // works redirects to /targets and this component is unmounted before it
  // could announce anything. The hook is here for the focus it puts back when
  // the Save button re-enables after a refusal.
  const { busy: saving } = useWrite("POST");

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

      <Form className="mt-8 grid gap-6" method="post" aria-busy={saving}>
        {/* Weight with height, then age with sex: the equation reads the first
            pair as body size and the second as its two remaining terms, so the
            shape of the form says which figure does what. */}
        <FieldPair>
          <Field htmlFor="weight-kg" label="Weight (kg)">
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
          </Field>

          <Field htmlFor="height-cm" label="Height (cm)">
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
          </Field>
        </FieldPair>

        <FieldPair>
          <Field htmlFor="age" label="Age">
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
          </Field>

          <Field htmlFor="sex" label="Sex">
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
          </Field>
        </FieldPair>

        <Field htmlFor="activity-level" label="Activity level">
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
        </Field>

        <Button
          className="justify-self-start"
          variant="accent"
          type="submit"
          disabled={saving}
        >
          {saving ? "Saving…" : "Save and compute targets"}
        </Button>
      </Form>
    </div>
  );
}
