import { Form, Link, useActionData, useLoaderData } from "react-router";

import { PATHS } from "../routes";
import type { Profile } from "../types/profile";
import { useWrite } from "../use-write";
import "./account.css";

export default function Account() {
  // The saved account details. The four controls take them as defaultValue
  // rather than value, so they stay uncontrolled, for the reason
  // measurement.tsx records: a submission the API refuses re-renders this
  // component without remounting it, so what the person typed survives above
  // the message saying why. Holding the four in state would mean a change
  // handler per field and a second copy of the form to keep in step.
  const saved = useLoaderData() as Profile;

  // What the last submission answered, if there has been one. React Router
  // gives undefined until then and the action's own value afterwards, so the
  // three states are distinguishable: undefined is a form nobody has
  // submitted, a string is a refusal to show, and null is a save that worked.
  const result = useActionData() as string | null | undefined;
  const error = typeof result === "string" ? result : null;

  // Nothing sends a query string to /account today, which is exactly why an
  // equality against the whole formAction would look right here. C25
  // (nomadwiz/kete#277) and src/use-submitting.ts say why it is not.
  //
  // `succeeded` is the same question this screen used to ask of `result`
  // itself, asked in one place for every screen instead -- C28
  // (nomadwiz/kete#285) moved it there rather than leaving each screen to
  // decide separately what a write that worked looks like. The confirmation
  // below is unchanged: this is the screen the others were told to copy.
  const { busy: saving, succeeded } = useWrite("POST");

  return (
    <div className="account">
      <h1 className="account__title">Your account</h1>

      <p className="account__lede">
        Your name, the username you sign in with, and the address Kete writes
        to. Change any of them and save.
      </p>

      {error ? (
        <p className="account__error" role="alert">
          {error}
        </p>
      ) : null}

      {/* The confirmation stays put while the person goes on editing, so it
          can sit above changes that are not saved yet. Clearing it would mean
          a change handler and a piece of state on a screen that deliberately
          holds none -- and the fields it sits above are the ones that were
          just saved, so what it says stays true of them. */}
      {succeeded ? (
        <p className="account__saved" role="status">
          Your details are saved.
        </p>
      ) : null}

      {/* All four fields are posted whether or not they changed. PUT /profile
          replaces the account rather than patching it, so a form that sent
          only what changed would blank the rest. */}
      <Form className="account__form" method="post" aria-busy={saving}>
        <div className="account__pair">
          <div className="account__field">
            <label className="account__label" htmlFor="first-name">
              First name
            </label>
            <input
              id="first-name"
              name="first_name"
              autoComplete="given-name"
              defaultValue={saved.first_name}
              required
            />
          </div>

          <div className="account__field">
            <label className="account__label" htmlFor="last-name">
              Last name
            </label>
            <input
              id="last-name"
              name="last_name"
              autoComplete="family-name"
              defaultValue={saved.last_name}
              required
            />
          </div>
        </div>

        <div className="account__field">
          <label className="account__label" htmlFor="username">
            Username
          </label>
          <input
            id="username"
            name="username"
            autoComplete="username"
            defaultValue={saved.username}
            required
          />
        </div>

        <div className="account__field">
          <label className="account__label" htmlFor="email">
            Email
          </label>
          {/* type="email" against the format the schema puts on this field,
              so the browser refuses an address the server would answer 422
              for. Change one side of that pair and the other is now wrong. */}
          <input
            id="email"
            name="email"
            autoComplete="email"
            type="email"
            defaultValue={saved.email}
            required
          />
        </div>

        <button className="account__submit" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </Form>

      {/* The issue's second clause. The measurements are a separate form
          because they are a separate endpoint -- GET /profile answers these
          four fields and nothing about the body -- so this screen points at
          it rather than drawing it. The link is written here in the component
          body: the page reaches PATHS through a circular import and it is
          still undefined while this module evaluates. */}
      <p className="account__onward">
        Your body measurements are kept apart from these details.{" "}
        <Link className="account__link" to={PATHS.measurements}>
          Change your measurements
        </Link>
      </p>
    </div>
  );
}
