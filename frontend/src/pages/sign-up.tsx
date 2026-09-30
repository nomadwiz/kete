import { Form, Link, useActionData } from "react-router";

import { Button } from "../components/ui/button";
import { Field, FieldPair } from "../components/ui/field";
import { Notice } from "../components/ui/notice";
import { Screen } from "../components/ui/screen";
import { PATHS } from "../routes";

export default function SignUp() {
  const error = useActionData() as string | undefined;

  return (
    <Screen
      title="Create an account"
      lede="Then sign in and record your measurements. Kete works out your daily targets from them."
    >
      <div className="grid max-w-(--form-width) gap-6">
        {error ? (
          <Notice tone="refusal" role="alert">
            {error}
          </Notice>
        ) : null}

        <Form className="grid gap-6" method="post">
          <FieldPair>
            <Field htmlFor="first-name" label="First name">
              <input
                id="first-name"
                name="first_name"
                autoComplete="given-name"
                required
              />
            </Field>

            <Field htmlFor="last-name" label="Last name">
              <input
                id="last-name"
                name="last_name"
                autoComplete="family-name"
                required
              />
            </Field>
          </FieldPair>

          <Field htmlFor="username" label="Username">
            <input
              id="username"
              name="username"
              autoComplete="username"
              required
            />
          </Field>

          <Field htmlFor="email" label="Email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </Field>

          <Field htmlFor="password" label="Password">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              aria-describedby="password-hint"
            />
            <p className="text-xs text-muted-foreground" id="password-hint">
              At least 8 characters.
            </p>
          </Field>

          {/* No `disabled` here, and that is deliberate rather than an omission:
              this screen does not call useWrite, so there is no busy state to
              reflect. ADR 005's list omits it for the same reason. */}
          <Button className="justify-self-start" variant="accent" type="submit">
            Create an account
          </Button>
        </Form>

        <p className="border-t border-rule pt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="text-ink underline" to={PATHS.sign_in}>
            Sign in
          </Link>
        </p>
      </div>
    </Screen>
  );
}
