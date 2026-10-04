import { useEffect, useRef } from "react";
import { Form, Link, useActionData, useLoaderData } from "react-router";

import { Button } from "../components/ui/button";
import { Field, FieldPair } from "../components/ui/field";
import { Notice } from "../components/ui/notice";
import { Screen } from "../components/ui/screen";
import { PATHS } from "../routes";
import type { Profile } from "../types/profile";
import { useWrite } from "../use-write";

const LINK =
  "text-ink underline decoration-accent decoration-2 underline-offset-4";

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

  // Empty the password once a save has worked, as password.tsx does. Only the
  // password: reset() would also rewrite the four details from their
  // defaultValue, and this leaves them exactly as the person sees them.
  const password = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (succeeded && password.current) {
      password.current.value = "";
    }
  }, [succeeded]);

  return (
    <Screen
      title="Your account"
      lede="Your name, the username you sign in with, and the address Kete writes to. Change any of them and save."
    >
      <div className="grid max-w-(--form-width) gap-6">
        {error ? (
          <Notice tone="refusal" role="alert">
            {error}
          </Notice>
        ) : null}

        {/* The confirmation stays put while the person goes on editing, so it
            can sit above changes that are not saved yet. Clearing it would mean
            a change handler and a piece of state on a screen that deliberately
            holds none -- and the fields it sits above are the ones that were
            just saved, so what it says stays true of them. */}
        {succeeded ? (
          <Notice tone="progress" role="status">
            Your details are saved.
          </Notice>
        ) : null}

        {/* All four fields are posted whether or not they changed. PUT /profile
            replaces the account rather than patching it, so a form that sent
            only what changed would blank the rest. */}
        <Form className="grid gap-6" method="post" aria-busy={saving}>
          <FieldPair>
            <Field htmlFor="first-name" label="First name">
              <input
                id="first-name"
                name="first_name"
                autoComplete="given-name"
                defaultValue={saved.first_name}
                required
              />
            </Field>

            <Field htmlFor="last-name" label="Last name">
              <input
                id="last-name"
                name="last_name"
                autoComplete="family-name"
                defaultValue={saved.last_name}
                required
              />
            </Field>
          </FieldPair>

          <Field htmlFor="username" label="Username">
            <input
              id="username"
              name="username"
              autoComplete="username"
              defaultValue={saved.username}
              required
            />
          </Field>

          <Field htmlFor="email" label="Email">
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
          </Field>

          {/* Always drawn and never required. The API asks for it only when
              the username or email changes, which this uncontrolled form cannot
              know without a change handler per field, so the label says when
              it is needed and profileAction sends it only when typed. */}
          <Field
            htmlFor="current-password"
            label="Current password (only to change your username or email)"
          >
            <input
              ref={password}
              id="current-password"
              name="current_password"
              autoComplete="current-password"
              type="password"
            />
          </Field>

          <Button
            className="justify-self-start"
            variant="accent"
            type="submit"
            disabled={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </Form>

        {/* The measurements are a separate form because they are a separate
            endpoint -- GET /profile answers these four fields and nothing about
            the body -- so this screen points at it rather than drawing it. The
            password and the deletion are separate endpoints too (#316), each
            with its own screen. The links are written in the component body:
            the page reaches PATHS through a circular import and it is still
            undefined while this module evaluates. */}
        <div className="grid gap-2 border-t border-rule pt-4 text-sm text-muted-foreground">
          <p>
            Your body measurements are kept apart from these details.{" "}
            <Link className={LINK} to={PATHS.measurements}>
              Change your measurements
            </Link>
          </p>
          <p>
            <Link className={LINK} to={PATHS.account_password}>
              Change your password
            </Link>
          </p>
          <p>
            <Link className={LINK} to={PATHS.account_delete}>
              Delete your account
            </Link>
          </p>
        </div>
      </div>
    </Screen>
  );
}
