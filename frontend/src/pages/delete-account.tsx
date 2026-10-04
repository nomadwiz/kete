import { Form, useActionData } from "react-router";

import { Button } from "../components/ui/button";
import { Field } from "../components/ui/field";
import { Notice } from "../components/ui/notice";
import { Screen } from "../components/ui/screen";
import { useWrite } from "../use-write";

export default function DeleteAccount() {
  const error = useActionData() as string | undefined;
  // No confirmation, for measurement.tsx's reason: a delete that works
  // redirects home and this component is gone before it could say anything.
  // The hook is here for the focus it puts back after a refusal.
  const { busy: deleting } = useWrite("POST");

  return (
    <Screen
      title="Delete your account"
      lede="Your account goes, and with it your measurements, targets, recipes, photographs and plan. This cannot be undone."
    >
      <div className="grid max-w-(--form-width) gap-6">
        {error ? (
          <Notice tone="refusal" role="alert">
            {error}
          </Notice>
        ) : null}

        {/* The password is the confirmation, so there is no window.confirm as
            recipe.tsx has: typing it is the deliberate step a second click
            would otherwise stand in for. */}
        <Form className="grid gap-6" method="post" aria-busy={deleting}>
          <Field htmlFor="password" label="Password">
            <input
              id="password"
              name="password"
              autoComplete="current-password"
              type="password"
              required
            />
          </Field>

          <Button
            className="justify-self-start"
            variant="destructive"
            type="submit"
            disabled={deleting}
          >
            {deleting ? "Deleting…" : "Delete your account"}
          </Button>
        </Form>
      </div>
    </Screen>
  );
}
