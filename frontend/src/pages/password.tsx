import { Form, useActionData } from "react-router";

import { Button } from "../components/ui/button";
import { Field } from "../components/ui/field";
import { Notice } from "../components/ui/notice";
import { Screen } from "../components/ui/screen";
import { useWrite } from "../use-write";

export default function Password() {
  // account.tsx's three states: undefined before a submission, a string for a
  // refusal, null for a change that went through.
  const result = useActionData() as string | null | undefined;
  const error = typeof result === "string" ? result : null;
  const { busy: saving, succeeded } = useWrite("POST");

  return (
    <Screen
      title="Your password"
      lede="Type the password you sign in with now, then the one to use from here on."
    >
      <div className="grid max-w-(--form-width) gap-6">
        {error ? (
          <Notice tone="refusal" role="alert">
            {error}
          </Notice>
        ) : null}

        {succeeded ? (
          <Notice tone="progress" role="status">
            Your password is changed.
          </Notice>
        ) : null}

        {/* One new-password field, not two: sign-up asks once, and this
            screen follows it. */}
        <Form className="grid gap-6" method="post" aria-busy={saving}>
          <Field htmlFor="current-password" label="Current password">
            <input
              id="current-password"
              name="current_password"
              autoComplete="current-password"
              type="password"
              required
            />
          </Field>

          <Field htmlFor="new-password" label="New password">
            {/* minLength against the min_length PasswordIn puts on this field,
                so the browser refuses what the server would answer 422 for.
                Change one side of that pair and the other is now wrong. */}
            <input
              id="new-password"
              name="new_password"
              autoComplete="new-password"
              type="password"
              minLength={8}
              required
              aria-describedby="new-password-hint"
            />
            <p className="text-xs text-muted-foreground" id="new-password-hint">
              At least 8 characters.
            </p>
          </Field>

          <Button
            className="justify-self-start"
            variant="accent"
            type="submit"
            disabled={saving}
          >
            {saving ? "Changing…" : "Change password"}
          </Button>
        </Form>
      </div>
    </Screen>
  );
}
